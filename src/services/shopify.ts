import { sheetsService } from "./sheets.js";
import type { AppendResult, ServiceAccountStatus } from "./meta.js";

export interface ShopifyMetricsRow {
  id?: number;
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

const SHOPIFY_API_VERSION = "2025-10";
const SHOPIFYQL_QUERY = `query { shopifyqlQuery(query: "FROM sales, customers SHOW day AS date, orders AS total_orders, total_sales AS total_revenue, net_sales AS net_revenue, returns AS returns_amount, new_customers, returning_customers AS repeat_customers DURING yesterday TIMESERIES day") { tableData { columns { name dataType displayName } rows } parseErrors } }`;

// Reuse the same spreadsheet as Meta unless caller overrides
export const SHOPIFY_SPREADSHEET_ID =
  "1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8";
export const SHOPIFY_SHEET_NAME = "Shopify";

class ShopifyWorkflow {
  private toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private sanitizeStoreDomain(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    const withoutProto = trimmed.replace(/^https?:\/\//i, "");
    return withoutProto.split("/")[0];
  }

  private async fetchShopifyQL(
    storeDomain: string,
    accessToken: string
  ): Promise<ShopifyQlResponse> {
    const domain = this.sanitizeStoreDomain(storeDomain);
    if (!domain) {
      throw new Error("Store domain is required (e.g., my-shop.myshopify.com)");
    }

    const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    console.log(`📡 Fetching ShopifyQL data from ${url}`);

    // Construct the request body manually to avoid encoding issues
    const requestBody = JSON.stringify({
      query: SHOPIFYQL_QUERY,
      variables: {},
    });

    console.log(`   Query length: ${requestBody.length} bytes`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Shopify-Access-Token": accessToken,
      },
      body: requestBody,
    });

    console.log(`✓ ShopifyQL response status: ${response.status}`);

    if (!response.ok) {
      let body = "";
      try {
        body = await response.text();
      } catch {
        body = "(failed to read error body)";
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
      throw new Error("ShopifyQL response missing shopifyqlQuery data");
    }

    if (shopifyql.parseErrors && shopifyql.parseErrors.length > 0) {
      const messages = shopifyql.parseErrors
        .map((e) => e.message || "Unknown parse error")
        .join("; ");
      throw new Error(`ShopifyQL parse errors: ${messages}`);
    }

    const table = shopifyql.tableData;
    if (!table || !Array.isArray(table.rows) || table.rows.length === 0) {
      throw new Error("ShopifyQL returned no rows for yesterday");
    }

    const columns = table.columns || [];
    const firstRow = (table.rows[0] as Record<string, string | number | null>) || {};

    console.log(`📊 ShopifyQL returned ${columns.length} columns and ${table.rows.length} rows`);
    console.log(`   Columns: ${columns.map((c) => c?.name).join(", ")}`);
    console.log(`   First row values: ${JSON.stringify(firstRow)}`);

    const getValue = (name: string): string | number | null => {
      return firstRow[name] ?? null;
    };

    // Try to find date column - prefer 'date', fallback to 'day'
    let dateRaw = getValue("date");
    if (!dateRaw) {
      dateRaw = getValue("day");
      if (dateRaw) {
        console.log(`   Using 'day' column as date: ${dateRaw}`);
      }
    }

    if (!dateRaw) {
      throw new Error(
        `ShopifyQL row missing date/day value. Available fields: ${Object.keys(firstRow).join(", ")}`
      );
    }

    const metrics: ShopifyMetricsRow = {
      date: String(dateRaw),
      total_orders: this.toNumber(getValue("total_orders")),
      total_revenue: this.toNumber(getValue("total_revenue")),
      net_revenue: this.toNumber(getValue("net_revenue")),
      total_returns: Math.abs(this.toNumber(getValue("returns_amount"))),
      new_customers: this.toNumber(getValue("new_customers")),
      repeat_customers: this.toNumber(getValue("repeat_customers")),
    };

    console.log(`✓ Parsed Shopify metrics for ${metrics.date}`);
    console.log(`  orders=${metrics.total_orders}, revenue=${metrics.total_revenue}, net=${metrics.net_revenue}`);
    console.log(`  returns=${metrics.total_returns}, new_customers=${metrics.new_customers}, repeat_customers=${metrics.repeat_customers}`);

    return metrics;
  }

  private toSheetRow(metrics: ShopifyMetricsRow): (string | number)[] {
    const row = [
      metrics.id ?? "",
      metrics.date,
      metrics.total_orders,
      metrics.total_revenue,
      metrics.net_revenue,
      metrics.total_returns,
      metrics.new_customers,
      metrics.repeat_customers,
    ];
    console.log(`📋 Shopify sheet row: ${JSON.stringify(row)}`);
    return row;
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

  private async upsertToSheet(
    metrics: ShopifyMetricsRow,
    spreadsheetId: string,
    sheetName: string,
    credentialJson: string
  ): Promise<AppendResult> {
    console.log("📝 Upserting Shopify row into Google Sheet...");
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
        existingRowNumber = i + 2;
        break;
      }
    }

    const idValues = await sheetsService.getValues(
      spreadsheetId,
      sheetName,
      `${idColLetter}2:${idColLetter}`
    );

    console.log(`📊 ID column raw values (first 10):`, idValues.slice(0, 10));

    const existingIdCell =
      existingRowNumber != null ? idValues[existingRowNumber - 2]?.[0] : null;
    const existingId = Number.isFinite(Number(existingIdCell))
      ? Number(existingIdCell)
      : null;

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
    
    console.log(`📊 Parsed IDs (showing ${parsedIds.length} valid IDs):`, parsedIds.slice(0, 10));
    console.log(`📊 Highest existing ID: ${parsedIds.length > 0 ? Math.max(...parsedIds) : 'none'}`);

    const nextId = parsedIds.length > 0 ? Math.max(...parsedIds) + 1 : 1;
    const resolvedId = existingId ?? nextId;
    
    console.log(`📊 Calculated nextId: ${nextId}, resolvedId: ${resolvedId}`);

    const row = this.toSheetRow({ ...metrics, id: resolvedId });
    const lastColLetter = this.columnLetterFromIndex(row.length - 1);

    if (existingRowNumber) {
      const range = sheetsService.formatRange(
        sheetName,
        `A${existingRowNumber}:${lastColLetter}${existingRowNumber}`
      );
      await sheetsService.updateRange(spreadsheetId, range, [row], sheetName);
      console.log(
        `✓ Updated Shopify row for ${metrics.date} at ${range} (id=${resolvedId})`
      );
      return {
        success: true,
        mode: "update",
        rowNumber: existingRowNumber,
        id: resolvedId,
      };
    }

    const appendSuccess = await sheetsService.appendRow(
      spreadsheetId,
      sheetName,
      row
    );

    if (appendSuccess) {
      const appendedRowNumber = Math.max(dateValues.length, idValues.length) + 2;
      console.log(
        `✓ Appended Shopify row for ${metrics.date} at ${sheetName}!A${appendedRowNumber} (id=${resolvedId})`
      );
      return {
        success: true,
        mode: "append",
        rowNumber: appendedRowNumber,
        id: resolvedId,
      };
    }

    return { success: false, error: "Append returned false" };
  }

  async runWorkflow(
    storeDomain: string,
    accessToken: string,
    options?: ShopifyRunOptions,
    credentialJson?: string
  ): Promise<{
    metrics: ShopifyMetricsRow;
    appendResult: AppendResult;
    serviceAccount: ServiceAccountStatus;
    rawApiSample?: ShopifyQlResponse["data"];
    spreadsheetId: string;
    sheetName: string;
  }> {
    console.log("=".repeat(70));
    console.log("🚀 Starting Shopify workflow...");
    console.log("=".repeat(70));

    if (!storeDomain) {
      throw new Error("Store domain is required");
    }
    if (!accessToken) {
      throw new Error("Shopify access token is required");
    }

    const apiResponse = await this.fetchShopifyQL(storeDomain, accessToken);
    const metrics = this.parseMetrics(apiResponse);

    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    await sheetsService.initializeWithCredentials(credentialJson);
    const serviceAccount = await sheetsService.verifyServiceAccount(credentialJson);

    const targetSpreadsheetId = options?.spreadsheetId || SHOPIFY_SPREADSHEET_ID;
    const targetSheetName = options?.sheetName || SHOPIFY_SHEET_NAME;

    const appendResult = await this.upsertToSheet(
      metrics,
      targetSpreadsheetId,
      targetSheetName,
      credentialJson
    );

    if (appendResult.id !== undefined) {
      metrics.id = appendResult.id;
    }

    console.log("=".repeat(70));
    console.log("✅ Shopify workflow completed");
    console.log("=".repeat(70));

    return {
      metrics,
      appendResult,
      serviceAccount,
      rawApiSample: apiResponse.data,
      spreadsheetId: targetSpreadsheetId,
      sheetName: targetSheetName,
    };
  }
}

export const shopifyWorkflow = new ShopifyWorkflow();
