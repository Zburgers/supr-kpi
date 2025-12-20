/**
 * Shopify Adapter
 * Wraps Shopify Admin API with the adapter interface
 *
 * @module adapters/shopify
 */

import { BaseAdapter, SyncOptions, SyncResult, getYesterdayDate, toNumber } from './base.adapter.js';
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
      parseErrors?: Array<{ message?: string }> | null;
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
   * Build ShopifyQL query
   */
  private buildQuery(): string {
    return `query {
      shopifyqlQuery(query: "FROM sales, customers SHOW day AS date, orders AS total_orders, total_sales AS total_revenue, net_sales AS net_revenue, returns AS returns_amount, new_customers, returning_customers AS repeat_customers DURING yesterday TIMESERIES day") {
        tableData {
          columns { name dataType }
          rows
        }
        parseErrors { message }
      }
    }`;
  }

  /**
   * Fetch data from Shopify Admin API
   */
  private async fetchFromApi(storeDomain: string, accessToken: string): Promise<ShopifyQlResponse> {
    const domain = this.sanitizeStoreDomain(storeDomain);
    if (!domain) {
      throw new Error('Invalid store domain');
    }

    const url = `https://${domain}/admin/api/${this.apiVersion}/graphql.json`;
    const query = this.buildQuery();

    logger.debug('Fetching Shopify data', { domain });

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
      throw new Error(`Shopify API error ${response.status}: ${text}`);
    }

    return (await response.json()) as ShopifyQlResponse;
  }

  /**
   * Parse API response into metrics
   */
  private parseMetrics(apiResponse: ShopifyQlResponse): ShopifyDailyMetric {
    const shopifyql = apiResponse.data?.shopifyqlQuery;

    if (!shopifyql) {
      throw new Error('ShopifyQL response missing data');
    }

    if (shopifyql.parseErrors?.length) {
      const messages = shopifyql.parseErrors.map((e) => e.message || 'Unknown').join('; ');
      throw new Error(`ShopifyQL parse errors: ${messages}`);
    }

    const table = shopifyql.tableData;
    if (!table || !table.rows?.length) {
      throw new Error('ShopifyQL returned no rows for yesterday');
    }

    const firstRow = table.rows[0];

    // Try to find date - prefer 'date', fallback to 'day'
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
    sheetName: string
  ): Promise<SyncResult<ShopifyDailyMetric>> {
    await sheetsService.initialize();

    // Get header row
    const headerValues = await sheetsService.getValues(spreadsheetId, sheetName, 'A1:Z1');
    const headerRow = (headerValues[0] || []) as (string | number | null)[];
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
  async sync(options: ShopifySyncOptions): Promise<SyncResult<ShopifyDailyMetric>> {
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

      const apiResponse = await this.fetchFromApi(storeDomain, accessToken);
      const metrics = this.parseMetrics(apiResponse);

      logger.info('Shopify metrics extracted', {
        date: metrics.date,
        orders: metrics.total_orders,
        revenue: metrics.total_revenue,
      });

      const result = await this.upsertToSheet(metrics, finalSpreadsheetId, finalSheetName);

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
