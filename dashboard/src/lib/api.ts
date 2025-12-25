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
 * Error codes for better error handling
 */
export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * Parse error response and return user-friendly message
 */
function parseErrorResponse(status: number, data?: { error?: string; message?: string }): { 
  code: ErrorCode
  message: string 
} {
  const errorMessage = data?.error || data?.message || ''
  
  switch (status) {
    case 401:
    case 403:
      return { code: ErrorCodes.AUTH_ERROR, message: 'Authentication required. Please sign in again.' }
    case 404:
      return { code: ErrorCodes.NOT_FOUND, message: errorMessage || 'The requested resource was not found.' }
    case 429:
      return { code: ErrorCodes.RATE_LIMITED, message: 'Too many requests. Please wait a moment and try again.' }
    case 400:
      return { code: ErrorCodes.VALIDATION_ERROR, message: errorMessage || 'Invalid request. Please check your input.' }
    case 500:
    case 502:
    case 503:
    case 504:
      return { code: ErrorCodes.SERVER_ERROR, message: 'Server error. Please try again later.' }
    default:
      return { code: ErrorCodes.UNKNOWN, message: errorMessage || `Request failed (${status})` }
  }
}

/**
 * Core fetch wrapper with authentication and error handling
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { retries?: number }
): Promise<ApiResponse<T>> {
  const maxRetries = options?.retries ?? 2
  let lastError: string = 'Unknown error'
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const token = getAuthToken ? await getAuthToken() : null

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options?.headers,
      }

      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        if (!response.ok) {
          const { code, message } = parseErrorResponse(response.status)
          return { success: false, error: message, errorCode: code }
        }
        // For successful non-JSON responses
        return { success: true, data: undefined as T }
      }

      const data = await response.json()

      // Normalize response format
      if (!response.ok) {
        const { code, message } = parseErrorResponse(response.status, data)
        return { success: false, error: message, errorCode: code, ...data }
      }

      return data
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          lastError = 'Request timed out. Please check your connection and try again.'
        } else if (error.message.includes('fetch')) {
          lastError = 'Network error. Please check your internet connection.'
        } else {
          lastError = error.message
        }
      }
      
      // Only retry on network errors, not on abort
      if (attempt < maxRetries && !(error instanceof Error && error.name === 'AbortError')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))) // Exponential backoff
        continue
      }
    }
  }

  return {
    success: false,
    error: lastError,
    errorCode: ErrorCodes.NETWORK_ERROR,
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

/**
 * List spreadsheets accessible by the user's Google Sheets credential
 * @param credentialId - Required credential ID to use for the request
 */
export async function listSpreadsheets(credentialId: string): Promise<ApiResponse<SpreadsheetInfo[]>> {
  if (!credentialId) {
    return {
      success: false,
      error: 'Google Sheets credential is required to list spreadsheets. Please configure a Sheets credential.',
    }
  }

  const query = new URLSearchParams({
    credential_id: credentialId,
  }).toString()

  return fetchApi<SpreadsheetInfo[]>(`/sheets/spreadsheets?${query}`)
}

/**
 * Get sheet names within a spreadsheet
 * @param spreadsheetId - The Google Sheets spreadsheet ID
 * @param credentialId - Required credential ID to use for the request
 */
export async function getSheetNames(spreadsheetId: string, credentialId: string): Promise<ApiResponse<SheetInfo[]>> {
  if (!credentialId) {
    return {
      success: false,
      error: 'Google Sheets credential is required to get sheet names. Please configure a Sheets credential.',
    }
  }

  const query = new URLSearchParams({
    credential_id: credentialId,
  }).toString()

  return fetchApi<SheetInfo[]>(`/sheets/${spreadsheetId}/sheets?${query}`)
}

/**
 * Get raw sheet data using stored credentials
 * @param spreadsheetId - The Google Sheets spreadsheet ID
 * @param sheetName - The name of the sheet to read
 * @param credentialId - Optional credential ID to use for the request (if not provided, falls back to legacy endpoint)
 */
export async function getSheetRawData(
  spreadsheetId: string,
  sheetName: string,
  credentialId?: string
): Promise<ApiResponse<string[][]>> {
  if (!credentialId) {
    return {
      success: false,
      error: 'Google Sheets credential is required to read data. Please configure a Sheets credential.',
    }
  }

  const query = new URLSearchParams({
    credential_id: credentialId,
    sheetName: sheetName,
  }).toString()

  return fetchApi<string[][]>(`/sheets/${spreadsheetId}/values?${query}`)
}

// ============================================================================
// Sync Operations (Modern - Uses stored credentials)
// ============================================================================

export interface SyncResponse {
  metrics?: MetaRawDaily | GA4RawDaily | ShopifyRawDaily
  appendResult?: SyncResult
  jobId?: string
}

/**
 * Sync using stored credentials (preferred method)
 * The backend will retrieve and decrypt credentials automatically
 * This returns either a direct sync result or a queued job ID
 */
export async function syncService(service: 'meta' | 'ga4' | 'shopify', options?: {
  targetDate?: string
  force?: boolean
  credentialId?: string // For GA4/Shopify services when using new endpoint
  spreadsheetId?: string
  sheetName?: string
}): Promise<ApiResponse<SyncResponse>> {
  // For GA4, use the new endpoint that handles service account authentication
  if (service === 'ga4' && options?.credentialId) {
    // Call the new GA4 endpoint which requires credentialId
    const ga4Options: {
      credentialId: string
      options?: {
        spreadsheetId?: string
        sheetName?: string
      }
    } = {
      credentialId: options.credentialId,
    };

    // Add optional parameters if they exist
    if (options.spreadsheetId || options.sheetName) {
      ga4Options.options = {};
      if (options.spreadsheetId) ga4Options.options.spreadsheetId = options.spreadsheetId;
      if (options.sheetName) ga4Options.options.sheetName = options.sheetName;
    }

    return fetchApi<SyncResponse>('/ga4/sync', {
      method: 'POST',
      body: JSON.stringify(ga4Options),
    })
  }

  // For Shopify, use the new endpoint that handles stored credentials
  if (service === 'shopify' && options?.credentialId) {
    // Call the new Shopify endpoint which requires credentialId
    const shopifyOptions: {
      credentialId: string | number
      options?: {
        spreadsheetId?: string
        sheetName?: string
      }
    } = {
      credentialId: options.credentialId,
    };

    // Add optional parameters if they exist
    if (options.spreadsheetId || options.sheetName) {
      shopifyOptions.options = {};
      if (options.spreadsheetId) shopifyOptions.options.spreadsheetId = options.spreadsheetId;
      if (options.sheetName) shopifyOptions.options.sheetName = options.sheetName;
    }

    return fetchApi<SyncResponse>('/shopify/sync', {
      method: 'POST',
      body: JSON.stringify(shopifyOptions),
    })
  }

  // For Meta, use the new endpoint that handles stored credentials
  if (service === 'meta' && options?.credentialId) {
    // Call the new Meta endpoint which requires credentialId
    const metaOptions: {
      credentialId: string | number
      options?: {
        spreadsheetId?: string
        sheetName?: string
      }
    } = {
      credentialId: options.credentialId,
    };

    // Add optional parameters if they exist
    if (options.spreadsheetId || options.sheetName) {
      metaOptions.options = {};
      if (options.spreadsheetId) metaOptions.options.spreadsheetId = options.spreadsheetId;
      if (options.sheetName) metaOptions.options.sheetName = options.sheetName;
    }

    return fetchApi<SyncResponse>('/meta/sync', {
      method: 'POST',
      body: JSON.stringify(metaOptions),
    })
  }

  // For other services or when credentialId is not provided, use the old endpoint
  return fetchApi<SyncResponse>(`/v1/sync/${service}`, {
    method: 'POST',
    body: JSON.stringify({
      targetDate: options?.targetDate,
      force: options?.force,
    }),
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
// Schedules
// ============================================================================

export interface Schedule {
  id: number;
  service: string;
  cron: string;
  enabled: boolean;
  timezone: string;
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
}

export async function listSchedules(): Promise<ApiResponse<Schedule[]>> {
  return fetchApi<Schedule[]>('/schedules')
}

export async function updateSchedule(service: string, data: {
  cron: string;
  enabled: boolean;
  timezone?: string;
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
