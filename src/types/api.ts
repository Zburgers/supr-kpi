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
  VALIDATION_ERROR = 'VALIDATION_ERROR',
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

// ============================================================================
// SYNC ENDPOINTS
// ============================================================================

/**
 * Base sync request interface
 */
export interface SyncRequest {
  credentialId: string | number;
  options?: {
    spreadsheetId?: string;
    sheetName?: string;
  };
}

/**
 * Base sync response interface
 */
export interface SyncResponse {
  success: boolean;
  data?: {
    service: string;
    date: string;
    id: string; // UUID
    spreadsheetId: string;
    sheetName: string;
    metrics: any;
    appendResult: {
      mode: 'append' | 'update' | 'skip';
    } & (
      | { success: true; rowNumber: number; id: string } // UUID
      | { success: false; error: string }
    );
  };
  message?: string;
  error?: string;
}

// ============================================================================
// GA4 ENDPOINTS
// ============================================================================

/**
 * POST /api/ga4/sync
 */
export interface Ga4SyncRequest {
  credentialId: string | number;
  options?: {
    spreadsheetId?: string;
    sheetName?: string;
  };
}

export interface Ga4SyncResponse {
  success: boolean;
  data?: {
    metrics: {
      id?: string; // Changed to string for UUID
      date: string;
      sessions: number;
      users: number;
      add_to_cart: number;
      purchases: number;
      revenue: number;
      bounce_rate: number;
    };
    appendResult: {
      mode: 'append' | 'update' | 'skip';
    } & (
      | { success: true; rowNumber: number; id: string } // Changed to string for UUID
      | { success: false; error: string }
    );
    spreadsheetId: string;
    sheetName: string;
  };
  error?: string;
}

// ============================================================================
// SHOPIFY ENDPOINTS
// ============================================================================

/**
 * POST /api/shopify/sync
 */
export interface ShopifySyncRequest {
  credentialId: string | number;
  options?: {
    spreadsheetId?: string;
    sheetName?: string;
  };
}

export interface ShopifySyncResponse {
  success: boolean;
  data?: {
    metrics: {
      id?: string; // Changed to string for UUID
      date: string;
      total_orders: number;
      total_revenue: number;
      net_revenue: number;
      total_returns: number;
      new_customers: number;
      repeat_customers: number;
    };
    appendResult: {
      mode: 'append' | 'update' | 'skip';
    } & (
      | { success: true; rowNumber: number; id: string } // Changed to string for UUID
      | { success: false; error: string }
    );
    spreadsheetId: string;
    sheetName: string;
  };
  error?: string;
}

// ============================================================================
// META ENDPOINTS
// ============================================================================

/**
 * POST /api/meta/sync
 */
export interface MetaSyncRequest {
  credentialId: string | number;
  options?: {
    spreadsheetId?: string;
    sheetName?: string;
  };
}

export interface MetaSyncResponse {
  success: boolean;
  data?: {
    metrics: {
      id?: string; // UUID
      date: string;
      spend: number;
      reach: number;
      impressions: number;
      clicks: number;
      landing_page_views: number;
      add_to_cart: number;
      initiate_checkout: number;
      purchases: number;
      revenue: number;
      metricSources?: {
        landing_page_views_source: string;
        add_to_cart_source: string;
        initiate_checkout_source: string;
        purchases_source: string;
        revenue_source: string;
      };
    };
    appendResult: {
      mode: 'append' | 'update' | 'skip';
    } & (
      | { success: true; rowNumber: number; id: string } // UUID
      | { success: false; error: string }
    );
    spreadsheetId: string;
    sheetName: string;
  };
  message?: string;
  error?: string;
}
