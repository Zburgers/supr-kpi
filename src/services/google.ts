/**
 * GA4 DAILY METRICS WORKFLOW
 * - Fetch yesterday's GA4 metrics (sessions, users, add_to_cart, purchases, revenue, bounce_rate)
 * - Normalize to the Google sheet schema: id, date, sessions, users, add_to_cart, purchases, revenue, bounce_rate
 * - Append only if the date is not already present (id starts at 0). If date exists, skip append.
 */

import { sheetsService } from "./sheets.js";
import type { AppendResult, ServiceAccountStatus } from "./meta.js";

export interface GoogleAnalyticsRow {
  id?: number;
  date: string;
  sessions: number;
  users: number;
  add_to_cart: number;
  purchases: number;
  revenue: number;
  bounce_rate: number;
}

export interface GoogleRunOptions {
  spreadsheetId?: string;
  sheetName?: string;
}

export const GA_SPREADSHEET_ID = "1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8";
export const GA_SHEET_NAME = "Google";

interface GaRunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
}

class GoogleAnalyticsWorkflow {
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

  private async fetchGaReport(
    accessToken: string,
    propertyId: string
  ): Promise<GaRunReportResponse> {
    const body = {
      dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "addToCarts" },
        { name: "ecommercePurchases" },
        { name: "totalRevenue" },
        { name: "bounceRate" },
      ],
      keepEmptyRows: true,
    };

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      }
    );

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`GA4 error HTTP ${response.status}: ${rawText || response.statusText}`);
    }

    try {
      return rawText ? (JSON.parse(rawText) as GaRunReportResponse) : {};
    } catch (error) {
      throw new Error("Failed to parse GA4 response as JSON");
    }
  }

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
      date,
      sessions: this.toNumber(metrics[0]?.value),
      users: this.toNumber(metrics[1]?.value),
      add_to_cart: this.toNumber(metrics[2]?.value),
      purchases: this.toNumber(metrics[3]?.value),
      revenue: this.toNumber(metrics[4]?.value),
      bounce_rate: this.toNumber(metrics[5]?.value),
    };
  }

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
    ];
  }

  private async upsertIfMissing(
    metrics: GoogleAnalyticsRow,
    spreadsheetId: string,
    sheetName: string,
    credentialJson?: string
  ): Promise<AppendResult> {
    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    await sheetsService.initializeWithCredentials(credentialJson);

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
      const existingId = Number.isFinite(Number(existingIdCell))
        ? Number(existingIdCell)
        : undefined;
      return {
        success: true,
        mode: "skip",
        rowNumber: existingRowNumber,
        id: existingId,
      };
    }

    console.log(`📊 [GA4 Service] ID column raw values (first 10):`, idValues.slice(0, 10));

    // Parse all IDs from column, filtering out non-numeric and empty values
    const parsedIds = idValues
      .map((r) => {
        const val = r?.[0];
        // Handle empty strings, null, undefined
        if (val === "" || val === null || val === undefined) return NaN;
        const num = Number(val);
        return num;
      })
      .filter((n) => Number.isFinite(n) && n >= 0) as number[];
    
    console.log(`📊 [GA4 Service] Parsed IDs (showing ${parsedIds.length} valid IDs):`, parsedIds.slice(0, 10));
    console.log(`📊 [GA4 Service] Highest existing ID: ${parsedIds.length > 0 ? Math.max(...parsedIds) : 'none'}`);

    const nextId = parsedIds.length > 0 ? Math.max(...parsedIds) + 1 : 1;
    
    console.log(`📊 [GA4 Service] Calculated nextId: ${nextId}`);
    const row = this.toSheetRow({ ...metrics, id: nextId });

    const appendSuccess = await sheetsService.appendRow(
      spreadsheetId,
      sheetName,
      row
    );

    if (appendSuccess) {
      const appendedRowNumber = Math.max(dateValues.length, idValues.length) + 2;
      return {
        success: true,
        mode: "append",
        rowNumber: appendedRowNumber,
        id: nextId,
      };
    }

    return { success: false, error: "Append returned false" };
  }

  async runWorkflow(
    accessToken: string,
    propertyId: string,
    options?: GoogleRunOptions,
    credentialJson?: string
  ): Promise<{
    metrics: GoogleAnalyticsRow;
    appendResult: AppendResult;
    serviceAccount: ServiceAccountStatus;
    rawApiSample?: GaRunReportResponse["rows"];
    spreadsheetId: string;
    sheetName: string;
  }> {
    if (!accessToken) {
      throw new Error("Google OAuth access token is required");
    }
    if (!propertyId) {
      throw new Error("GA4 property ID is required");
    }

    const apiResponse = await this.fetchGaReport(accessToken, propertyId);
    const metrics = this.parseMetrics(apiResponse);

    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    await sheetsService.initializeWithCredentials(credentialJson);
    const serviceAccount = await sheetsService.verifyServiceAccount(credentialJson);

    const targetSpreadsheetId = options?.spreadsheetId || GA_SPREADSHEET_ID;
    const targetSheetName = options?.sheetName || GA_SHEET_NAME;

    const appendResult = await this.upsertIfMissing(
      metrics,
      targetSpreadsheetId,
      targetSheetName,
      credentialJson
    );

    if (appendResult.id !== undefined) {
      metrics.id = appendResult.id;
    }

    return {
      metrics,
      appendResult,
      serviceAccount,
      rawApiSample: apiResponse.rows,
      spreadsheetId: targetSpreadsheetId,
      sheetName: targetSheetName,
    };
  }
}

export const googleAnalyticsWorkflow = new GoogleAnalyticsWorkflow();
