// Meta Raw Daily Data
export interface MetaRawDaily {
  id?: number
  date: string
  spend: number
  reach: number
  impressions: number
  clicks: number
  landing_page_views: number
  add_to_cart: number
  initiate_checkout: number
  purchases: number
  revenue: number
}

// GA4 Raw Daily Data
export interface GA4RawDaily {
  id?: number
  date: string
  sessions: number
  users: number
  add_to_cart: number
  purchases: number
  revenue: number
  bounce_rate: number
}

// Shopify Raw Daily Data
export interface ShopifyRawDaily {
  id?: number
  date: string
  total_orders: number
  total_revenue: number
  net_revenue: number
  total_returns: number
  new_customers: number
  repeat_customers: number
}

// Calculated Metrics
export interface MetaMetrics {
  cpm: number
  ctr: number
  cpc: number
  cac: number
  roas: number
  aov: number
  spendChange: number
  revenueChange: number
}

export interface GA4Metrics {
  conversionRate: number
  aov: number
  bounceRate: number
  revenueChange: number
  sessionsChange: number
}

export interface ShopifyMetrics {
  revPerOrder: number
  newCustomerPercent: number
  returnRate: number
  revenueChange: number
  ordersChange: number
}

// Combined Daily Data
export interface DailyData {
  date: string
  meta: MetaRawDaily
  ga4: GA4RawDaily
  shopify: ShopifyRawDaily
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface SyncResult {
  success: boolean
  mode: 'append' | 'update' | 'skip'
  rowNumber?: number
  id?: number
  error?: string
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  version: string
  uptime: number
  redis?: {
    connected: boolean
    latencyMs?: number
  }
}

// Settings Types
export type GA4AuthMethod = 'oauth' | 'service-account'

export interface GA4Credentials {
  authMethod: GA4AuthMethod
  propertyId: string
  // OAuth fields
  accessToken?: string
  clientId?: string
  clientSecret?: string
  // Service Account fields
  serviceAccountEmail?: string
  serviceAccountKey?: string // JSON string of the service account key
}

// ============================================================================
// DEPRECATED: Legacy localStorage-based settings types
// These are kept for reference but are no longer used.
// Credentials are now stored encrypted in the backend.
// ============================================================================

/** @deprecated Use backend credential storage instead */
export interface PlatformCredentials {
  meta: {
    accessToken: string
  }
  ga4: GA4Credentials
  shopify: {
    storeDomain: string
    accessToken: string
  }
}

/** @deprecated Use useServiceConfig hook instead */
export interface SpreadsheetConfig {
  spreadsheetId: string
  metaSheetName: string
  ga4SheetName: string
  shopifySheetName: string
}

/** @deprecated Settings are now managed through backend APIs */
export interface AppSettings {
  credentials: PlatformCredentials
  spreadsheet: SpreadsheetConfig
  theme: 'light' | 'dark' | 'system'
}

// Date Range Type
export type DateRange = 'yesterday' | '7d' | '30d' | 'mtd'

// Platform Type
export type Platform = 'meta' | 'ga4' | 'shopify'

// Spreadsheet Types
export interface SpreadsheetInfo {
  id: string
  name: string
}

export interface SheetInfo {
  id: string
  name: string
  sheetId: number
}
