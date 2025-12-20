/**
 * Data types for KPI tracking
 * Used across the application for type safety and consistency
 *
 * @module types/kpi
 * @see {@link https://docs.google.com/spreadsheets/d/} - Add your sheet link here
 */

/**
 * Daily KPI metrics row structure
 * Represents a single day's performance data
 * Written to: meta_raw_daily sheet
 *
 * @interface DailyMetrics
 */
export interface DailyMetrics {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Ad spend amount */
  spend: number;
  /** Number of people reached */
  reach: number;
  /** Total impressions */
  impressions: number;
  /** Number of clicks */
  clicks: number;
  /** Landing page views */
  landing_page_views: number;
  /** Add to cart actions */
  add_to_cart: number;
  /** Checkout initiations */
  initiate_checkout: number;
  /** Number of purchases */
  purchases: number;
  /** Revenue from purchases */
  revenue: number;
}

/**
 * Raw sheet row (may contain additional columns)
 * Used when reading/writing to sheets
 *
 * @interface SheetRow
 */
export interface SheetRow {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Google Sheets API response wrapper
 *
 * @interface SheetsListResponse
 */
export interface SheetsListResponse {
  spreadsheetId: string;
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      index: number;
    };
  }>;
}

/**
 * Available sheet metadata
 *
 * @interface SheetMetadata
 */
export interface SheetMetadata {
  id: string;
  name: string;
  sheetId: number;
}

/**
 * API Request/Response types
 *
 * @interface ApiResponse
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
