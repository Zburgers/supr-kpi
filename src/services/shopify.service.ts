/**
 * Shopify Analytics Service
 *
 * Handles Shopify data fetching and appending to Google Sheets
 * Uses stored credentials for authentication via the database
 *
 * Security:
 * - All credential access is filtered by user_id
 * - Credentials are decrypted only for the operation
 * - All sensitive data is encrypted at rest
 *
 * @module services/shopify
 */

import { v4 as uuidv4 } from 'uuid';
import { sheetsService } from './sheets.js';
import { executeQuery } from '../lib/database.js';
import { decryptCredential } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import type { AppendResult, ServiceAccountStatus } from '../types/services.js';

export interface ShopifyMetricsRow {
  id?: string; // Changed to string for UUID
  date: string;
  total_orders: number;
  total_revenue: number;
  net_revenue: number;
  total_returns: number;
  new_customers: number;
  repeat_customers: number;
}

interface ShopifyQlColumn {
  name: string;
  dataType?: string;
  displayName?: string;
}

interface ShopifyQlTableData {
  columns: ShopifyQlColumn[];
  rows: Array<Record<string, string | number | null>>;
}

interface ShopifyQlResponse {
  data?: {
    shopifyqlQuery?: {
      tableData?: ShopifyQlTableData | null;
      parseErrors?: Array<{
        code?: string;
        message?: string;
        range?: { start?: number; end?: number };
      }> | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

export interface ShopifyRunOptions {
  spreadsheetId?: string;
  sheetName?: string;
}

// TODO: Extend this later to support date range queries beyond just yesterday
// Suggestions for future enhancement:
// - Add date range parameters (start_date, end_date)
// - Add pagination for large date ranges
// - Add support for historical data backfill
const SHOPIFYQL_QUERY = `query { shopifyqlQuery(query: "FROM sales, customers SHOW day AS date, orders AS total_orders, total_sales AS total_revenue, net_sales AS net_revenue, returns AS returns_amount, new_customers, returning_customers AS repeat_customers DURING yesterday TIMESERIES day") { tableData { columns { name dataType displayName } rows } parseErrors } }`;

class ShopifyService {
  private toNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private sanitizeStoreDomain(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    const withoutProto = trimmed.replace(/^https?:\/\//i, '');
    return withoutProto.split('/')[0];
  }

  /**
   * Generate a UUID for the row identifier.
   */
  private generateUniqueId(): string {
    return uuidv4();
  }

  private async fetchShopifyQL(
    storeDomain: string,
    accessToken: string
  ): Promise<ShopifyQlResponse> {
    const domain = this.sanitizeStoreDomain(storeDomain);
    if (!domain) {
      throw new Error('Store domain is required (e.g., my-shop.myshopify.com)');
    }

    const SHOPIFY_API_VERSION = '2025-10';
    const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    logger.info('Fetching ShopifyQL data', { url });

    // Construct the request body manually to avoid encoding issues
    const requestBody = JSON.stringify({
      query: SHOPIFYQL_QUERY,
      variables: {},
    });

    logger.debug('ShopifyQL request size', { bytes: requestBody.length });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Shopify-Access-Token': accessToken,
      },
      body: requestBody,
    });

    logger.info('ShopifyQL response', { status: response.status });

    if (!response.ok) {
      let body = '';
      try {
        body = await response.text();
      } catch {
        body = '(failed to read error body)';
      }
      throw new Error(`Shopify API error: HTTP ${response.status} ${response.statusText}\n${body}`);
    }

    try {
      return (await response.json()) as ShopifyQlResponse;
    } catch (error) {
      throw new Error(
        `Failed to parse ShopifyQL response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseMetrics(apiResponse: ShopifyQlResponse): ShopifyMetricsRow {
    const shopifyql = apiResponse.data?.shopifyqlQuery;

    if (!shopifyql) {
      throw new Error('ShopifyQL response missing shopifyqlQuery data');
    }

    if (shopifyql.parseErrors && shopifyql.parseErrors.length > 0) {
      const messages = shopifyql.parseErrors
        .map((e) => e.message || 'Unknown parse error')
        .join('; ');
      throw new Error(`ShopifyQL parse errors: ${messages}`);
    }

    const table = shopifyql.tableData;
    if (!table || !Array.isArray(table.rows) || table.rows.length === 0) {
      throw new Error('ShopifyQL returned no rows for yesterday');
    }

    const columns = table.columns || [];
    const firstRow = (table.rows[0] as Record<string, string | number | null>) || {};

    logger.debug('ShopifyQL response', {
      columns: columns.map((c) => c?.name),
      firstRow,
    });

    const getValue = (name: string): string | number | null => {
      return firstRow[name] ?? null;
    };

    // Try to find date column - prefer 'date', fallback to 'day'
    let dateRaw = getValue('date');
    if (!dateRaw) {
      dateRaw = getValue('day');
      if (dateRaw) {
        logger.debug('Using day column as date', { date: dateRaw });
      }
    }

    if (!dateRaw) {
      throw new Error(
        `ShopifyQL row missing date/day value. Available fields: ${Object.keys(firstRow).join(', ')}`
      );
    }

    const metrics: ShopifyMetricsRow = {
      date: String(dateRaw),
      total_orders: this.toNumber(getValue('total_orders')),
      total_revenue: this.toNumber(getValue('total_revenue')),
      net_revenue: this.toNumber(getValue('net_revenue')),
      total_returns: Math.abs(this.toNumber(getValue('returns_amount'))),
      new_customers: this.toNumber(getValue('new_customers')),
      repeat_customers: this.toNumber(getValue('repeat_customers')),
    };

    logger.info('Parsed Shopify metrics', {
      date: metrics.date,
      orders: metrics.total_orders,
      revenue: metrics.total_revenue,
    });

    return metrics;
  }

  private toSheetRow(metrics: ShopifyMetricsRow): (string | number)[] {
    const row = [
      metrics.id ?? '',
      metrics.date,
      metrics.total_orders,
      metrics.total_revenue,
      metrics.net_revenue,
      metrics.total_returns,
      metrics.new_customers,
      metrics.repeat_customers,
    ];
    logger.debug('Shopify sheet row', { row });
    return row;
  }

  private async upsertToSheet(
    metrics: ShopifyMetricsRow,
    spreadsheetId: string,
    sheetName: string,
    credentialJson: string
  ): Promise<AppendResult> {
    logger.info('Upserting Shopify row into Google Sheet', {
      spreadsheetId,
      sheetName,
      date: metrics.date,
    });

    if (!credentialJson) {
      throw new Error('Google Sheets credentials are required. Please provide credentials via the credential management system.');
    }

    await sheetsService.initializeWithCredentials(credentialJson);

    // Ensure header row exists before any operations
    const expectedHeaders = [
      'id',
      'date',
      'total_orders',
      'total_revenue',
      'net_revenue',
      'total_returns',
      'new_customers',
      'repeat_customers'
    ];
    await sheetsService.ensureHeaderRow(spreadsheetId, sheetName, expectedHeaders);

    // Get header row
    const headerValues = await sheetsService.getValues(spreadsheetId, sheetName, 'A1:Z1');
    const headerRow = (headerValues[0] || []) as (string | number | null)[];
    const normalizedHeader = headerRow.map((h) =>
      typeof h === 'string' ? h.trim().toLowerCase() : ''
    );

    const dateHeaderIndex = normalizedHeader.findIndex((h) => h === 'date');
    const idHeaderIndex = normalizedHeader.findIndex((h) => h === 'id');

    const dateColIndex = dateHeaderIndex >= 0 ? dateHeaderIndex : 1;
    const idColIndex = idHeaderIndex >= 0 ? idHeaderIndex : 0;

    const dateColLetter = String.fromCharCode(65 + dateColIndex);
    const idColLetter = String.fromCharCode(65 + idColIndex);

    // Check for existing date
    const dateValues = await sheetsService.getValues(
      spreadsheetId,
      sheetName,
      `${dateColLetter}2:${dateColLetter}`
    );

    let existingRowNumber: number | null = null;
    for (let i = 0; i < dateValues.length; i++) {
      const cell = dateValues[i]?.[0];
      if (cell === metrics.date) {
        existingRowNumber = i + 2;
        break;
      }
    }

    // Get ID values for existing ID
    const idValues = await sheetsService.getValues(
      spreadsheetId,
      sheetName,
      `${idColLetter}2:${idColLetter}`
    );

    let existingId: string | null = null;
    if (existingRowNumber !== null) {
      const existingIdCell = idValues[existingRowNumber - 2]?.[0];
      if (existingIdCell && typeof existingIdCell === 'string') {
        existingId = existingIdCell;
      }
    }

    // If date already exists, skip the operation entirely (don't update, just skip)
    if (existingRowNumber) {
      logger.info('Shopify data already exists for date, skipping append', {
        date: metrics.date,
        existingRowNumber,
        existingId
      });
      return {
        success: true,
        mode: 'skip',
        rowNumber: existingRowNumber,
        id: existingId || undefined,
      };
    }

    // Date doesn't exist, so append a new row with a UUID
    const newId = this.generateUniqueId();
    logger.info(`Shopify Generated unique id for append`, { id: newId });
    const row = this.toSheetRow({ ...metrics, id: newId });

    // Append new row
    const appendSuccess = await sheetsService.appendRow(spreadsheetId, sheetName, row);

    if (appendSuccess) {
      const appendedRowNumber = dateValues.length + 2;
      logger.info('Appended Shopify row', {
        rowNumber: appendedRowNumber,
        id: newId,
        date: metrics.date,
      });
      return {
        success: true,
        mode: 'append',
        rowNumber: appendedRowNumber,
        id: newId,
      };
    }

    return { success: false, error: 'Append returned false' };
  }

  async runWorkflow(
    credentialId: number,
    userId: number,
    options?: ShopifyRunOptions
  ): Promise<{
    metrics: ShopifyMetricsRow;
    appendResult: AppendResult;
    spreadsheetId: string;
    sheetName: string;
  }> {
    logger.info('Starting Shopify workflow', { credentialId, userId });

    // Fetch and decrypt Shopify credentials
    const credentialResult = await executeQuery(
      `SELECT encrypted_data, service FROM credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
      [credentialId, userId],
      userId
    );

    if (credentialResult.rows.length === 0) {
      throw new Error('Shopify credential not found or access denied');
    }

    const credential = credentialResult.rows[0];
    if (credential.service !== 'shopify') {
      throw new Error('Credential is not for Shopify');
    }

    const decryptedJson = decryptCredential(credential.encrypted_data, String(userId));
    const shopifyCredentials = JSON.parse(decryptedJson);

    // Extract Shopify-specific credentials
    const { shop_url, access_token } = shopifyCredentials;

    if (!shop_url || !access_token) {
      throw new Error('Shopify credentials missing shop_url or access_token');
    }

    // Extract the domain from shop_url
    const store_domain = shop_url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    logger.info('Fetched Shopify credentials', { storeDomain: store_domain });

    // Get sheet mapping for this user and Shopify service
    const mappingResult = await executeQuery(
      `SELECT spreadsheet_id, sheet_name FROM sheet_mappings WHERE service = $1 AND user_id = $2 LIMIT 1`,
      ['shopify', userId],
      userId
    );

    if (mappingResult.rows.length === 0) {
      throw new Error('No sheet mapping found for Shopify service');
    }

    const mapping = mappingResult.rows[0];
    const targetSpreadsheetId = options?.spreadsheetId || mapping.spreadsheet_id;
    const targetSheetName = options?.sheetName || mapping.sheet_name;

    logger.info('Using sheet mapping', {
      spreadsheetId: targetSpreadsheetId,
      sheetName: targetSheetName
    });

    // Get Google Sheets credentials for this user
    const sheetsCredentialResult = await executeQuery(
      `SELECT encrypted_data, service FROM credentials WHERE service = $1 AND user_id = $2 AND verified = true AND deleted_at IS NULL LIMIT 1`,
      ['google_sheets', userId],
      userId
    );

    if (sheetsCredentialResult.rows.length === 0) {
      throw new Error('No verified Google Sheets credentials found');
    }

    const sheetsCredential = sheetsCredentialResult.rows[0];
    const sheetsDecryptedJson = decryptCredential(sheetsCredential.encrypted_data, String(userId));

    // Fetch Shopify data
    const apiResponse = await this.fetchShopifyQL(store_domain, access_token);
    const metrics = this.parseMetrics(apiResponse);

    const appendResult = await this.upsertToSheet(
      metrics,
      targetSpreadsheetId,
      targetSheetName,
      sheetsDecryptedJson
    );

    if (appendResult.id !== undefined) {
      metrics.id = appendResult.id;
    }

    logger.info('Shopify workflow completed', {
      credentialId,
      userId,
      date: metrics.date,
      mode: appendResult.mode,
      rowNumber: appendResult.rowNumber,
      id: appendResult.id,
    });

    return {
      metrics,
      appendResult,
      spreadsheetId: targetSpreadsheetId,
      sheetName: targetSheetName,
    };
  }
}

export const shopifyService = new ShopifyService();