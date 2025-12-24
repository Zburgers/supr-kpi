/**
 * LEGACY SHOPIFY WORKFLOW - DEPRECATED
 *
 * This module is deprecated and will be removed in a future version.
 * Use the new service at src/services/shopify.service.ts with proper credential management.
 *
 * The new implementation:
 * - Uses stored encrypted credentials from the database
 * - Supports proper authentication without exposing sensitive data
 * - Integrates with the credential management system
 * - Provides better security and multi-tenant support
 *
 * @deprecated Use shopifyService from src/services/shopify.service.ts instead
 */

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
    // This legacy method is deprecated - credentials should be handled securely through the credential management system
    throw new Error(
      "Legacy Shopify workflow is deprecated. Use the new shopifyService with stored credentials instead. " +
      "Please update your code to use the new service at src/services/shopify.service.ts"
    );
  }

  private parseMetrics(apiResponse: ShopifyQlResponse): ShopifyMetricsRow {
    throw new Error(
      "Legacy Shopify workflow is deprecated. Use the new shopifyService with stored credentials instead. " +
      "Please update your code to use the new service at src/services/shopify.service.ts"
    );
  }

  private toSheetRow(metrics: ShopifyMetricsRow): (string | number)[] {
    throw new Error(
      "Legacy Shopify workflow is deprecated. Use the new shopifyService with stored credentials instead. " +
      "Please update your code to use the new service at src/services/shopify.service.ts"
    );
  }

  private columnLetterFromIndex(index: number): string {
    throw new Error(
      "Legacy Shopify workflow is deprecated. Use the new shopifyService with stored credentials instead. " +
      "Please update your code to use the new service at src/services/shopify.service.ts"
    );
  }

  private async upsertToSheet(
    metrics: ShopifyMetricsRow,
    spreadsheetId: string,
    sheetName: string,
    credentialJson: string
  ): Promise<AppendResult> {
    throw new Error(
      "Legacy Shopify workflow is deprecated. Use the new shopifyService with stored credentials instead. " +
      "Please update your code to use the new service at src/services/shopify.service.ts"
    );
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
    // This legacy method is deprecated - credentials should be handled securely through the credential management system
    throw new Error(
      "Legacy Shopify workflow is deprecated. Use the new shopifyService with stored credentials instead. " +
      "Please update your code to use the new service at src/services/shopify.service.ts"
    );
  }
}

export const shopifyWorkflow = new ShopifyWorkflow();

// Export types for backward compatibility
export type {
  ShopifyMetricsRow as ShopifyDailyMetric,
  ShopifyRunOptions as ShopifySyncOptions
};
