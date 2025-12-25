/**
 * Meta Ads Adapter
 * Wraps the existing Meta service with the adapter interface
 *
 * @module adapters/meta
 */

import { BaseAdapter, SyncOptions, SyncResult, getYesterdayDate, toNumber, validateHeaderSchema, isSheetEmpty } from './base.adapter.js';
import { MetaDailyMetric, IsoDate } from '../types/etl.js';
import { sheetsService } from '../services/sheets.js';
import { logger, events } from '../lib/logger.js';
import { config } from '../config/index.js';

/**
 * Meta-specific sync options
 */
export interface MetaSyncOptions extends SyncOptions {
  /** Meta Graph API access token */
  accessToken: string;
  /** Meta Ad Account ID */
  accountId: string;
}

/**
 * Meta API response structure
 */
interface MetaAction {
  action_type: string;
  value: string;
}

interface MetaApiResponse {
  data: Array<{
    date_start: string;
    date_stop: string;
    spend: string;
    reach: string;
    impressions: string;
    clicks: string;
    actions?: MetaAction[];
    action_values?: MetaAction[];
  }>;
}

/**
 * Meta Ads adapter implementation
 */
class MetaAdapter implements BaseAdapter<MetaDailyMetric, MetaSyncOptions> {
  readonly source = 'meta' as const;

  private readonly adAccountId = process.env.META_AD_ACCOUNT_ID || 'act_1458189648725469';
  private readonly apiVersion = 'v24.0';

  /**
   * Column headers for meta_raw_daily sheet
   */
  getColumnHeaders(): string[] {
    return [
      'id',
      'date',
      'spend',
      'reach',
      'impressions',
      'clicks',
      'landing_page_views',
      'add_to_cart',
      'initiate_checkout',
      'purchases',
      'revenue',
    ];
  }

  /**
   * Validate adapter configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!process.env.META_ACCESS_TOKEN) {
      errors.push('META_ACCESS_TOKEN not set');
    }
    if (!process.env.META_AD_ACCOUNT_ID && !this.adAccountId) {
      errors.push('META_AD_ACCOUNT_ID not set');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Pick first matching action from actions array
   */
  private pickAction(actions: MetaAction[] | undefined, types: string[]): number {
    if (!actions) return 0;
    for (const type of types) {
      const hit = actions.find((a) => a.action_type === type);
      if (hit) return toNumber(hit.value);
    }
    return 0;
  }

  /**
   * Pick canonical revenue source (avoid double-counting)
   */
  private pickRevenue(actionValues: MetaAction[] | undefined): { value: number; source: string } {
    const purchaseVariants = [
      'purchase',
      'offsite_conversion.fb_pixel_purchase',
      'omni_purchase',
      'onsite_web_purchase',
      'onsite_web_app_purchase',
      'web_in_store_purchase',
    ];

    if (!actionValues) return { value: 0, source: 'NO_DATA' };

    for (const variant of purchaseVariants) {
      const entry = actionValues.find((av) => av.action_type === variant);
      if (entry) {
        const value = toNumber(entry.value);
        if (value > 0) {
          return { value, source: variant };
        }
      }
    }

    return { value: 0, source: 'NO_PURCHASE_FOUND' };
  }

  /**
   * Fetch data from Meta Graph API
   */
  private async fetchFromApi(accessToken: string, accountId: string, targetDate: IsoDate): Promise<MetaApiResponse> {
    const fields = 'date_start,date_stop,spend,reach,impressions,clicks,actions,action_values';
    const url = `https://graph.facebook.com/${this.apiVersion}/${accountId}/insights?` +
      `time_increment=1&date_preset=yesterday&action_breakdowns=action_type&fields=${fields}` +
      `&access_token=${encodeURIComponent(accessToken)}`;

    logger.debug('Fetching Meta insights', { accountId, targetDate });

    const response = await fetch(url);
    const text = await response.text();

    if (!response.ok) {
      // Check for token expiry
      if (response.status === 401 || text.includes('OAuthException')) {
        events.tokenExpired('meta');
        throw new Error('Meta access token expired or invalid');
      }
      // Check for rate limiting
      if (response.status === 429) {
        events.rateLimited('meta');
        throw new Error('Meta API rate limited');
      }
      throw new Error(`Meta API error ${response.status}: ${text}`);
    }

    return JSON.parse(text) as MetaApiResponse;
  }

  /**
   * Parse API response into metrics
   */
  private parseMetrics(apiResponse: MetaApiResponse): MetaDailyMetric {
    const data = apiResponse.data?.[0];
    if (!data) {
      throw new Error('No Meta data returned for yesterday');
    }

    const { value: revenue, source: revenueSource } = this.pickRevenue(data.action_values);
    logger.debug('Meta revenue source', { source: revenueSource, value: revenue });

    return {
      source: 'meta',
      date: data.date_start,
      spend: toNumber(data.spend),
      reach: toNumber(data.reach),
      impressions: toNumber(data.impressions),
      clicks: toNumber(data.clicks),
      landing_page_views: this.pickAction(data.actions, [
        'landing_page_view',
        'omni_landing_page_view',
      ]),
      add_to_cart: this.pickAction(data.actions, [
        'add_to_cart',
        'offsite_conversion.fb_pixel_add_to_cart',
        'omni_add_to_cart',
      ]),
      initiate_checkout: this.pickAction(data.actions, [
        'initiate_checkout',
        'offsite_conversion.fb_pixel_initiate_checkout',
        'omni_initiated_checkout',
      ]),
      purchases: this.pickAction(data.actions, [
        'purchase',
        'offsite_conversion.fb_pixel_purchase',
        'omni_purchase',
      ]),
      revenue,
    };
  }

  /**
   * Convert metrics to sheet row
   */
  private toSheetRow(metrics: MetaDailyMetric): (string | number)[] {
    return [
      metrics.id ?? '',
      metrics.date,
      metrics.spend,
      metrics.reach,
      metrics.impressions,
      metrics.clicks,
      metrics.landing_page_views,
      metrics.add_to_cart,
      metrics.initiate_checkout,
      metrics.purchases,
      metrics.revenue,
    ];
  }

  /**
   * Upsert metrics to sheet
   */
  private async upsertToSheet(
    metrics: MetaDailyMetric,
    spreadsheetId: string,
    sheetName: string,
    credentialJson: string
  ): Promise<SyncResult<MetaDailyMetric>> {
    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    await sheetsService.initializeWithCredentials(credentialJson);

    // Get header row to find column indices
    const headerValues = await sheetsService.getValues(spreadsheetId, sheetName, 'A1:Z1');
    const headerRow = (headerValues[0] || []) as (string | number | null)[];
    
    // Check if sheet is empty and needs header initialization
    if (isSheetEmpty(headerRow)) {
      logger.info('Sheet is empty, creating header row for Meta schema', {
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
      if (schemaValidation.detectedSchema && schemaValidation.detectedSchema !== 'meta') {
        const errorMsg = `Schema mismatch: Sheet contains ${schemaValidation.detectedSchema?.toUpperCase() || 'unknown'} data but expecting META data. Missing columns: ${schemaValidation.missingColumns.join(', ')}. Please check your sheet to avoid overwriting data.`;
        logger.error('Schema validation failed', { 
          service: 'meta',
          detectedSchema: schemaValidation.detectedSchema,
          missingColumns: schemaValidation.missingColumns
        });
        return { success: false, error: errorMsg };
      }
      
      if (schemaValidation.mismatchWarning) {
        logger.warn('Potential schema mismatch detected', {
          service: 'meta',
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

    console.log(`📊 [Meta Adapter] ID column raw values (first 10):`, idValues.slice(0, 10));

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
    
    console.log(`📊 [Meta Adapter] Parsed IDs (showing ${parsedIds.length} valid IDs):`, parsedIds.slice(0, 10));
    console.log(`📊 [Meta Adapter] Highest existing ID: ${parsedIds.length > 0 ? Math.max(...parsedIds) : 'none'}`);

    const nextId = parsedIds.length > 0 ? Math.max(...parsedIds) + 1 : 1;
    
    console.log(`📊 [Meta Adapter] Calculated nextId: ${nextId}`);

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
   * Execute sync operation
   */
  async sync(options: MetaSyncOptions, credentialJson?: string): Promise<SyncResult<MetaDailyMetric>> {
    const { accessToken, accountId, targetDate, spreadsheetId, sheetName } = options;

    if (!accessToken) {
      logger.error('Meta sync failed - no access token provided', {
        targetDate: targetDate || 'yesterday',
        hasSpreadsheetId: !!spreadsheetId,
        hasSheetName: !!sheetName
      });
      return { success: false, error: 'Meta access token is required' };
    }

    const sourceConfig = config.sources.meta;
    const finalSpreadsheetId = spreadsheetId || sourceConfig.spreadsheetId;
    const finalSheetName = sheetName || sourceConfig.sheetName;

    logger.info('Starting Meta sync', {
      targetDate: targetDate || 'yesterday',
      spreadsheetId: finalSpreadsheetId,
      sheetName: finalSheetName,
      hasCredentialJson: !!credentialJson
    });

    try {
      logger.debug('Fetching data from Meta API', { targetDate: targetDate || getYesterdayDate(), accountId });
      const apiResponse = await this.fetchFromApi(accessToken, accountId, targetDate || getYesterdayDate());

      logger.debug('Parsing Meta API response', { dataPoints: apiResponse.data?.length || 0 });
      const metrics = this.parseMetrics(apiResponse);

      logger.info('Meta metrics extracted', {
        date: metrics.date,
        spend: metrics.spend,
        revenue: metrics.revenue,
        reach: metrics.reach,
        impressions: metrics.impressions
      });

      logger.debug('Upserting to Google Sheet', {
        spreadsheetId: finalSpreadsheetId,
        sheetName: finalSheetName
      });
      if (!credentialJson) {
        throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
      }
      const result = await this.upsertToSheet(metrics, finalSpreadsheetId, finalSheetName, credentialJson);

      logger.info('Meta sync completed', {
        success: result.success,
        mode: result.mode,
        rowNumber: result.rowNumber,
        id: result.id,
        error: result.error
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Meta sync failed', {
        error: errorMessage,
        targetDate: targetDate || 'yesterday',
        stack: error instanceof Error ? error.stack : undefined
      });
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance
export const metaAdapter = new MetaAdapter();

export { MetaAdapter };
