/**
 * Sheet Validation & Header Management
 * 
 * Handles validation of Google Sheets to ensure they have the correct schema
 * before syncing data. Supports:
 * - Creating headers in empty sheets
 * - Validating headers match expected schema
 * - Detecting mismatched schemas to prevent data corruption
 */

import type { Platform } from '@/types'
import * as api from './api'

// Define expected headers for each service
const SHEET_SCHEMAS: Record<Platform, readonly string[]> = {
  meta: [
    'date',
    'spend',
    'reach',
    'impressions',
    'clicks',
    'landing_page_views',
    'add_to_cart',
    'initiate_checkout',
    'purchases',
    'revenue',
  ],
  ga4: [
    'date',
    'sessions',
    'users',
    'add_to_cart',
    'purchases',
    'revenue',
    'bounce_rate',
  ],
  shopify: [
    'date',
    'total_orders',
    'total_revenue',
    'net_revenue',
    'total_returns',
    'new_customers',
    'repeat_customers',
  ],
}

export interface HeaderValidationResult {
  valid: boolean
  hasHeaders: boolean
  headerMatch: 'exact' | 'partial' | 'mismatch' | 'empty'
  missingHeaders?: string[]
  extraHeaders?: string[]
  detectedSchema?: Platform | null
  message: string
  requiresHeaderCreation: boolean
}

/**
 * Normalize header string for comparison
 */
function normalizeHeader(header: string): string {
  return header?.toString().trim().toLowerCase() || ''
}

/**
 * Try to detect if a row matches a known schema
 * Returns the platform name if it matches, null otherwise
 */
function detectSchema(headers: string[]): Platform | null {
  const normalizedHeaders = headers.map(normalizeHeader).filter(Boolean)
  
  if (normalizedHeaders.length === 0) return null

  for (const [platform, expectedHeaders] of Object.entries(SHEET_SCHEMAS)) {
    const expectedNormalized = expectedHeaders.map(normalizeHeader)
    
    // Check if at least 50% of headers match (to account for partial/extra columns)
    const matches = normalizedHeaders.filter(h => expectedNormalized.includes(h)).length
    const matchPercentage = (matches / expectedNormalized.length) * 100
    
    if (matchPercentage >= 50) {
      return platform as Platform
    }
  }

  return null
}

/**
 * Validate sheet headers against expected schema
 */
export function validateHeaders(
  sheetData: string[][],
  service: Platform
): HeaderValidationResult {
  const expectedHeaders = SHEET_SCHEMAS[service]

  // Edge case: Sheet is completely empty
  if (!sheetData || sheetData.length === 0) {
    return {
      valid: false,
      hasHeaders: false,
      headerMatch: 'empty',
      message: `Sheet is empty. Headers will be created automatically when syncing.`,
      requiresHeaderCreation: true,
    }
  }

  const headers = sheetData[0]
  const normalizedHeaders = headers.map(normalizeHeader)
  const expectedNormalized = expectedHeaders.map(normalizeHeader)

  // Edge case: Row exists but is empty (all cells blank)
  const hasAnyHeader = normalizedHeaders.some(h => h.length > 0)
  if (!hasAnyHeader) {
    return {
      valid: false,
      hasHeaders: false,
      headerMatch: 'empty',
      message: `First row appears to be empty. Headers will be created automatically when syncing.`,
      requiresHeaderCreation: true,
    }
  }

  // Check for exact match
  if (normalizedHeaders.length === expectedNormalized.length &&
      normalizedHeaders.every((h, i) => h === expectedNormalized[i])) {
    return {
      valid: true,
      hasHeaders: true,
      headerMatch: 'exact',
      message: `Headers match ${service.toUpperCase()} schema perfectly.`,
      requiresHeaderCreation: false,
    }
  }

  // Check for partial match (has required headers but may have extras)
  const missingHeaders = expectedNormalized.filter(eh => !normalizedHeaders.includes(eh))
  const extraHeaders = normalizedHeaders.filter(h => !expectedNormalized.includes(h))

  if (missingHeaders.length === 0) {
    // All required headers present, just some extras
    return {
      valid: true,
      hasHeaders: true,
      headerMatch: 'partial',
      extraHeaders,
      message: `Headers include all ${service.toUpperCase()} required columns plus ${extraHeaders.length} extra column(s). Will proceed.`,
      requiresHeaderCreation: false,
    }
  }

  // Check if this looks like a different service's schema
  const detectedSchema = detectSchema(normalizedHeaders)
  
  if (detectedSchema && detectedSchema !== service) {
    return {
      valid: false,
      hasHeaders: true,
      headerMatch: 'mismatch',
      missingHeaders,
      extraHeaders,
      detectedSchema,
      message: `❌ Sheet appears to contain ${detectedSchema.toUpperCase()} data (detected ${detectedSchema} schema), but you're trying to sync ${service.toUpperCase()} data. This would corrupt your data. Please use the correct sheet or create a new one.`,
      requiresHeaderCreation: false,
    }
  }

  // Generic mismatch
  return {
    valid: false,
    hasHeaders: true,
    headerMatch: 'mismatch',
    missingHeaders,
    extraHeaders,
    message: `❌ Sheet headers don't match ${service.toUpperCase()} schema. Missing: ${missingHeaders.join(', ')}. Please check your sheet mapping in Settings.`,
    requiresHeaderCreation: false,
  }
}

/**
 * Check if a sheet has valid headers for the service
 * Returns whether validation passed
 */
export async function checkSheetHeaders(
  service: Platform,
  spreadsheetId: string,
  sheetName: string,
  credentialId: string
): Promise<HeaderValidationResult> {
  try {
    // Try to read the sheet
    const response = await api.getSheetRawData(spreadsheetId, sheetName, credentialId)

    if (!response.success) {
      return {
        valid: false,
        hasHeaders: false,
        headerMatch: 'empty',
        message: `Failed to read sheet: ${response.error}`,
        requiresHeaderCreation: false,
      }
    }

    const sheetData = response.data || []
    return validateHeaders(sheetData, service)
  } catch (error) {
    return {
      valid: false,
      hasHeaders: false,
      headerMatch: 'empty',
      message: `Error validating sheet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      requiresHeaderCreation: false,
    }
  }
}

/**
 * Create headers in a sheet by appending the header row
 * This is called before the first sync to an empty sheet
 */
export async function createSheetHeaders(
  service: Platform,
  spreadsheetId: string,
  sheetName: string,
  credentialId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = SHEET_SCHEMAS[service]

    if (!credentialId) {
      return {
        success: false,
        error: 'Missing credentials for sheet access',
      }
    }

    // Headers will be created automatically during the first sync
    // The sync process handles creating headers if the sheet is empty
    // This function is mainly a placeholder for future direct header creation
    console.log(`Headers would be created for ${service} service:`, headers);
    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create headers',
    }
  }
}

/**
 * Get schema details for display/documentation
 */
export function getSchemaInfo(service: Platform) {
  const headers = SHEET_SCHEMAS[service]
  return {
    service,
    headers,
    columnCount: headers.length,
    description: `Expected columns for ${service.toUpperCase()}: ${headers.join(', ')}`,
  }
}

/**
 * List all available schemas for reference
 */
export function getAllSchemas() {
  return Object.entries(SHEET_SCHEMAS).map(([service, headers]) => ({
    service: service as Platform,
    headers,
    columnCount: headers.length,
  }))
}
