/**
 * Sheet Validation & Schema Information
 * 
 * Provides schema definitions and validation utilities for Google Sheets.
 * 
 * IMPORTANT: Header creation is handled automatically by the backend adapters
 * during sync operations. This module provides:
 * - Schema definitions for reference
 * - Pre-flight validation to show user-friendly warnings
 * - Schema mismatch detection to prevent data corruption
 * 
 * @see src/adapters/meta.adapter.ts
 * @see src/adapters/ga4.adapter.ts  
 * @see src/adapters/shopify.adapter.ts
 */

import type { Platform } from '@/types'
import * as api from './api'

/**
 * Expected headers for each service's Google Sheet.
 * Note: 'id' column is added by backend, not included here.
 * These match the backend adapter schemas.
 */
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
  /** Whether the sheet is ready for syncing */
  valid: boolean
  /** Whether the sheet has any headers */
  hasHeaders: boolean
  /** Type of header match found */
  headerMatch: 'exact' | 'partial' | 'mismatch' | 'empty'
  /** Headers expected but not found */
  missingHeaders?: string[]
  /** Extra headers found beyond expected */
  extraHeaders?: string[]
  /** If mismatch, which schema was detected */
  detectedSchema?: Platform | null
  /** User-friendly message explaining the validation result */
  message: string
  /** 
   * Whether headers need to be created.
   * Note: Backend handles this automatically during sync.
   */
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
      valid: true, // Backend will create headers automatically
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
      valid: true, // Backend will create headers automatically
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
 * Check if a sheet has valid headers for the service.
 * This is a pre-flight check - the backend handles actual header creation.
 * 
 * @param service - The platform service type
 * @param spreadsheetId - Google Sheets spreadsheet ID
 * @param sheetName - Name of the sheet within the spreadsheet
 * @param credentialId - Google Sheets credential ID for authentication
 * @returns Validation result with status and user-friendly message
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
      // If sheet doesn't exist or can't be read, let the sync proceed
      // Backend will handle the error with a proper message
      return {
        valid: true, // Allow sync to proceed - backend handles errors
        hasHeaders: false,
        headerMatch: 'empty',
        message: `Could not read sheet: ${response.error}. Sync will attempt to proceed.`,
        requiresHeaderCreation: false,
      }
    }

    const sheetData = response.data || []
    return validateHeaders(sheetData, service)
  } catch (error) {
    // On error, allow sync to proceed - backend will handle properly
    return {
      valid: true,
      hasHeaders: false,
      headerMatch: 'empty',
      message: `Could not validate sheet: ${error instanceof Error ? error.message : 'Unknown error'}. Sync will attempt to proceed.`,
      requiresHeaderCreation: false,
    }
  }
}

/**
 * Placeholder for header creation - BACKEND HANDLES THIS AUTOMATICALLY
 * 
 * The backend adapters (meta.adapter.ts, ga4.adapter.ts, shopify.adapter.ts)
 * automatically create headers when syncing to an empty sheet.
 * 
 * This function exists for API compatibility but simply returns success,
 * allowing the sync to proceed where the backend will handle header creation.
 * 
 * @param service - The platform service type
 * @param _spreadsheetId - Unused - backend handles this
 * @param _sheetName - Unused - backend handles this  
 * @param _credentialId - Unused - backend handles this
 * @returns Always returns success - backend handles actual header creation
 */
export async function createSheetHeaders(
  service: Platform,
  _spreadsheetId: string,
  _sheetName: string,
  _credentialId: string
): Promise<{ success: boolean; error?: string }> {
  // Backend adapters handle header creation automatically during sync.
  // This function is a passthrough to maintain API compatibility.
  if (import.meta.env.DEV) {
    console.log(`ℹ️ [Sheet Validation] Headers for ${service.toUpperCase()} will be created by backend during sync`)
  }
  return { success: true }
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
