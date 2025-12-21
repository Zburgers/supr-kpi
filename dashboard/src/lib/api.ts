/**
 * Centralized API Client
 * 
 * All API calls should go through this module to ensure:
 * - Consistent authentication (Clerk JWT)
 * - Unified error handling
 * - Type safety
 * 
 * @module api
 */

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

/**
 * Get current auth token - exposed for hooks that need direct access
 */
export async function getCurrentToken(): Promise<string | null> {
  return getAuthToken ? await getAuthToken() : null
}

/**
 * Core fetch wrapper with authentication and error handling
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const token = getAuthToken ? await getAuthToken() : null
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    }
    
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        return {
          success: false,
          error: `Server error: ${response.status} ${response.statusText}`,
        }
      }
    }

    const data = await response.json()
    
    // Normalize response format
    if (!response.ok && !data.error) {
      return {
        success: false,
        error: data.message || `Request failed with status ${response.status}`,
        ...data,
      }
    }
    
    return data
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// Health & Status
// ============================================================================

export async function getHealth(): Promise<ApiResponse<HealthCheckResponse>> {
  return fetchApi<HealthCheckResponse>('/health')
}

// ============================================================================
// User & Onboarding
// ============================================================================

export interface UserStatus {
  id: number
  email: string
  onboardingComplete: boolean
}

export async function getUserStatus(): Promise<ApiResponse<UserStatus>> {
  return fetchApi<UserStatus>('/user/status')
}

export async function completeOnboarding(): Promise<ApiResponse<{ onboardingComplete: boolean }>> {
  return fetchApi<{ onboardingComplete: boolean }>('/user/onboarding/complete', {
    method: 'POST',
  })
}

export async function resetOnboarding(): Promise<ApiResponse<{ onboardingComplete: boolean }>> {
  return fetchApi<{ onboardingComplete: boolean }>('/user/onboarding/reset', {
    method: 'POST',
  })
}

// ============================================================================
// Credentials (Modern Backend-based)
// ============================================================================

export interface Credential {
  id: string
  service: string
  name: string
  type: string
  verified: boolean
  verified_at?: string
  metadata?: Record<string, unknown>
}

export interface CredentialCreateRequest {
  service: string
  name: string
  type: string
  credentials: string
}

export async function listCredentials(): Promise<ApiResponse<Credential[]>> {
  return fetchApi<Credential[]>('/credentials/list')
}

export async function getCredential(id: string): Promise<ApiResponse<Credential>> {
  return fetchApi<Credential>(`/credentials/${id}`)
}

export async function createCredential(data: CredentialCreateRequest): Promise<ApiResponse<Credential>> {
  return fetchApi<Credential>('/credentials/save', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCredential(id: string, data: Partial<CredentialCreateRequest>): Promise<ApiResponse<Credential>> {
  return fetchApi<Credential>(`/credentials/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteCredential(id: string): Promise<ApiResponse<void>> {
  return fetchApi<void>(`/credentials/${id}`, {
    method: 'DELETE',
  })
}

export async function verifyCredential(id: string): Promise<ApiResponse<{ verified: boolean; metadata?: Record<string, unknown> }>> {
  return fetchApi<{ verified: boolean; metadata?: Record<string, unknown> }>(`/credentials/${id}/verify`, {
    method: 'POST',
  })
}

// ============================================================================
// Services Configuration
// ============================================================================

export interface ServiceConfig {
  service: string
  enabled: boolean
  credential_id?: string
  credential_name?: string
  verified?: boolean
}

export async function listServices(): Promise<ApiResponse<ServiceConfig[]>> {
  return fetchApi<ServiceConfig[]>('/services')
}

export async function enableService(service: string, credentialId: string): Promise<ApiResponse<ServiceConfig>> {
  return fetchApi<ServiceConfig>(`/services/${service}/enable`, {
    method: 'POST',
    body: JSON.stringify({ credential_id: credentialId }),
  })
}

export async function disableService(service: string): Promise<ApiResponse<void>> {
  return fetchApi<void>(`/services/${service}/disable`, {
    method: 'POST',
  })
}

// ============================================================================
// Sheet Mappings
// ============================================================================

export interface SheetMapping {
  id: string
  service: string
  spreadsheet_id: string
  spreadsheet_name?: string
  sheet_name: string
  credential_id?: string
  updated_at: string
}

export async function listSheetMappings(): Promise<ApiResponse<SheetMapping[]>> {
  return fetchApi<SheetMapping[]>('/sheet-mappings')
}

export async function setSheetMapping(data: {
  service: string
  credential_id: string
  spreadsheet_id: string
  sheet_name: string
}): Promise<ApiResponse<SheetMapping>> {
  return fetchApi<SheetMapping>('/sheet-mappings/set', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ============================================================================
// Spreadsheets & Sheets (Google Sheets Integration)
// ============================================================================

export async function listSpreadsheets(credentialId?: string): Promise<ApiResponse<SpreadsheetInfo[]>> {
  const query = credentialId ? `?credential_id=${credentialId}` : ''
  return fetchApi<SpreadsheetInfo[]>(`/spreadsheets${query}`)
}

export async function getSheetNames(spreadsheetId: string, credentialId?: string): Promise<ApiResponse<SheetInfo[]>> {
  const query = credentialId ? `?credential_id=${credentialId}` : ''
  return fetchApi<SheetInfo[]>(`/sheets/${spreadsheetId}${query}`)
}

export async function getSheetRawData(
  spreadsheetId: string,
  sheetName: string
): Promise<ApiResponse<string[][]>> {
  return fetchApi<string[][]>(`/data/raw/${spreadsheetId}/${encodeURIComponent(sheetName)}`)
}

// ============================================================================
// Sync Operations (Modern - Uses stored credentials)
// ============================================================================

export interface SyncResponse {
  metrics: MetaRawDaily | GA4RawDaily | ShopifyRawDaily
  appendResult: SyncResult
}

/**
 * Sync using stored credentials (preferred method)
 * The backend will retrieve and decrypt credentials automatically
 */
export async function syncService(service: 'meta' | 'ga4' | 'shopify', options?: {
  targetDate?: string
  force?: boolean
}): Promise<ApiResponse<SyncResponse>> {
  return fetchApi<SyncResponse>(`/v1/sync/${service}`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  })
}

/**
 * Sync all enabled services
 */
export async function syncAllServices(): Promise<ApiResponse<{ 
  results: Array<{ service: string; success: boolean; error?: string }>
}>> {
  return fetchApi('/v1/sync/all', {
    method: 'POST',
  })
}

// ============================================================================
// Legacy Direct Sync (Deprecated - for backward compatibility only)
// TODO: Remove after full migration to stored credentials
// ============================================================================

/** @deprecated Use syncService('meta') instead */
export async function syncMeta(params: {
  accessToken: string
  spreadsheetId?: string
  sheetName?: string
  targetDate?: string
}): Promise<ApiResponse<{ metrics: MetaRawDaily; appendResult: SyncResult }>> {
  console.warn('syncMeta is deprecated. Use syncService("meta") with stored credentials.')
  return fetchApi('/v1/sync/meta/direct', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** @deprecated Use syncService('ga4') instead */
export async function syncGA4(params: {
  accessToken: string
  propertyId: string
  spreadsheetId?: string
  sheetName?: string
  targetDate?: string
}): Promise<ApiResponse<{ metrics: GA4RawDaily; appendResult: SyncResult }>> {
  console.warn('syncGA4 is deprecated. Use syncService("ga4") with stored credentials.')
  return fetchApi('/v1/sync/ga4/direct', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** @deprecated Use syncService('shopify') instead */
export async function syncShopify(params: {
  storeDomain: string
  accessToken: string
  spreadsheetId?: string
  sheetName?: string
  targetDate?: string
}): Promise<ApiResponse<{ metrics: ShopifyRawDaily; appendResult: SyncResult }>> {
  console.warn('syncShopify is deprecated. Use syncService("shopify") with stored credentials.')
  return fetchApi('/v1/sync/shopify/direct', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ============================================================================
// Schedules
// ============================================================================

export interface Schedule {
  service: string
  cron: string
  enabled: boolean
  last_run_at?: string
  next_run_at?: string
}

export async function listSchedules(): Promise<ApiResponse<Schedule[]>> {
  return fetchApi<Schedule[]>('/schedules')
}

export async function updateSchedule(service: string, data: {
  cron?: string
  enabled?: boolean
}): Promise<ApiResponse<Schedule>> {
  return fetchApi<Schedule>(`/schedules/${service}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function triggerScheduleRun(service: string): Promise<ApiResponse<{ message: string }>> {
  return fetchApi<{ message: string }>(`/schedules/${service}/run`, {
    method: 'POST',
  })
}

// ============================================================================
// Activity Log
// ============================================================================

export interface ActivityLogEntry {
  id: string
  timestamp: string
  service: string
  action: string
  status: 'success' | 'failure' | 'partial'
  record_count?: number
  duration_ms?: number
  error_message?: string
  metadata?: Record<string, unknown>
}

export interface ActivityLogFilters {
  service?: string
  status?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export async function getActivityLog(filters?: ActivityLogFilters): Promise<ApiResponse<{
  entries: ActivityLogEntry[]
  total: number
}>> {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value))
    })
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  return fetchApi<{ entries: ActivityLogEntry[]; total: number }>(`/activity-log${query}`)
}

// ============================================================================
// Future: MCP & Library Integration Stubs
// ============================================================================

/**
 * @stub Future MCP (Model Context Protocol) integration
 * Will enable AI-assisted data analysis and automation
 */
export const mcpStub = {
  // TODO: Implement MCP server connection
  // connect: async (serverUrl: string) => {},
  // query: async (prompt: string, context: unknown) => {},
  // analyze: async (data: unknown, instructions: string) => {},
}

/**
 * @stub Future direct library integration
 * Will replace REST API calls with direct SDK usage for better performance
 */
export const libraryStub = {
  // TODO: Meta Marketing API SDK
  // meta: { fetchInsights: async () => {} },
  
  // TODO: Google Analytics Data API SDK  
  // ga4: { runReport: async () => {} },
  
  // TODO: Shopify Admin API SDK
  // shopify: { fetchOrders: async () => {} },
  
  // TODO: Google Sheets API SDK
  // sheets: { appendRows: async () => {} },
}
