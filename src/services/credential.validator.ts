/**
 * Credential Validator
 * 
 * Validates credential format for each service type
 * Ensures required fields are present before encryption
 */

import {
  CredentialData,
  GA4Credential,
  GoogleSheetsCredential,
  MetaCredential,
  ServiceType,
  ShopifyCredential,
  ValidationResult,
} from '../types/credential-system';

/**
 * Validate credential format for a service type
 * 
 * @param serviceType - The service type
 * @param credential - The credential data to validate
 * @returns Validation result
 */
export function validateCredentialFormat(
  serviceType: ServiceType,
  credential: any
): ValidationResult {
  switch (serviceType) {
    case 'google_sheets':
      return validateGoogleSheetsCredential(credential);
    case 'meta':
      return validateMetaCredential(credential);
    case 'ga4':
      return validateGA4Credential(credential);
    case 'shopify':
      return validateShopifyCredential(credential);
    default:
      return {
        isValid: false,
        errors: [{ field: 'service_type', message: 'Unknown service type' }],
      };
  }
}

/**
 * Validate Google Sheets credential
 * 
 * Expected format: Service account JSON from Google Cloud Console
 */
function validateGoogleSheetsCredential(
  credential: any
): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  if (credential.type !== 'service_account') {
    errors.push({
      field: 'type',
      message: 'Must be "service_account"',
    });
  }

  const requiredFields = [
    'project_id',
    'private_key_id',
    'private_key',
    'client_email',
    'client_id',
    'auth_uri',
    'token_uri',
  ];

  for (const field of requiredFields) {
    if (!credential[field] || typeof credential[field] !== 'string') {
      errors.push({
        field,
        message: `${field} is required and must be a string`,
      });
    }
  }

  // Validate private key format (PEM)
  if (
    credential.private_key &&
    !credential.private_key.startsWith('-----BEGIN PRIVATE KEY-----')
  ) {
    errors.push({
      field: 'private_key',
      message: 'Invalid private key format (expected PEM)',
    });
  }

  // Validate email format
  if (
    credential.client_email &&
    !credential.client_email.includes('@') &&
    !credential.client_email.includes('.gserviceaccount.com')
  ) {
    errors.push({
      field: 'client_email',
      message: 'Invalid service account email',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Meta Ads credential
 * 
 * Expected format: OAuth 2.0 token response
 */
function validateMetaCredential(credential: any): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  if (!credential.access_token || typeof credential.access_token !== 'string') {
    errors.push({
      field: 'access_token',
      message: 'access_token is required',
    });
  }

  if (
    credential.token_type &&
    credential.token_type.toLowerCase() !== 'bearer'
  ) {
    errors.push({
      field: 'token_type',
      message: 'token_type should be "bearer"',
    });
  }

  if (!credential.account_id || typeof credential.account_id !== 'string') {
    errors.push({
      field: 'account_id',
      message: 'account_id is required',
    });
  }

  // Validate access token format (Meta tokens typically start with EAAB or similar)
  if (
    credential.access_token &&
    !credential.access_token.match(/^EA[A-Z0-9]{20,}$/)
  ) {
    errors.push({
      field: 'access_token',
      message: 'Invalid Meta access token format',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Google Analytics 4 credential
 * 
 * Expected format: OAuth 2.0 credentials
 */
function validateGA4Credential(credential: any): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  if (!credential.client_id || typeof credential.client_id !== 'string') {
    errors.push({
      field: 'client_id',
      message: 'client_id is required',
    });
  }

  if (
    !credential.client_secret ||
    typeof credential.client_secret !== 'string'
  ) {
    errors.push({
      field: 'client_secret',
      message: 'client_secret is required',
    });
  }

  if (
    !credential.refresh_token ||
    typeof credential.refresh_token !== 'string'
  ) {
    errors.push({
      field: 'refresh_token',
      message: 'refresh_token is required',
    });
  }

  if (!credential.property_id || typeof credential.property_id !== 'string') {
    errors.push({
      field: 'property_id',
      message: 'property_id is required',
    });
  }

  // Validate property ID format (numeric or alphanumeric)
  if (credential.property_id && !credential.property_id.match(/^[0-9]+$/)) {
    errors.push({
      field: 'property_id',
      message: 'property_id should be numeric',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Shopify credential
 * 
 * Expected format: API access token
 */
function validateShopifyCredential(credential: any): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  if (!credential.shop_url || typeof credential.shop_url !== 'string') {
    errors.push({
      field: 'shop_url',
      message: 'shop_url is required (e.g., mystore.myshopify.com)',
    });
  }

  if (!credential.access_token || typeof credential.access_token !== 'string') {
    errors.push({
      field: 'access_token',
      message: 'access_token is required',
    });
  }

  if (!credential.api_version || typeof credential.api_version !== 'string') {
    errors.push({
      field: 'api_version',
      message: 'api_version is required (e.g., 2024-01)',
    });
  }

  // Validate shop URL format
  if (
    credential.shop_url &&
    !credential.shop_url.match(/^[a-z0-9\-]+\.myshopify\.com$/)
  ) {
    errors.push({
      field: 'shop_url',
      message: 'Invalid shop URL format',
    });
  }

  // Validate access token format (Shopify tokens typically start with shpat_)
  if (
    credential.access_token &&
    !credential.access_token.startsWith('shpat_')
  ) {
    errors.push({
      field: 'access_token',
      message: 'Invalid Shopify access token format',
    });
  }

  // Validate API version format
  if (
    credential.api_version &&
    !credential.api_version.match(/^\d{4}-\d{2}$/)
  ) {
    errors.push({
      field: 'api_version',
      message: 'Invalid API version format (expected YYYY-MM)',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize credential for logging
 * Removes sensitive fields
 */
export function sanitizeCredentialForLogging(credential: any): Record<string, unknown> {
  const sanitized = { ...credential };

  // Remove sensitive fields
  const sensitiveFields = [
    'access_token',
    'refresh_token',
    'private_key',
    'client_secret',
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}
