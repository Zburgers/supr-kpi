/**
 * GA4 Analytics Service
 * Handles fetching data from Google Analytics 4 and appending to Google Sheets
 * 
 * @module services/ga4
 */

import { v4 as uuidv4 } from 'uuid';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { executeQuery } from '../lib/database.js';
import { decryptCredential } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { sheetsService } from './sheets.js';
import type { AppendResult, ServiceAccountStatus } from '../types/services.js';

export interface GoogleAnalyticsRow {
  id?: string; // Changed to string for UUID
  date: string;
  sessions: number;
  users: number;
  add_to_cart: number;
  purchases: number;
  revenue: number;
  ad_spend: number;
  bounce_rate: number;
}

interface GaRunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
}

interface Ga4Credentials {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
  property_id: string;
}

class Ga4Service {
  private toNumber(value?: string | number | null): number {
    if (value === undefined || value === null || value === "") return 0;
    const num = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  }

  private columnLetterFromIndex(index: number): string {
    const safeIndex = index < 0 ? 0 : index;
    let n = safeIndex + 1;
    let letters = "";
    while (n > 0) {
      const remainder = (n - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  }

  /**
   * Generate a UUID for the row identifier.
   */
  private generateUniqueId(): string {
    return uuidv4();
  }

  /**
   * Fetch GA4 report data using service account authentication
   */
  async fetchGaReport(credentials: Ga4Credentials): Promise<GaRunReportResponse> {
    const controller = new AbortController();
    const timeoutMs = 10000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      // Create JWT auth client for service account
      const auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });

      // Initialize the Analytics Data API client
      const analyticsData = google.analyticsdata({ 
        version: 'v1beta', 
        auth: auth as any 
      });

      // Prepare the request body
      const requestBody = {
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "addToCarts" },
          { name: "ecommercePurchases" },
          { name: "totalRevenue" },
          { name: "bounceRate" },
          { name: "advertiserAdCost" },
        ],
        keepEmptyRows: true,
      };

      timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      logger.info('Fetching GA4 report', {
        propertyId: credentials.property_id,
        clientEmail: credentials.client_email
      });

      // Make the API call
      const response = await (analyticsData.properties.runReport as any)(
        {
          property: `properties/${credentials.property_id}`,
          requestBody,
          signal: controller.signal,
        },
        { signal: controller.signal }
      );

      if (timeoutId) clearTimeout(timeoutId);

      logger.info('GA4 report fetched successfully', {
        propertyId: credentials.property_id,
        rowCount: response.data.rows?.length || 0
      });

      return response.data as GaRunReportResponse;
    } catch (error) {
      logger.error('Failed to fetch GA4 report', {
        propertyId: credentials.property_id,
        clientEmail: credentials.client_email,
        error: error instanceof Error ? error.message : String(error)
      });
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`GA4 report request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Parse GA4 API response into GoogleAnalyticsRow format
   */
  private parseMetrics(apiResponse: GaRunReportResponse): GoogleAnalyticsRow {
    const firstRow = apiResponse.rows?.[0];
    if (!firstRow) {
      throw new Error("No GA4 rows returned for yesterday");
    }

    const rawDate = firstRow.dimensionValues?.[0]?.value || "";
    const date = /^\d{8}$/.test(rawDate)
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;
    const metrics = firstRow.metricValues || [];

    return {
      id: this.generateUniqueId(), // Generate UUID
      date,
      sessions: this.toNumber(metrics[0]?.value),
      users: this.toNumber(metrics[1]?.value),
      add_to_cart: this.toNumber(metrics[2]?.value),
      purchases: this.toNumber(metrics[3]?.value),
      revenue: this.toNumber(metrics[4]?.value),
      bounce_rate: this.toNumber(metrics[5]?.value),
      ad_spend: this.toNumber(metrics[6]?.value),
    };
  }

  /**
   * Convert metrics to sheet row format
   */
  private toSheetRow(metrics: GoogleAnalyticsRow): (string | number)[] {
    return [
      metrics.id ?? "",
      metrics.date,
      metrics.sessions,
      metrics.users,
      metrics.add_to_cart,
      metrics.purchases,
      metrics.revenue,
      metrics.bounce_rate,
      metrics.ad_spend,
    ];
  }

  /**
   * Check if date already exists in sheet and append if not
   */
  async upsertIfMissing(
    metrics: GoogleAnalyticsRow,
    spreadsheetId: string,
    sheetName: string,
    credentialJson: string
  ): Promise<AppendResult> {
    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    await sheetsService.initializeWithCredentials(credentialJson);

    // Ensure header row exists before any operations
    const expectedHeaders = [
      'id',
      'date',
      'sessions',
      'users',
      'add_to_cart',
      'purchases',
      'revenue',
      'bounce_rate',
      'ad_spend'
    ];
    await sheetsService.ensureHeaderRow(spreadsheetId, sheetName, expectedHeaders);

    const headerValues = await sheetsService.getValues(
      spreadsheetId,
      sheetName,
      "A1:Z1"
    );
    const headerRow = (headerValues[0] || []) as (string | number | null)[];
    const normalizedHeader = headerRow.map((h) =>
      typeof h === "string" ? h.trim().toLowerCase() : ""
    );

    const dateHeaderIndex = normalizedHeader.findIndex((h) => h === "date");
    const idHeaderIndex = normalizedHeader.findIndex((h) => h === "id");

    const dateColIndex = dateHeaderIndex >= 0 ? dateHeaderIndex : 1;
    const idColIndex = idHeaderIndex >= 0 ? idHeaderIndex : 0;

    const dateColLetter = this.columnLetterFromIndex(dateColIndex);
    const idColLetter = this.columnLetterFromIndex(idColIndex);

    const dateValues = await sheetsService.getValues(
      spreadsheetId,
      sheetName,
      `${dateColLetter}2:${dateColLetter}`
    );

    let existingRowNumber: number | null = null;
    for (let i = 0; i < dateValues.length; i++) {
      const cell = dateValues[i]?.[0];
      if (cell === metrics.date) {
        existingRowNumber = i + 2; // headers offset
        break;
      }
    }

    const idValues = await sheetsService.getValues(
      spreadsheetId,
      sheetName,
      `${idColLetter}2:${idColLetter}`
    );

    if (existingRowNumber) {
      const existingIdCell = idValues[existingRowNumber - 2]?.[0];
      const existingId = typeof existingIdCell === 'string' ? existingIdCell : undefined;
      logger.info('GA4 data already exists for date, skipping append', {
        date: metrics.date,
        existingRowNumber,
        existingId
      });
      return {
        success: true,
        mode: "skip",
        rowNumber: existingRowNumber,
        id: existingId,
      };
    }

    const newId = this.generateUniqueId();

    logger.info(`GA4 Generated unique id for append`, { id: newId });
    const row = this.toSheetRow({ ...metrics, id: newId });

    const appendSuccess = await sheetsService.appendRow(
      spreadsheetId,
      sheetName,
      row
    );

    if (appendSuccess) {
      const appendedRowNumber = Math.max(dateValues.length, idValues.length) + 2;
      logger.info('GA4 data appended successfully', {
        date: metrics.date,
        rowNumber: appendedRowNumber,
        id: newId
      });
      return {
        success: true,
        mode: "append",
        rowNumber: appendedRowNumber,
        id: newId,
      };
    }

    logger.warn('GA4 append operation returned false', {
      date: metrics.date
    });
    return { success: false, error: "Append returned false" };
  }

  /**
   * Main method to run GA4 workflow: fetch data and append to sheet
   */
  async runWorkflow(
    credentialId: number,
    userId: number,
    options?: { spreadsheetId?: string; sheetName?: string }
  ): Promise<{
    metrics: GoogleAnalyticsRow;
    appendResult: AppendResult;
    spreadsheetId: string;
    sheetName: string;
  }> {
    try {
      logger.info('Starting GA4 workflow', {
        credentialId,
        userId,
        options
      });

      // Get and decrypt GA4 credentials
      const credentialResult = await executeQuery(
        `SELECT encrypted_data, service FROM credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
        [credentialId, userId],
        userId
      );

      if (credentialResult.rows.length === 0) {
        throw new Error('GA4 credential not found or access denied');
      }

      const credential = credentialResult.rows[0];
      if (credential.service !== 'ga4') {
        throw new Error('Credential is not for GA4');
      }

      const decryptedJson = decryptCredential(credential.encrypted_data, String(userId));
      const ga4Credentials = JSON.parse(decryptedJson) as Ga4Credentials;

      // Validate required fields
      if (!ga4Credentials.property_id) {
        throw new Error('GA4 property_id is required in credentials');
      }

      // Get sheet mapping for this user and GA4 service
      const mappingResult = await executeQuery(
        `SELECT spreadsheet_id, sheet_name FROM sheet_mappings WHERE service = $1 AND user_id = $2 LIMIT 1`,
        ['ga4', userId],
        userId
      );

      if (mappingResult.rows.length === 0) {
        throw new Error('No sheet mapping found for GA4 service');
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
      
      // Fetch GA4 report data
      const apiResponse = await this.fetchGaReport(ga4Credentials);
      const metrics = this.parseMetrics(apiResponse);

      // Append data to sheet if not already present
      const appendResult = await this.upsertIfMissing(
        metrics,
        targetSpreadsheetId,
        targetSheetName,
        sheetsDecryptedJson
      );

      if (appendResult.id !== undefined) {
        metrics.id = appendResult.id;
      }

      logger.info('GA4 workflow completed', {
        userId,
        date: metrics.date,
        mode: appendResult.mode,
        rowNumber: appendResult.rowNumber,
        id: appendResult.id
      });

      return {
        metrics,
        appendResult,
        spreadsheetId: targetSpreadsheetId,
        sheetName: targetSheetName,
      };
    } catch (error) {
      logger.error('GA4 workflow failed', {
        credentialId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
}

export const ga4Service = new Ga4Service();