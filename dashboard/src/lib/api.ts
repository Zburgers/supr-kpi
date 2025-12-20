import type {
  ApiResponse,
  MetaRawDaily,
  GA4RawDaily,
  ShopifyRawDaily,
  SyncResult,
  HealthCheckResponse,
  SpreadsheetInfo,
  SheetInfo,
} from '@/types'

const API_BASE = '/api'

// Store the auth token getter function (set by useAuthenticatedApi hook)
let getAuthToken: (() => Promise<string | null>) | null = null

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    // Get auth token if available
    const token = getAuthToken ? await getAuthToken() : null
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    }
    
    // Add Authorization header if we have a token
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    const data = await response.json()
    return data
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Health & Status
export async function getHealth(): Promise<ApiResponse<HealthCheckResponse>> {
  return fetchApi<HealthCheckResponse>('/health')
}

// Sheet Data
export async function getSheetData(
  spreadsheetId: string,
  sheetName: string
): Promise<ApiResponse<string[][]>> {
  return fetchApi<string[][]>(`/data/${spreadsheetId}/${encodeURIComponent(sheetName)}`)
}

// Meta Sync
export async function syncMeta(params: {
  accessToken: string
  spreadsheetId?: string
  sheetName?: string
  targetDate?: string
}): Promise<ApiResponse<{ metrics: MetaRawDaily; appendResult: SyncResult }>> {
  return fetchApi('/v1/sync/meta/direct', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// GA4 Sync
export async function syncGA4(params: {
  accessToken: string
  propertyId: string
  spreadsheetId?: string
  sheetName?: string
  targetDate?: string
}): Promise<ApiResponse<{ metrics: GA4RawDaily; appendResult: SyncResult }>> {
  return fetchApi('/v1/sync/ga4/direct', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// Shopify Sync
export async function syncShopify(params: {
  storeDomain: string
  accessToken: string
  spreadsheetId?: string
  sheetName?: string
  targetDate?: string
}): Promise<ApiResponse<{ metrics: ShopifyRawDaily; appendResult: SyncResult }>> {
  return fetchApi('/v1/sync/shopify/direct', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// Sync All Platforms
export async function syncAll(): Promise<ApiResponse<{ jobs: { jobId: string; source: string }[] }>> {
  return fetchApi('/v1/sync/all', {
    method: 'POST',
  })
}

// Legacy fetch endpoints (for getting historical data)
export async function fetchMetaData(params: {
  accessToken: string
  spreadsheetId?: string
  sheetName?: string
}): Promise<ApiResponse<{ metrics: MetaRawDaily; appendResult: SyncResult }>> {
  return fetchApi('/meta/fetch', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function fetchGA4Data(params: {
  accessToken: string
  propertyId: string
  spreadsheetId?: string
  sheetName?: string
}): Promise<ApiResponse<{ metrics: GA4RawDaily; appendResult: SyncResult }>> {
  return fetchApi('/google/fetch', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function fetchShopifyData(params: {
  storeDomain: string
  accessToken: string
  spreadsheetId?: string
  sheetName?: string
}): Promise<ApiResponse<{ metrics: ShopifyRawDaily; appendResult: SyncResult }>> {
  return fetchApi('/shopify/fetch', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// Scheduler
export async function getSchedulerStatus(): Promise<
  ApiResponse<{
    isActive: boolean
    schedule: string
    timezone: string
    nextRun?: string
  }>
> {
  return fetchApi('/v1/scheduler/status')
}

export async function startScheduler(): Promise<ApiResponse<{ message: string }>> {
  return fetchApi('/v1/scheduler/start', { method: 'POST' })
}

export async function stopScheduler(): Promise<ApiResponse<{ message: string }>> {
  return fetchApi('/v1/scheduler/stop', { method: 'POST' })
}

export async function triggerScheduler(): Promise<ApiResponse<{ message: string }>> {
  return fetchApi('/v1/scheduler/trigger', { method: 'POST' })
}

// Spreadsheet Management
export async function listSpreadsheets(): Promise<ApiResponse<SpreadsheetInfo[]>> {
  return fetchApi<SpreadsheetInfo[]>('/spreadsheets')
}

export async function getSheetNames(spreadsheetId: string): Promise<ApiResponse<SheetInfo[]>> {
  return fetchApi<SheetInfo[]>(`/sheets/${spreadsheetId}`)
}

// Get raw sheet data with values (for sheet viewer)
export async function getSheetRawData(
  spreadsheetId: string,
  sheetName: string
): Promise<ApiResponse<string[][]>> {
  return fetchApi<string[][]>(`/data/raw/${spreadsheetId}/${encodeURIComponent(sheetName)}`)
}
