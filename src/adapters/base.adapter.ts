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
