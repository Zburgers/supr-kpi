/**
 * ETL Pipeline Type Definitions
 * Core interfaces for the Universal ETL Pipeline
 *
 * @module types/etl
 */

// ============================================================================
// BASE TYPES
// ============================================================================

/** ISO date string format: YYYY-MM-DD */
export type IsoDate = string;

/** Supported data sources */
export type DataSource = 'meta' | 'ga4' | 'shopify';

/** Job status tracking */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

/** Upsert operation modes */
export type UpsertMode = 'append' | 'update' | 'skip';

// ============================================================================
// DAILY METRIC INTERFACES
// ============================================================================

/**
 * Base interface for all daily metrics
 * All source-specific metrics extend this
 */
export interface BaseDailyMetric {
  /** Date in YYYY-MM-DD format */
  date: IsoDate;
  /** Data source identifier */
  source: DataSource;
  /** Row ID in the sheet (auto-assigned) */
  id?: number;
}

/**
 * Meta Ads daily metrics
 * Target sheet: meta_raw_daily
 */
export interface MetaDailyMetric extends BaseDailyMetric {
  source: 'meta';
  /** Ad spend amount (INR) */
  spend: number;
  /** Number of unique users reached */
  reach: number;
  /** Total ad impressions */
  impressions: number;
  /** Total clicks */
  clicks: number;
  /** Landing page views */
  landing_page_views: number;
  /** Add to cart actions */
  add_to_cart: number;
  /** Checkout initiations */
  initiate_checkout: number;
  /** Completed purchases */
  purchases: number;
  /** Purchase revenue (INR) */
  revenue: number;
}

/**
 * Google Analytics 4 daily metrics
 * Target sheet: ga4_raw_daily
 */
export interface Ga4DailyMetric extends BaseDailyMetric {
  source: 'ga4';
  /** Total sessions */
  sessions: number;
  /** Unique users */
  users: number;
  /** Add to cart events */
  add_to_cart: number;
  /** Purchase events */
  purchases: number;
  /** Total revenue (INR) */
  revenue: number;
  /** Bounce rate (0-100) */
  bounce_rate: number;
}

/**
 * Shopify daily metrics
 * Target sheet: shopify_raw_daily
 */
export interface ShopifyDailyMetric extends BaseDailyMetric {
  source: 'shopify';
  /** Total order count */
  total_orders: number;
  /** Gross revenue (INR) */
  total_revenue: number;
  /** Net revenue after discounts/refunds (INR) */
  net_revenue: number;
  /** Total return count */
  total_returns: number;
  /** New customer count */
  new_customers: number;
  /** Returning customer count */
  repeat_customers: number;
}

/** Union type of all daily metrics */
export type DailyMetric = MetaDailyMetric | Ga4DailyMetric | ShopifyDailyMetric;

// ============================================================================
// JOB SYSTEM INTERFACES
// ============================================================================

/**
 * ETL Job payload
 * Contains all data needed to process a sync job
 */
export interface ETLJobPayload {
  /** Unique job identifier */
  jobId: string;
  /** Target data source */
  source: DataSource;
  /** Target date (defaults to yesterday) */
  targetDate: IsoDate;
  /** Job creation timestamp */
  createdAt: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Optional override for spreadsheet ID */
  spreadsheetId?: string;
  /** Optional override for sheet name */
  sheetName?: string;
  /** User ID for multi-tenant credential lookup */
  userId?: number;
}

/**
 * ETL Job result
 * Returned after job processing completes
 */
export interface ETLJobResult {
  /** Whether the job succeeded */
  success: boolean;
  /** Job identifier */
  jobId: string;
  /** Data source */
  source: DataSource;
  /** Target date */
  date: IsoDate;
  /** Operation performed */
  mode?: UpsertMode;
  /** Row number in sheet */
  rowNumber?: number;
  /** Extracted metrics (if successful) */
  metrics?: DailyMetric;
  /** Error message (if failed) */
  error?: string;
  /** Processing duration in milliseconds */
  durationMs: number;
  /** Job completion timestamp */
  completedAt: string;
}

// ============================================================================
// EVENT SYSTEM INTERFACES
// ============================================================================

/** System event types for observability */
export type ETLEventType =
  | 'SYNC_STARTED'
  | 'SYNC_SUCCESS'
  | 'SYNC_FAILURE'
  | 'ROW_APPENDED'
  | 'ROW_UPDATED'
  | 'ROW_SKIPPED'
  | 'SCHEMA_MISMATCH'
  | 'TOKEN_EXPIRED'
  | 'RATE_LIMITED'
  | 'PARTIAL_DATA_DETECTED'
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_FAILED';

/**
 * System event for logging and monitoring
 */
export interface ETLEvent {
  /** Event type */
  type: ETLEventType;
  /** Data source (if applicable) */
  source?: DataSource;
  /** Target date */
  date?: IsoDate;
  /** Related job ID */
  jobId?: string;
  /** Event timestamp */
  timestamp: string;
  /** Duration in milliseconds (for completed operations) */
  durationMs?: number;
  /** Row count affected */
  rowCount?: number;
  /** Error details (for failures) */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

/**
 * Source connector configuration
 */
export interface SourceConfig {
  /** Whether this source is enabled */
  enabled: boolean;
  /** Target spreadsheet ID */
  spreadsheetId: string;
  /** Target sheet name */
  sheetName: string;
  /** Required environment variables */
  requiredEnvVars: string[];
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Server port */
  port: number;
  /** Timezone for scheduling */
  timezone: string;
  /** Cron schedule expression */
  cronSchedule: string;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Source-specific configurations */
  sources: Record<DataSource, SourceConfig>;
  /** Notification settings */
  notifications: {
    telegram: {
      enabled: boolean;
      botToken?: string;
      chatId?: string;
    };
    email: {
      enabled: boolean;
      smtpHost?: string;
      smtpPort?: number;
      fromAddress?: string;
      toAddresses?: string[];
    };
  };
}

// ============================================================================
// API RESPONSE INTERFACES
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  redis: {
    connected: boolean;
    latencyMs?: number;
  };
  lastSync?: {
    meta?: { date: IsoDate; status: JobStatus };
    ga4?: { date: IsoDate; status: JobStatus };
    shopify?: { date: IsoDate; status: JobStatus };
  };
}

/**
 * Sync status response
 */
export interface SyncStatusResponse {
  source: DataSource;
  lastRun?: {
    date: IsoDate;
    status: JobStatus;
    durationMs: number;
    rowsAffected: number;
  };
  nextScheduledRun?: string;
  isRunning: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Extract metrics type by source
 */
export type MetricsBySource<T extends DataSource> = T extends 'meta'
  ? MetaDailyMetric
  : T extends 'ga4'
  ? Ga4DailyMetric
  : T extends 'shopify'
  ? ShopifyDailyMetric
  : never;

/**
 * Sheet row type (array of cell values)
 */
export type SheetRowValues = (string | number | null | undefined)[];

/**
 * Column header mapping
 */
export interface ColumnMapping {
  headerName: string;
  index: number;
  dataType: 'string' | 'number' | 'date';
}
