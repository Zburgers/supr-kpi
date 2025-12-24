/**
 * GA4 Adapter
 * Wraps Google Analytics 4 API with the adapter interface
 *
 * @module adapters/ga4
 */

import { BaseAdapter, SyncOptions, SyncResult, getYesterdayDate, toNumber } from './base.adapter.js';
import { Ga4DailyMetric, IsoDate } from '../types/etl.js';
import { sheetsService } from '../services/sheets.js';
import { logger, events } from '../lib/logger.js';
import { config } from '../config/index.js';

/**
 * GA4-specific sync options
 */
export interface Ga4SyncOptions extends SyncOptions {
  /** Google OAuth access token */
  accessToken: string;
  /** GA4 property ID */
  propertyId: string;
}

/**
 * GA4 API response structure
 */
interface Ga4RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
}

/**
 * GA4 adapter implementation
 */
class Ga4Adapter implements BaseAdapter<Ga4DailyMetric, Ga4SyncOptions> {
  readonly source = 'ga4' as const;

  /**
   * Column headers for ga4_raw_daily sheet
   */
  getColumnHeaders(): string[] {
    return [
      'id',
      'date',
      'sessions',
      'users',
      'add_to_cart',
      'purchases',
      'revenue',
      'bounce_rate',
    ];
  }

  /**
   * Validate adapter configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!process.env.GOOGLE_ACCESS_TOKEN) {
      errors.push('GOOGLE_ACCESS_TOKEN not set');
    }
    if (!process.env.GA4_PROPERTY_ID) {
      errors.push('GA4_PROPERTY_ID not set');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Fetch data from GA4 Data API
   */
  private async fetchFromApi(accessToken: string, propertyId: string): Promise<Ga4RunReportResponse> {
    const body = {
      dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'addToCarts' },
        { name: 'ecommercePurchases' },
        { name: 'totalRevenue' },
        { name: 'bounceRate' },
      ],
      keepEmptyRows: true,
    };

    logger.debug('Fetching GA4 report', { propertyId });

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      }
    );

    const text = await response.text();

    if (!response.ok) {
      // Check for token expiry
      if (response.status === 401 || text.includes('UNAUTHENTICATED')) {
        events.tokenExpired('ga4');
        throw new Error('GA4 access token expired or invalid');
      }
      // Check for quota exceeded
      if (response.status === 429 || text.includes('RESOURCE_EXHAUSTED')) {
        events.rateLimited('ga4');
        throw new Error('GA4 API quota exceeded');
      }
      throw new Error(`GA4 API error ${response.status}: ${text}`);
    }

    return text ? JSON.parse(text) : {};
  }

  /**
   * Parse API response into metrics
   */
  private parseMetrics(apiResponse: Ga4RunReportResponse): Ga4DailyMetric {
    const firstRow = apiResponse.rows?.[0];
    if (!firstRow) {
      throw new Error('No GA4 data returned for yesterday');
    }

    const rawDate = firstRow.dimensionValues?.[0]?.value || '';
    // Convert YYYYMMDD to YYYY-MM-DD
    const date = /^\d{8}$/.test(rawDate)
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;

    const metrics = firstRow.metricValues || [];

    return {
      source: 'ga4',
      date,
      sessions: toNumber(metrics[0]?.value),
      users: toNumber(metrics[1]?.value),
      add_to_cart: toNumber(metrics[2]?.value),
      purchases: toNumber(metrics[3]?.value),
      revenue: toNumber(metrics[4]?.value),
      bounce_rate: toNumber(metrics[5]?.value),
    };
  }

  /**
   * Convert metrics to sheet row
   */
  private toSheetRow(metrics: Ga4DailyMetric): (string | number)[] {
    return [
      metrics.id ?? '',
      metrics.date,
      metrics.sessions,
      metrics.users,
      metrics.add_to_cart,
      metrics.purchases,
      metrics.revenue,
      metrics.bounce_rate,
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
   * Upsert metrics to sheet (skip if exists)
   */
  private async upsertToSheet(
    metrics: Ga4DailyMetric,
    spreadsheetId: string,
    sheetName: string,
    credentialJson: string
  ): Promise<SyncResult<Ga4DailyMetric>> {
    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    await sheetsService.initializeWithCredentials(credentialJson);

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

    if (existingRowNumber) {
      // GA4 skips if date exists (idempotent - no update)
      const existingId = Number(idValues[existingRowNumber - 2]?.[0]);
      return {
        success: true,
        mode: 'skip',
        rowNumber: existingRowNumber,
        id: Number.isFinite(existingId) ? existingId : undefined,
        metrics: { ...metrics, id: Number.isFinite(existingId) ? existingId : undefined },
      };
    }

    // Append new row
    console.log(`📊 [GA4 Adapter] ID column raw values (first 10):`, idValues.slice(0, 10));

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
    
    console.log(`📊 [GA4 Adapter] Parsed IDs (showing ${parsedIds.length} valid IDs):`, parsedIds.slice(0, 10));
    console.log(`📊 [GA4 Adapter] Highest existing ID: ${parsedIds.length > 0 ? Math.max(...parsedIds) : 'none'}`);

    const nextId = parsedIds.length > 0 ? Math.max(...parsedIds) + 1 : 1;
    
    console.log(`📊 [GA4 Adapter] Calculated nextId: ${nextId}`);

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
  async sync(options: Ga4SyncOptions, credentialJson?: string): Promise<SyncResult<Ga4DailyMetric>> {
    const { accessToken, propertyId, spreadsheetId, sheetName } = options;

    if (!accessToken) {
      return { success: false, error: 'Google access token is required' };
    }
    if (!propertyId) {
      return { success: false, error: 'GA4 property ID is required' };
    }

    const sourceConfig = config.sources.ga4;
    const finalSpreadsheetId = spreadsheetId || sourceConfig.spreadsheetId;
    const finalSheetName = sheetName || sourceConfig.sheetName;

    try {
      logger.info('Starting GA4 sync', { propertyId });

      const apiResponse = await this.fetchFromApi(accessToken, propertyId);
      const metrics = this.parseMetrics(apiResponse);

      logger.info('GA4 metrics extracted', {
        date: metrics.date,
        sessions: metrics.sessions,
        revenue: metrics.revenue,
      });

      if (!credentialJson) {
        throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
      }
      const result = await this.upsertToSheet(metrics, finalSpreadsheetId, finalSheetName, credentialJson);

      logger.info('GA4 sync completed', {
        mode: result.mode,
        rowNumber: result.rowNumber,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('GA4 sync failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance
export const ga4Adapter = new Ga4Adapter();

export { Ga4Adapter };
