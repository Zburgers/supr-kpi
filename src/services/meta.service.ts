/**
 * Meta Ads Service with Credential Management
 * 
 * Implements the same scalable credential management pattern as GA4 and Shopify services.
 * Uses stored encrypted credentials instead of passing raw credentials.
 * Uses UUID-based IDs instead of numeric IDs for better efficiency.
 * 
 * @module services/meta.service
 */

import { v4 as uuidv4 } from 'uuid';
import { sheetsService } from './sheets.js';
import { executeQuery } from '../lib/database.js';
import { decryptCredential } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import type { AppendResult, ServiceAccountStatus } from '../types/services.js';



export interface MetaRunOptions {
  spreadsheetId?: string;
  sheetName?: string;
}

export interface MetaInsightRow {
  id?: string; // Changed from number to string for UUID
  date: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  landing_page_views: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpm: number;
  ctr: number;
  // cac: number;
  metricSources?: MetricSources;
}

interface MetricSources {
  landing_page_views_source: string;
  add_to_cart_source: string;
  initiate_checkout_source: string;
  purchases_source: string;
  revenue_source: string;
}

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
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

class MetaService {
  private readonly metaEndpoint: string;

  constructor() {
    // Using a configurable endpoint instead of hardcoded one
    this.metaEndpoint = `https://graph.facebook.com/v24.0/act_1458189648725469/insights?time_increment=1&date_preset=yesterday&action_breakdowns=action_type&fields=date_start%2Cdate_stop%2Cspend%2Creach%2Cimpressions%2Cclicks%2Cactions%2Caction_values`;
  }

  private toNumber(value?: string | number | null): number {
    if (value === undefined || value === null || value === '') return 0;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  }

  private pickActionWithSource(
    actions: MetaAction[] | undefined,
    types: string[]
  ): { value: number; source: string } {
    if (!actions) return { value: 0, source: 'NOT_FOUND' };
    for (const type of types) {
      const hit = actions.find((a) => a.action_type === type);
      if (hit) return { value: this.toNumber(hit.value), source: type };
    }
    return { value: 0, source: 'NOT_FOUND' };
  }

  private pickAction(actions: MetaAction[] | undefined, types: string[]): number {
    if (!actions) return 0;
    for (const type of types) {
      const hit = actions.find((a) => a.action_type === type);
      if (hit) return this.toNumber(hit.value);
    }
    return 0;
  }

  private pickRevenue(
    actionValues: MetaAction[] | undefined
  ): { value: number; source: string } {
    const purchaseVariants = [
      'purchase',
      'offsite_conversion.fb_pixel_purchase',
      'omni_purchase',
      'onsite_web_purchase',
      'onsite_web_app_purchase',
      'web_in_store_purchase',
    ];

    if (!actionValues) return { value: 0, source: 'NO_DATA' };

    const foundVariants = purchaseVariants
      .map((variant) => {
        const entry = actionValues.find((av) => av.action_type === variant);
        return {
          type: variant,
          value: entry ? this.toNumber(entry.value) : null,
        };
      })
      .filter((v) => v.value !== null && v.value > 0);

    if (foundVariants.length === 0) {
      return { value: 0, source: 'NO_PURCHASE_FOUND' };
    }

    if (foundVariants.length > 1) {
      const values = foundVariants.map((v) => v.value ?? 0);
      const firstVal = values[0] ?? 0;
      const allEqual = values.every((v) => Math.abs(v - firstVal) < 0.01);

      if (allEqual) {
        logger.warn('DUPLICATE PURCHASE ACTION_VALUES: Found multiple purchase variants with nearly identical values.', {
          values: values.join(', ')
        });
        logger.info(`Using canonical source: ${purchaseVariants[0]} = ${foundVariants[0].value}`);
      } else {
        logger.error('CONFLICTING PURCHASE ACTION_VALUES: Found variants with DIFFERENT values', {
          variants: foundVariants
        });
        logger.error(`This is a data quality issue. Using canonical: ${foundVariants[0].type} = ${foundVariants[0].value}`);
      }
    }

    return {
      value: foundVariants[0].value || 0,
      source: foundVariants[0].type,
    };
  }

  private async fetchFromMetaApi(accessToken: string, adAccountId: string): Promise<MetaApiResponse> {
    logger.info('Fetching Meta insights from Graph API', { adAccountId });

    // Ensure the ad account ID has the 'act_' prefix required by Meta's Graph API
    const formattedAdAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    // Build the endpoint URL with the properly formatted ad account ID
    const endpoint = `https://graph.facebook.com/v24.0/${formattedAdAccountId}/insights?time_increment=1&date_preset=yesterday&action_breakdowns=action_type&fields=date_start%2Cdate_stop%2Cspend%2Creach%2Cimpressions%2Cclicks%2Cactions%2Caction_values`;
    const fullUrl = `${endpoint}&access_token=${encodeURIComponent(accessToken)}`;

    let response: Response;
    try {
      response = await fetch(fullUrl);
    } catch (fetchError) {
      logger.error('Failed to reach Meta API', { error: fetchError });
      throw new Error(`Failed to reach Meta API: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    logger.info('Meta API response received', { status: response.status });

    if (!response.ok) {
      let errorBody = '';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorJson = await response.json();
          errorBody = JSON.stringify(errorJson, null, 2);
        } else {
          errorBody = await response.text();
        }
      } catch (e) {
        errorBody = '(Could not parse error response)';
      }

      logger.error('Meta API error response', { status: response.status, errorBody });
      throw new Error(`Meta API error: HTTP ${response.status}\n${errorBody}`);
    }

    let json: MetaApiResponse;
    try {
      json = await response.json();
    } catch (parseError) {
      logger.error('Failed to parse Meta API response', { error: parseError });
      throw new Error(`Failed to parse Meta API response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    if (!json.data || json.data.length === 0) {
      logger.error('Meta API returned no data');
      throw new Error('Meta API returned no data for yesterday');
    }

    logger.info('Meta API data received', { 
      rows: json.data.length, 
      date: json.data[0].date_start,
      spend: json.data[0].spend 
    });
    return json;
  }

  private parseMetrics(apiResponse: MetaApiResponse): MetaInsightRow {
    logger.info('Parsing and normalizing Meta API response');

    const first = apiResponse.data[0];
    const actions: MetaAction[] = first.actions || [];
    const actionValues: MetaAction[] = first.action_values || [];

    logger.info('Meta API response arrays', { 
      actionsCount: actions.length, 
      actionValuesCount: actionValues.length 
    });

    const lpvResult = this.pickActionWithSource(actions, [
      'landing_page_view',
      'omni_landing_page_view',
    ]);

    const atcResult = this.pickActionWithSource(actions, [
      'add_to_cart',
      'offsite_conversion.fb_pixel_add_to_cart',
      'omni_add_to_cart',
    ]);

    const icResult = this.pickActionWithSource(actions, [
      'initiate_checkout',
      'offsite_conversion.fb_pixel_initiate_checkout',
      'omni_initiated_checkout',
    ]);

    const purchaseCountResult = this.pickActionWithSource(actions, [
      'purchase',
      'offsite_conversion.fb_pixel_purchase',
      'omni_purchase',
      'onsite_web_purchase',
      'onsite_web_app_purchase',
      'web_in_store_purchase',
    ]);

    const revenueResult = this.pickRevenue(actionValues);

    // Calculate derived metrics
    const spend = this.toNumber(first.spend);
    const impressions = this.toNumber(first.impressions);
    const clicks = this.toNumber(first.clicks);
    const revenue = revenueResult.value;
    const purchases = purchaseCountResult.value;

    // ROAS = Revenue / Spend
    const roas = spend > 0 ? revenue / spend : 0;
    // CPM = (Spend / Impressions) * 1000
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    // CTR = (Clicks / Impressions) * 100
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    // CAC = Spend / Purchases
    // const cac = purchases > 0 ? spend / purchases : 0;

    const normalized: MetaInsightRow = {
      id: uuidv4(), // Generate UUID for the ID
      date: first.date_start,
      spend: spend,
      reach: this.toNumber(first.reach),
      impressions: impressions,
      clicks: clicks,
      landing_page_views: lpvResult.value,
      add_to_cart: atcResult.value,
      initiate_checkout: icResult.value,
      purchases: purchases,
      revenue: revenue,
      roas: roas,
      cpm: cpm,
      ctr: ctr,
      // cac: cac,
      metricSources: {
        landing_page_views_source: lpvResult.source,
        add_to_cart_source: atcResult.source,
        initiate_checkout_source: icResult.source,
        purchases_source: purchaseCountResult.source,
        revenue_source: revenueResult.source,
      },
    };

    logger.info('Parsed metrics', {
      id: normalized.id,
      date: normalized.date,
      spend: normalized.spend,
      reach: normalized.reach,
      impressions: normalized.impressions,
      clicks: normalized.clicks,
      landing_page_views: normalized.landing_page_views,
      add_to_cart: normalized.add_to_cart,
      initiate_checkout: normalized.initiate_checkout,
      purchases: normalized.purchases,
      revenue: normalized.revenue,
      roas: normalized.roas,
      cpm: normalized.cpm,
      ctr: normalized.ctr,
      // cac: normalized.cac,
    });

    return normalized;
  }

  private toSheetRow(metrics: MetaInsightRow): (string | number)[] {
    const row = [
      metrics.id ?? '', // UUID as string
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
      metrics.roas,
      metrics.cpm,
      metrics.ctr,
      // metrics.cac,
    ];

    logger.info('Sheet row prepared', { row: JSON.stringify(row) });
    return row;
  }

  private columnLetterFromIndex(index: number): string {
    const safeIndex = index < 0 ? 0 : index;
    let n = safeIndex + 1;
    let letters = '';
    while (n > 0) {
      const remainder = (n - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  }

  private async upsertToSheet(
    metrics: MetaInsightRow,
    spreadsheetId: string,
    sheetName: string,
    credentialJson: string
  ): Promise<AppendResult> {
    logger.info('Upserting Meta row into Google Sheet', {
      spreadsheetId,
      sheetName,
      date: metrics.date,
      id: metrics.id, // UUID
    });

    if (!credentialJson) {
      throw new Error('Google Sheets credentials are required. Please provide credentials via the credential management system.');
    }

    await sheetsService.initializeWithCredentials(credentialJson);

    // Ensure header row exists before any operations
    const expectedHeaders = [
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
      'roas',
      'cpm',
      'ctr',
      // 'cac'
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

    // If date already exists, skip the operation entirely (don't update, just skip)
    if (existingRowNumber) {
      const existingIdCell = idValues[existingRowNumber - 2]?.[0];
      const existingId = typeof existingIdCell === 'string' ? existingIdCell : undefined;

      logger.info('Meta data already exists for date, skipping append', {
        date: metrics.date,
        existingRowNumber,
        existingId
      });
      return {
        success: true,
        mode: 'skip',
        rowNumber: existingRowNumber,
        id: existingId,
      };
    }

    // Date doesn't exist, so append a new row with a UUID
    const newId = uuidv4();
    logger.info(`Meta Generated unique id for append`, { id: newId });
    const row = this.toSheetRow({ ...metrics, id: newId });

    const appendSuccess = await sheetsService.appendRow(
      spreadsheetId,
      sheetName,
      row
    );

    if (appendSuccess) {
      const appendedRowNumber = dateValues.length + 2;
      logger.info('Appended new Meta row', {
        rowNumber: appendedRowNumber,
        date: metrics.date,
        id: newId,
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
    options?: MetaRunOptions
  ): Promise<{
    metrics: MetaInsightRow;
    appendResult: AppendResult;
    spreadsheetId: string;
    sheetName: string;
  }> {
    logger.info('Starting Meta workflow', { credentialId, userId });

    // Fetch and decrypt Meta credentials
    const credentialResult = await executeQuery(
      `SELECT encrypted_data, service FROM credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
      [credentialId, userId],
      userId
    );

    if (credentialResult.rows.length === 0) {
      throw new Error('Meta credential not found or access denied');
    }

    const credential = credentialResult.rows[0];
    if (credential.service !== 'meta') {
      throw new Error('Credential is not for Meta');
    }

    const decryptedJson = decryptCredential(credential.encrypted_data, String(userId));
    const metaCredentials = JSON.parse(decryptedJson);

    // Extract Meta-specific credentials
    const { access_token, account_id } = metaCredentials;

    if (!access_token || !account_id) {
      throw new Error('Meta credentials missing access_token or account_id');
    }

    logger.info('Fetched Meta credentials', { accountId: account_id });

    // Get sheet mapping for this user and Meta service
    const mappingResult = await executeQuery(
      `SELECT spreadsheet_id, sheet_name FROM sheet_mappings WHERE service = $1 AND user_id = $2 LIMIT 1`,
      ['meta', userId],
      userId
    );

    if (mappingResult.rows.length === 0) {
      throw new Error('No sheet mapping found for Meta service');
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

    // Fetch Meta data
    const apiResponse = await this.fetchFromMetaApi(access_token, account_id);

    // Parse and normalize the data
    const metrics = this.parseMetrics(apiResponse);

    // Verify service account so we can report status
    await sheetsService.initializeWithCredentials(sheetsDecryptedJson);
    const serviceAccount = await sheetsService.verifyServiceAccount(sheetsDecryptedJson);

    // Upsert to sheet
    const appendResult = await this.upsertToSheet(
      metrics,
      targetSpreadsheetId,
      targetSheetName,
      sheetsDecryptedJson
    );

    logger.info('Meta workflow completed', {
      id: metrics.id, // UUID
      date: metrics.date,
      appendSuccess: appendResult.success,
      mode: appendResult.mode,
    });

    return {
      metrics,
      appendResult,
      spreadsheetId: targetSpreadsheetId,
      sheetName: targetSheetName,
    };
  }
}

export const metaService = new MetaService();