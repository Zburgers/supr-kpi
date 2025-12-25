/**
 * Base Adapter Interface
 * Defines the contract for all source adapters
 *
 * @module adapters/base
 */

import { DataSource, DailyMetric, UpsertMode, IsoDate } from '../types/etl.js';

/**
 * Sync options passed to adapters
 */
export interface SyncOptions {
  /** Target date (YYYY-MM-DD) */
  targetDate?: IsoDate;
  /** Override spreadsheet ID */
  spreadsheetId?: string;
  /** Override sheet name */
  sheetName?: string;
}

/**
 * Result of a sync operation
 */
export interface SyncResult<T extends DailyMetric = DailyMetric> {
  /** Whether the sync succeeded */
  success: boolean;
  /** Operation mode performed */
  mode?: UpsertMode;
  /** Row number affected */
  rowNumber?: number;
  /** Row ID assigned/used */
  id?: number;
  /** Extracted metrics */
  metrics?: T;
  /** Error message if failed */
  error?: string;
}

/**
 * Base interface for all source adapters
 */
export interface BaseAdapter<T extends DailyMetric = DailyMetric, O extends SyncOptions = SyncOptions> {
  /** Data source identifier */
  readonly source: DataSource;

  /**
   * Execute a sync operation
   * Extracts data from source and upserts to sheet
   */
  sync(options: O, credentialJson?: string): Promise<SyncResult<T>>;

  /**
   * Validate adapter configuration
   */
  validateConfig(): { valid: boolean; errors: string[] };

  /**
   * Get the column headers for this source's sheet
   */
  getColumnHeaders(): string[];
}

/**
 * Get yesterday's date in ISO format
 */
export function getYesterdayDate(): IsoDate {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Safe number parsing
 */
export function toNumber(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : 0;
}

/**
 * Format date for API queries
 */
export function formatDateForApi(date: IsoDate, format: 'iso' | 'yyyymmdd' = 'iso'): string {
  if (format === 'yyyymmdd') {
    return date.replace(/-/g, '');
  }
  return date;
}

/**
 * Validate header row matches expected schema
 * Detects schema mismatches and missing columns
 * 
 * @param headerRow - Raw header row from sheet
 * @param expectedColumns - Expected column names
 * @returns { valid: boolean, missingColumns: string[], mismatchWarning: string | null }
 */
export function validateHeaderSchema(
  headerRow: (string | number | null)[] | undefined,
  expectedColumns: string[]
): { 
  valid: boolean
  missingColumns: string[]
  mismatchWarning: string | null 
  detectedSchema: string | null
} {
  // Empty header = no schema initialized
  if (!headerRow || headerRow.length === 0) {
    return {
      valid: false,
      missingColumns: expectedColumns,
      mismatchWarning: null,
      detectedSchema: null,
    };
  }

  // Normalize detected headers
  const normalizedDetected = headerRow
    .map((h) => (typeof h === 'string' ? h.trim().toLowerCase() : ''))
    .filter((h) => h.length > 0);

  const expectedNormalized = expectedColumns.map((c) => c.toLowerCase());

  // Check for missing columns
  const missingColumns = expectedNormalized.filter((col) => !normalizedDetected.includes(col));

  // Detect which service this sheet might belong to
  let detectedSchema: string | null = null;
  const metaColumns = ['spend', 'reach', 'impressions', 'clicks', 'landing_page_views'];
  const ga4Columns = ['sessions', 'users', 'bounce_rate'];
  const shopifyColumns = ['total_orders', 'total_revenue', 'net_revenue', 'repeat_customers'];

  const metaMatch = metaColumns.filter((col) => normalizedDetected.includes(col.toLowerCase())).length;
  const ga4Match = ga4Columns.filter((col) => normalizedDetected.includes(col.toLowerCase())).length;
  const shopifyMatch = shopifyColumns.filter((col) => normalizedDetected.includes(col.toLowerCase())).length;

  if (metaMatch >= 2) detectedSchema = 'meta';
  else if (ga4Match >= 2) detectedSchema = 'ga4';
  else if (shopifyMatch >= 2) detectedSchema = 'shopify';

  // If columns detected don't match our schema, warn about potential overwrite
  let mismatchWarning: string | null = null;
  if (detectedSchema && detectedSchema !== 'unknown' && missingColumns.length > 0) {
    mismatchWarning = `This sheet appears to contain ${detectedSchema.toUpperCase()} data but is missing columns: ${missingColumns.join(', ')}. Please verify you're writing to the correct sheet to avoid data corruption.`;
  }

  const valid = missingColumns.length === 0;

  return {
    valid,
    missingColumns,
    mismatchWarning,
    detectedSchema,
  };
}

/**
 * Check if sheet is completely empty (no headers, no data)
 */
export function isSheetEmpty(headerRow: (string | number | null)[] | undefined): boolean {
  return !headerRow || headerRow.length === 0 || headerRow.every((h) => !h);
}
