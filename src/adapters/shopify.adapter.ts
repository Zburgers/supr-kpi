/**
 * Shopify Adapter
 * Wraps Shopify Admin API with the adapter interface
 *
 * @module adapters/shopify
 */

import { BaseAdapter, SyncOptions, SyncResult, getYesterdayDate, toNumber, validateHeaderSchema, isSheetEmpty } from './base.adapter.js';
import { ShopifyDailyMetric, IsoDate } from '../types/etl.js';
import { sheetsService } from '../services/sheets.js';
import { logger, events } from '../lib/logger.js';
import { config } from '../config/index.js';

/**
 * Shopify-specific sync options
 */
export interface ShopifySyncOptions extends SyncOptions {
  /** Shopify store domain */
  storeDomain: string;
  /** Shopify Admin API access token */
  accessToken: string;
}

/**
 * ShopifyQL response structure
 */
interface ShopifyQlResponse {
  data?: {
    shopifyqlQuery?: {
      tableData?: {
        columns: Array<{ name: string; dataType?: string }>;
        rows: Array<Record<string, string | number | null>>;
      } | null;
      parseErrors?: Array<{
        code?: string;
        message?: string;
        range?: { start?: number; end?: number };
      }> | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

/**
 * Shopify adapter implementation
 */
class ShopifyAdapter implements BaseAdapter<ShopifyDailyMetric, ShopifySyncOptions> {
  readonly source = 'shopify' as const;

  private readonly apiVersion = '2025-10';

  /**
   * Column headers for shopify_raw_daily sheet
   */
  getColumnHeaders(): string[] {
    return [
      'id',
      'date',
      'total_orders',
      'total_revenue',
      'net_revenue',
      'total_returns',
      'new_customers',
      'repeat_customers',
    ];
  }

  /**
   * Validate adapter configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!process.env.SHOPIFY_STORE_DOMAIN) {
      errors.push('SHOPIFY_STORE_DOMAIN not set');
    }
    if (!process.env.SHOPIFY_ACCESS_TOKEN) {
      errors.push('SHOPIFY_ACCESS_TOKEN not set');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Sanitize store domain
   */
  private sanitizeStoreDomain(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    const withoutProto = trimmed.replace(/^https?:\/\//i, '');
    return withoutProto.split('/')[0];
  }

  /**
   * Build ShopifyQL combined query (matches working curl request exactly)
   */
  private buildQuery(): string {
    return 'FROM sales, customers SHOW day AS date, orders AS total_orders, total_sales AS total_revenue, net_sales AS net_revenue, returns AS returns_amount, new_customers, returning_customers AS repeat_customers DURING yesterday GROUP BY date';
  }

  /**
   * Build full GraphQL query wrapper for a ShopifyQL query
   */
  private buildGraphQLQuery(shopifyQlQuery: string): string {
    return `query {
      shopifyqlQuery(query: "${shopifyQlQuery}") {
        tableData {
          columns { name dataType }
          rows
        }
        parseErrors { code message range }
      }
    }`;
  }

  /**
   * Fetch data from Shopify Admin API
   */
  private async fetchFromApi(storeDomain: string, accessToken: string, shopifyQlQuery: string): Promise<ShopifyQlResponse> {
    const domain = this.sanitizeStoreDomain(storeDomain);
    if (!domain) {
      throw new Error('Invalid store domain');
    }

    const url = `https://${domain}/admin/api/${this.apiVersion}/graphql.json`;
    const query = this.buildGraphQLQuery(shopifyQlQuery);

    logger.debug('Fetching Shopify data', { domain, queryPreview: shopifyQlQuery.substring(0, 100) });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const text = await response.text();
      // Check for token expiry
      if (response.status === 401) {
        events.tokenExpired('shopify');
        throw new Error('Shopify access token expired or invalid');
      }
      // Check for rate limiting
      if (response.status === 429) {
        events.rateLimited('shopify');
        throw new Error('Shopify API rate limited');
      }
      throw new Error(`Shopify API error ${response.status}: ${text.substring(0, 500)}`);
    }

    return (await response.json()) as ShopifyQlResponse;
  }

  /**
   * Parse API response into metrics
   */
  private parseMetrics(apiResponse: ShopifyQlResponse): ShopifyDailyMetric {
    const shopifyql = apiResponse.data?.shopifyqlQuery;

    if (!shopifyql) {
      // Check for GraphQL errors in the response
      if (apiResponse.errors && apiResponse.errors.length > 0) {
        const errorMessages = apiResponse.errors.map(e => e.message).join('; ');
        logger.error('GraphQL errors in ShopifyQL response', { errors: apiResponse.errors });
        throw new Error(`Shopify GraphQL errors: ${errorMessages}`);
      }
      throw new Error('ShopifyQL response missing data');
    }

    if (shopifyql.parseErrors && shopifyql.parseErrors.length > 0) {
      // Create detailed error message with all available info
      const detailedErrors = shopifyql.parseErrors.map((e, idx) => {
        const parts: string[] = [];
        if (e.code) parts.push(`code: ${e.code}`);
        if (e.message) parts.push(`message: ${e.message}`);
        if (e.range) parts.push(`range: ${JSON.stringify(e.range)}`);
        return `Error ${idx + 1}: ${parts.join(', ') || 'no details'}`;
      }).join('; ');

      logger.error('ShopifyQL parse errors', {
        parseErrors: shopifyql.parseErrors,
        rawResponse: JSON.stringify(apiResponse).substring(0, 1000)
      });

      const messages = shopifyql.parseErrors
        .map((e) => e.message || `Unknown error (code: ${e.code || 'N/A'})`)
        .join('; ');
      throw new Error(`ShopifyQL parse errors: ${messages}`);
    }

    const table = shopifyql.tableData;
    if (!table || !table.rows?.length) {
      logger.warn('ShopifyQL returned no rows', {
        hasTableData: !!table,
        rowCount: table?.rows?.length
      });
      throw new Error('ShopifyQL returned no rows for yesterday');
    }

    const firstRow = table.rows[0];

    // Get date - the query uses 'day AS date' so it should return 'date'
    let dateRaw = firstRow['date'] ?? firstRow['day'];
    if (!dateRaw) {
      throw new Error(`ShopifyQL row missing date/day. Fields: ${Object.keys(firstRow).join(', ')}`);
    }

    return {
      source: 'shopify',
      date: String(dateRaw),
      total_orders: toNumber(firstRow['total_orders']),
      total_revenue: toNumber(firstRow['total_revenue']),
      net_revenue: toNumber(firstRow['net_revenue']),
      total_returns: Math.abs(toNumber(firstRow['returns_amount'])),
      new_customers: toNumber(firstRow['new_customers']),
      repeat_customers: toNumber(firstRow['repeat_customers']),
    };
  }

  /**
   * Convert metrics to sheet row
   */
  private toSheetRow(metrics: ShopifyDailyMetric): (string | number)[] {
    return [
      metrics.id ?? '',
      metrics.date,
      metrics.total_orders,
      metrics.total_revenue,
      metrics.net_revenue,
      metrics.total_returns,
      metrics.new_customers,
      metrics.repeat_customers,
    ];
  }

  /**
   * Convert column index to letter
   */
  private columnLetterFromIndex(index: number): string {
    let n = Math.max(0, index) + 1;
    let letters = '';
    while (n > 0) {
      const remainder = (n - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  }

  /**
   * Upsert metrics to sheet
   */
  private async upsertToSheet(
    metrics: ShopifyDailyMetric,
    spreadsheetId: string,
    sheetName: string,
    credentialJson: string
  ): Promise<SyncResult<ShopifyDailyMetric>> {
    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    await sheetsService.initializeWithCredentials(credentialJson);

    // Get header row
    const headerValues = await sheetsService.getValues(spreadsheetId, sheetName, 'A1:Z1');
    const headerRow = (headerValues[0] || []) as (string | number | null)[];
    
    // Check if sheet is empty and needs header initialization
    if (isSheetEmpty(headerRow)) {
      logger.info('Sheet is empty, creating header row for Shopify schema', {
        spreadsheetId,
        sheetName
      });
      
      // Create header row with expected columns
      const headers = this.getColumnHeaders();
      await sheetsService.appendRow(spreadsheetId, sheetName, headers);
      
      // Add the data row as first data row (row 2)
      const row = this.toSheetRow(metrics);
      const appendSuccess = await sheetsService.appendRow(spreadsheetId, sheetName, row);
      
      if (appendSuccess) {
        return {
          success: true,
          mode: 'append',
          rowNumber: 2,
          id: metrics.id ?? 1,
          metrics: { ...metrics, id: metrics.id ?? 1 },
        };
      }
      
      return { success: false, error: 'Failed to initialize sheet and append data' };
    }

    // Validate schema matches expected columns
    const expectedColumns = this.getColumnHeaders();
    const schemaValidation = validateHeaderSchema(headerRow, expectedColumns);
    
    if (!schemaValidation.valid) {
      if (schemaValidation.detectedSchema && schemaValidation.detectedSchema !== 'shopify') {
        const errorMsg = `Schema mismatch: Sheet contains ${schemaValidation.detectedSchema?.toUpperCase() || 'unknown'} data but expecting SHOPIFY data. Missing columns: ${schemaValidation.missingColumns.join(', ')}. Please check your sheet to avoid overwriting data.`;
        logger.error('Schema validation failed', { 
          service: 'shopify',
          detectedSchema: schemaValidation.detectedSchema,
          missingColumns: schemaValidation.missingColumns
        });
        return { success: false, error: errorMsg };
      }
      
      if (schemaValidation.mismatchWarning) {
        logger.warn('Potential schema mismatch detected', {
          service: 'shopify',
          warning: schemaValidation.mismatchWarning
        });
        return { success: false, error: schemaValidation.mismatchWarning };
      }
    }
    
    const normalizedHeader = headerRow.map((h) =>
      typeof h === 'string' ? h.trim().toLowerCase() : ''
    );

    const dateColIndex = Math.max(normalizedHeader.findIndex((h) => h === 'date'), 1);
    const idColIndex = Math.max(normalizedHeader.findIndex((h) => h === 'id'), 0);

    const dateColLetter = this.columnLetterFromIndex(dateColIndex);
    const idColLetter = this.columnLetterFromIndex(idColIndex);

    // Check for existing date
    const dateValues = await sheetsService.getValues(
      spreadsheetId,
      sheetName,
      `${dateColLetter}2:${dateColLetter}`
    );

    let existingRowNumber: number | null = null;
    for (let i = 0; i < dateValues.length; i++) {
      if (dateValues[i]?.[0] === metrics.date) {
        existingRowNumber = i + 2;
        break;
      }
    }

    // Get ID values
    const idValues = await sheetsService.getValues(
      spreadsheetId,
      sheetName,
      `${idColLetter}2:${idColLetter}`
    );

    console.log(`📊 [Shopify Adapter] ID column raw values (first 10):`, idValues.slice(0, 10));

    // Parse all IDs from column, filtering out non-numeric and empty values
    const parsedIds = idValues
      .map((r) => {
        const val = r?.[0];
        // Handle empty strings, null, undefined
        if (val === "" || val === null || val === undefined) return NaN;
        const num = Number(val);
        return num;
      })
      .filter((n) => Number.isFinite(n) && n >= 0);
    
    console.log(`📊 [Shopify Adapter] Parsed IDs (showing ${parsedIds.length} valid IDs):`, parsedIds.slice(0, 10));
    console.log(`📊 [Shopify Adapter] Highest existing ID: ${parsedIds.length > 0 ? Math.max(...parsedIds) : 'none'}`);

    const nextId = parsedIds.length > 0 ? Math.max(...parsedIds) + 1 : 1;
    
    console.log(`📊 [Shopify Adapter] Calculated nextId: ${nextId}`);

    if (existingRowNumber) {
      // Update existing row
      const existingId = Number(idValues[existingRowNumber - 2]?.[0]) || nextId;
      const row = this.toSheetRow({ ...metrics, id: existingId });
      const lastColLetter = this.columnLetterFromIndex(row.length - 1);
      const range = sheetsService.formatRange(
        sheetName,
        `A${existingRowNumber}:${lastColLetter}${existingRowNumber}`
      );

      await sheetsService.updateRange(spreadsheetId, range, [row], sheetName);

      return {
        success: true,
        mode: 'update',
        rowNumber: existingRowNumber,
        id: existingId,
        metrics: { ...metrics, id: existingId },
      };
    }

    // Append new row
    const row = this.toSheetRow({ ...metrics, id: nextId });
    const appendSuccess = await sheetsService.appendRow(spreadsheetId, sheetName, row);

    if (appendSuccess) {
      const appendedRowNumber = Math.max(dateValues.length, idValues.length) + 2;
      return {
        success: true,
        mode: 'append',
        rowNumber: appendedRowNumber,
        id: nextId,
        metrics: { ...metrics, id: nextId },
      };
    }

    return { success: false, error: 'Failed to append row' };
  }

  /**
    * Execute sync operation
    */
   async sync(options: ShopifySyncOptions, credentialJson?: string): Promise<SyncResult<ShopifyDailyMetric>> {
     const { storeDomain, accessToken, spreadsheetId, sheetName } = options;

     if (!storeDomain) {
       return { success: false, error: 'Shopify store domain is required' };
     }
     if (!accessToken) {
       return { success: false, error: 'Shopify access token is required' };
     }

     const sourceConfig = config.sources.shopify;
     const finalSpreadsheetId = spreadsheetId || sourceConfig.spreadsheetId;
     const finalSheetName = sheetName || sourceConfig.sheetName;

    try {
      logger.info('Starting Shopify sync', { storeDomain });

      // Use combined query that matches the working curl request
      const query = this.buildQuery();

      logger.debug('Executing ShopifyQL query', {
        query: query.substring(0, 100)
      });

      const apiResponse = await this.fetchFromApi(storeDomain, accessToken, query);
      const metrics = this.parseMetrics(apiResponse);

      logger.info('Shopify metrics extracted', {
        date: metrics.date,
        orders: metrics.total_orders,
        revenue: metrics.total_revenue,
      });

      if (!credentialJson) {
        throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
      }
      const result = await this.upsertToSheet(metrics, finalSpreadsheetId, finalSheetName, credentialJson);

      logger.info('Shopify sync completed', {
        mode: result.mode,
        rowNumber: result.rowNumber,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Shopify sync failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance
export const shopifyAdapter = new ShopifyAdapter();

export { ShopifyAdapter };
