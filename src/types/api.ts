/**
 * API Request/Response Types
 * Type definitions for all credential management endpoints
 */

// ============================================================================
// CREDENTIAL ENDPOINTS
// ============================================================================

/**
 * POST /api/credentials/save
 */
export interface SaveCredentialRequest {
  credentialJson: string; // JSON string of credential data
  credentialName: string; // Human-readable name (e.g., "My Google Account")
  service: 'google_sheets' | 'meta' | 'ga4' | 'shopify';
}

export interface SaveCredentialResponse {
  credentialId: string;
  service: string;
  name: string;
  type: string;
  verified: boolean;
  created_at: string;
}

/**
 * GET /api/credentials/list
 */
export interface ListCredentialsResponse {
  credentials: {
    id: string;
    service: string;
    name: string;
    type: string;
    verified: boolean;
    verified_at?: string;
    created_at: string;
    updated_at: string;
  }[];
}

/**
 * GET /api/credentials/{credentialId}
 */
export interface GetCredentialResponse {
  id: string;
  service: string;
  name: string;
  type: string;
  verified: boolean;
  verified_at?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  encrypted: false; // Always false - never return encrypted data
}

/**
 * PUT /api/credentials/{credentialId}
 */
export interface UpdateCredentialRequest {
  credentialJson: string;
  credentialName?: string;
}

export interface UpdateCredentialResponse {
  id: string;
  service: string;
  name: string;
  type: string;
  verified: boolean;
  updated_at: string;
}

/**
 * DELETE /api/credentials/{credentialId}
 */
export interface DeleteCredentialResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// CREDENTIAL VERIFICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/credentials/{credentialId}/verify
 */
export interface VerifyCredentialResponse {
  verified: boolean;
  message: string;
  connectedAs?: string; // e.g., "user@gmail.com" or account name
  expiresAt?: string;
}

/**
 * GET /api/credentials/{credentialId}/verify-status
 */
export interface VerifyStatusResponse {
  credentialId: string;
  verified: boolean;
  verified_at?: string;
  expires_at?: string;
  last_verified_at?: string;
}

// ============================================================================
// SERVICE CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * POST /api/services/{serviceName}/enable
 */
export interface EnableServiceRequest {
  credentialId: number;
}

export interface EnableServiceResponse {
  service: string;
  enabled: boolean;
  credentialId: number;
}

/**
 * POST /api/services/{serviceName}/disable
 */
export interface DisableServiceResponse {
  service: string;
  enabled: boolean;
}

/**
 * GET /api/services
 */
export interface ListServicesResponse {
  services: {
    name: string;
    enabled: boolean;
    credential?: {
      id: number;
      name: string;
      verified: boolean;
    };
  }[];
}

// ============================================================================
// SHEET MAPPING ENDPOINTS
// ============================================================================

/**
 * POST /api/sheet-mappings/set
 */
export interface SetSheetMappingRequest {
  service: string;
  spreadsheetId: string;
  sheetName: string;
}

export interface SetSheetMappingResponse {
  id: number;
  service: string;
  spreadsheetId: string;
  sheetName: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * GET /api/sheet-mappings
 */
export interface ListSheetMappingsResponse {
  mappings: {
    id: number;
    service: string;
    spreadsheetId: string;
    sheetName: string;
    createdAt?: string;
    updatedAt?: string;
  }[];
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export interface ErrorResponse {
  error: string; // User-friendly error message
  code: string; // Machine-readable error code
  details?: Record<string, any>; // Additional context
}

// ============================================================================
// ERROR CODES
// ============================================================================

export enum ErrorCode {
  // 400 Bad Request
  INVALID_JSON = 'INVALID_JSON',
  MISSING_FIELDS = 'MISSING_FIELDS',
  INVALID_SERVICE = 'INVALID_SERVICE',
  INVALID_CREDENTIAL_FORMAT = 'INVALID_CREDENTIAL_FORMAT',
  DUPLICATE_CREDENTIAL = 'DUPLICATE_CREDENTIAL',

  // 401 Unauthorized
  MISSING_TOKEN = 'MISSING_TOKEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',

  // 403 Forbidden
  ACCESS_DENIED = 'ACCESS_DENIED',

  // 404 Not Found
  CREDENTIAL_NOT_FOUND = 'CREDENTIAL_NOT_FOUND',
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',

  // 409 Conflict
  CREDENTIAL_EXISTS = 'CREDENTIAL_EXISTS',

  // 500 Server Error
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
}
