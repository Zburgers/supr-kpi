/**
 * Credential System Types & Interfaces
 * 
 * Comprehensive TypeScript definitions for the secure credential management system.
 * All types enforce strict null safety and are designed to prevent credential data leakage.
 */

// ============================================================================
// SERVICE TYPES
// ============================================================================

/**
 * Supported external services for credential storage
 */
export type ServiceType = 'google_sheets' | 'meta' | 'ga4' | 'shopify';

/**
 * Service configuration metadata
 */
export interface ServiceTypeConfig {
  id: ServiceType;
  name: string;
  description: string;
  requiredFields: string[];
  supportsOAuth: boolean;
  supportsServiceAccount: boolean;
  refreshTokenExpiry?: number; // in seconds
}

// ============================================================================
// CREDENTIAL DATA STRUCTURES
// ============================================================================

/**
 * Base credential data - overridden by service-specific types
 */
export interface BaseCredentialData {
  _credentialType: ServiceType;
}

/**
 * Google Sheets credential (Service Account JSON)
 */
export interface GoogleSheetsCredential extends BaseCredentialData {
  _credentialType: 'google_sheets';
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string; // PEM format
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

/**
 * Meta Ads credential (OAuth 2.0)
 */
export interface MetaCredential extends BaseCredentialData {
  _credentialType: 'meta';
  access_token: string;
  token_type: 'bearer';
  expires_in?: number;
  refresh_token?: string;
  account_id: string;
  account_name?: string;
}

/**
 * Google Analytics 4 credential (OAuth 2.0)
 */
export interface GA4Credential extends BaseCredentialData {
  _credentialType: 'ga4';
  client_id: string;
  client_secret: string;
  refresh_token: string;
  property_id: string;
  access_token?: string; // Runtime - never stored
}

/**
 * Shopify credential (API Access Token)
 */
export interface ShopifyCredential extends BaseCredentialData {
  _credentialType: 'shopify';
  shop_url: string; // e.g., "mystore.myshopify.com"
  access_token: string;
  api_version: string; // e.g., "2024-01"
  scope?: string[]; // Authorized scopes
}

/**
 * Union type for all credential types
 */
export type CredentialData =
  | GoogleSheetsCredential
  | MetaCredential
  | GA4Credential
  | ShopifyCredential;

// ============================================================================
// ENCRYPTION & STORAGE
// ============================================================================

/**
 * Encrypted credential as stored in database
 * Never include plain credential data in this interface
 */
export interface EncryptedCredentialRecord {
  id: string;
  user_id: number;
  service_type: ServiceType;
  credential_name: string;
  
  // Encryption metadata
  encrypted_data: Buffer; // AES-256-GCM ciphertext
  iv: Buffer; // Initialization vector (16 bytes)
  auth_tag: Buffer; // Authentication tag (16 bytes)
  key_version: number; // Which master key was used
  
  // Status & lifecycle
  version: number; // Credential version (for updates)
  is_active: boolean;
  verification_status: 'pending' | 'valid' | 'invalid';
  last_verified_at?: Date;
  expires_at?: Date;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Encryption/Decryption request/response
 */
export interface EncryptionRequest {
  data: CredentialData;
  userId: number;
  serviceType: ServiceType;
  credentialName: string;
  keyVersion: number;
}

export interface EncryptionResult {
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

export interface DecryptionRequest {
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
  userId: number;
  serviceType: ServiceType;
  credentialName: string;
}

export interface DecryptionResult {
  data: CredentialData;
  isValid: boolean;
}

// ============================================================================
// API REQUEST/RESPONSE MODELS
// ============================================================================

/**
 * Create credential request
 */
export interface CreateCredentialRequest {
  service_type: ServiceType;
  credential_name: string;
  credential_data: CredentialData;
  expires_at?: string; // ISO 8601
}

/**
 * Update credential request
 */
export interface UpdateCredentialRequest {
  credential_name?: string;
  credential_data?: CredentialData;
  expires_at?: string | null;
}

/**
 * Credential response (no encrypted data included)
 */
export interface CredentialResponse {
  id: string;
  user_id: number;
  service_type: ServiceType;
  credential_name: string;
  version: number;
  is_active: boolean;
  verification_status: 'pending' | 'valid' | 'invalid';
  last_verified_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * List credentials response
 */
export interface ListCredentialsResponse {
  credentials: CredentialResponse[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Verify credential response
 */
export interface VerifyCredentialResponse {
  credential_id: string;
  is_valid: boolean;
  verification_status: 'valid' | 'invalid';
  last_verified_at: string;
  message: string;
}

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

/**
 * User record from database
 */
export interface UserRecord {
  id: number;
  clerk_id: string;
  email: string;
  name?: string;
  status: 'active' | 'suspended' | 'deleted';
  created_at: Date;
  updated_at: Date;
}

/**
 * User context from JWT
 */
export interface UserContext {
  userId: number;
  clerkId: string;
  email: string;
  status: 'active' | 'suspended' | 'deleted';
}

/**
 * Request context with user info
 */
export interface RequestContext {
  user: UserContext;
  requestId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Audit log entry for credential access
 */
export interface AuditLogEntry {
  id: number;
  user_id: number;
  credential_id?: number;
  action: 'created' | 'retrieved' | 'updated' | 'deleted' | 'verified';
  action_status: 'success' | 'failed';
  ip_address?: string;
  user_agent?: string;
  request_id: string;
  failure_reason?: string;
  created_at: Date;
}

/**
 * Audit log create request (internal use)
 */
export interface CreateAuditLogRequest {
  user_id: number;
  credential_id?: number;
  action: AuditLogEntry['action'];
  action_status: AuditLogEntry['action_status'];
  ip_address?: string;
  user_agent?: string;
  request_id: string;
  failure_reason?: string;
}

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

/**
 * Service configuration per user
 */
export interface ServiceConfig {
  id: number;
  user_id: number;
  service_type: ServiceType;
  is_enabled: boolean;
  config_data?: Record<string, unknown>;
  oauth_refresh_token_id?: number;
  last_sync_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Sheet mapping for syncing data
 */
export interface SheetMapping {
  id: number;
  user_id: number;
  service_type: ServiceType;
  sheet_id: string;
  sheet_name: string;
  column_mappings: Record<string, string>; // metric_field -> column_letter
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// SYNC JOBS
// ============================================================================

/**
 * Scheduled sync job
 */
export interface SyncJob {
  id: number;
  user_id: number;
  service_type: ServiceType;
  job_type: 'scheduled' | 'manual' | 'webhook';
  cron_expression?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  last_run_at?: Date;
  next_run_at?: Date;
  last_run_status?: string;
  last_error_message?: string;
  run_count: number;
  failure_count: number;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * Encryption key metadata
 */
export interface EncryptionKeyRecord {
  id: number;
  key_version: number;
  algorithm: 'aes-256-gcm';
  key_hash: string; // SHA-256 of key material
  is_active: boolean;
  is_retired: boolean;
  created_at: Date;
  retired_at?: Date;
  rotation_reason?: string;
  rotated_by?: string;
}

/**
 * Master key (loaded from Vault, never in DB)
 */
export interface MasterKey {
  version: number;
  key: Buffer; // 32 bytes for AES-256
  algorithm: 'aes-256-gcm';
  isActive: boolean;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Generic API error response
 */
export interface ErrorResponse {
  error: string;
  error_code: string;
  request_id: string;
}

/**
 * Internal error details (never sent to client)
 */
export interface InternalError {
  timestamp: Date;
  request_id: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  component: string;
  error: string;
  context: Record<string, unknown>; // No credential data
}

/**
 * Service-specific verification errors
 */
export interface VerificationError {
  service: ServiceType;
  reason: 'auth_failed' | 'expired' | 'invalid_format' | 'network' | 'unknown';
  timestamp: Date;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Result wrapper for operations
 */
export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Credential validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

// ============================================================================
// TYPE GUARDS & HELPERS
// ============================================================================

/**
 * Type guard to check credential type
 */
export function isGoogleSheetsCredential(
  cred: CredentialData
): cred is GoogleSheetsCredential {
  return cred._credentialType === 'google_sheets';
}

export function isMetaCredential(cred: CredentialData): cred is MetaCredential {
  return cred._credentialType === 'meta';
}

export function isGA4Credential(cred: CredentialData): cred is GA4Credential {
  return cred._credentialType === 'ga4';
}

export function isShopifyCredential(
  cred: CredentialData
): cred is ShopifyCredential {
  return cred._credentialType === 'shopify';
}

/**
 * Extract service type from credential
 */
export function getServiceTypeFromCredential(
  cred: CredentialData
): ServiceType {
  return cred._credentialType;
}

/**
 * Create typed credential with type safety
 */
export function createCredential<T extends ServiceType>(
  type: T,
  data: Extract<CredentialData, { _credentialType: T }>
): Extract<CredentialData, { _credentialType: T }> {
  return data;
}
