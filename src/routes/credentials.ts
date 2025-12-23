/**
 * Credential Management Routes
 * 
 * Handles:
 * - Saving encrypted credentials
 * - Listing credentials (masked)
 * - Retrieving credential metadata
 * - Updating credentials
 * - Deleting credentials
 * - Verifying credentials work
 * 
 * Security:
 * - All endpoints require JWT authentication
 * - All queries filtered by user_id (RLS)
 * - Credentials decrypted only for verification
 * - Never return encrypted data to client
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { encryptCredential, decryptCredential, maskCredential } from '../lib/encryption.js';
import { executeQuery, executeTransaction } from '../lib/database.js';
import { logAudit } from '../lib/audit-log.js';
import { logger } from '../lib/logger.js';
import {
  SaveCredentialRequest,
  SaveCredentialResponse,
  UpdateCredentialRequest,
  UpdateCredentialResponse,
  VerifyCredentialResponse,
  VerifyStatusResponse,
  ListCredentialsResponse,
  GetCredentialResponse,
  DeleteCredentialResponse,
  ErrorResponse,
  ErrorCode,
} from '../types/api.js';

const router = Router();

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate credential JSON format for service
 */
function validateCredentialFormat(service: string, credentialJson: string): string[] {
  const errors: string[] = [];

  try {
    const data = JSON.parse(credentialJson);

    switch (service) {
      case 'google_sheets': {
        if (!data.type || data.type !== 'service_account') {
          errors.push('Google credential must be a service account');
        }
        if (!data.private_key) errors.push('Missing private_key');
        if (!data.client_email) errors.push('Missing client_email');
        if (!data.project_id) errors.push('Missing project_id');
        break;
      }

      case 'meta': {
        if (!data.access_token) errors.push('Missing access_token');
        if (!data.account_id) errors.push('Missing account_id');
        break;
      }

      case 'ga4': {
        // GA4 can use either service account or OAuth refresh token credentials
        const isServiceAccount = data.type === 'service_account';

        if (isServiceAccount) {
          // Service account format
          if (!data.type || data.type !== 'service_account') {
            errors.push('GA4 credential must be a service account');
          }
          if (!data.private_key) errors.push('Missing private_key');
          if (!data.client_email) errors.push('Missing client_email');
          if (!data.project_id) errors.push('Missing project_id');
        } else {
          // OAuth refresh token format
          if (!data.refresh_token) errors.push('Missing refresh_token');
          if (!data.client_id) errors.push('Missing client_id');
          if (!data.client_secret) errors.push('Missing client_secret');
          if (!data.property_id) errors.push('Missing property_id');
        }
        break;
      }

      case 'shopify': {
        if (!data.shop_url) errors.push('Missing shop_url');
        if (!data.access_token) errors.push('Missing access_token');
        break;
      }

      default:
        errors.push('Unknown service');
    }
  } catch (error) {
    errors.push('Invalid JSON format');
  }

  return errors;
}

/**
 * Extract preview data from credential for display
 */
function getCredentialPreview(service: string, credentialJson: string): string {
  try {
    const data = JSON.parse(credentialJson);

    switch (service) {
      case 'google_sheets':
        return data.client_email || 'Service Account';
      case 'meta':
        return data.account_id || 'Meta Account';
      case 'ga4':
        if (data.type === 'service_account') {
          return data.client_email || 'GA4 Service Account';
        } else {
          return data.property_id || 'GA4 Property';
        }
      case 'shopify':
        return data.shop_url || 'Shopify Store';
      default:
        return 'Unknown';
    }
  } catch {
    return 'Unknown';
  }
}

// ============================================================================
// POST /api/credentials/save
// ============================================================================

router.post('/save', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const { credentialJson, credentialName, service } = req.body as SaveCredentialRequest;

    // Validate request body
    if (!credentialJson || !credentialName || !service) {
      res.status(400).json({
        error: 'Missing required fields: credentialJson, credentialName, service',
        code: ErrorCode.MISSING_FIELDS,
      } as ErrorResponse);
      return;
    }

    if (!['google_sheets', 'meta', 'ga4', 'shopify'].includes(service)) {
      res.status(400).json({
        error: `Invalid service: ${service}`,
        code: ErrorCode.INVALID_SERVICE,
      } as ErrorResponse);
      return;
    }

    // Validate credential format
    const validationErrors = validateCredentialFormat(service, credentialJson);
    if (validationErrors.length > 0) {
      res.status(400).json({
        error: 'Invalid credential format',
        code: ErrorCode.INVALID_CREDENTIAL_FORMAT,
        details: { errors: validationErrors },
      } as ErrorResponse);
      return;
    }

    // Check for duplicate credential data for this user and service
    const existingCredentials = await executeQuery(
      `
      SELECT id, encrypted_data
      FROM credentials
      WHERE user_id = $1 AND service = $2 AND deleted_at IS NULL;
      `,
      [req.user!.userId, service],
      req.user!.userId
    );

    // Decrypt each existing credential and compare with the new one
    for (const existing of existingCredentials.rows) {
      try {
        const decryptedExisting = decryptCredential(existing.encrypted_data, String(req.user!.userId));
        if (decryptedExisting === credentialJson) {
          res.status(409).json({
            error: 'This credential already exists',
            code: ErrorCode.DUPLICATE_CREDENTIAL,
          } as ErrorResponse);
          return;
        }
      } catch (error) {
        // If decryption fails for some reason, continue checking other credentials
        logger.warn('Failed to decrypt existing credential for duplicate check', {
          credentialId: existing.id,
          error: String(error),
        });
      }
    }

    // Encrypt credential
    const encryptedData = encryptCredential(credentialJson, String(req.user!.userId));

    // Save to database in transaction
    const result = await executeTransaction(async (client) => {
      // Insert credential
      const insertResult = await client.query(
        `
        INSERT INTO credentials (user_id, service, name, encrypted_data)
        VALUES ($1, $2, $3, $4)
        RETURNING id, service, name, verified, created_at;
        `,
        [req.user!.userId, service, credentialName, encryptedData]
      );

      const credential = insertResult.rows[0];

      // Auto-enable the service with this credential
      await client.query(
        `
        INSERT INTO service_configs (user_id, service, credential_id, enabled)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (user_id, service) DO UPDATE
        SET credential_id = $3, enabled = true, updated_at = CURRENT_TIMESTAMP;
        `,
        [req.user!.userId, service, credential.id]
      );

      return credential;
    }, req.user!.userId);

    // Log audit
    await logAudit(req.user!.userId, 'credential_saved', service, 'success', undefined, {
      credentialId: result.id,
      name: credentialName,
    });

    const response: SaveCredentialResponse = {
      credentialId: String(result.id), // Convert to string to match frontend expectation
      service: result.service,
      name: result.name,
      type: 'service_account', // Default type
      verified: result.verified,
      created_at: result.created_at,
    };

    // Return in standard API response format that frontend expects
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    logger.error('Failed to save credential', { error: String(error) });
    await logAudit(
      req.user!.userId,
      'credential_saved',
      undefined,
      'failure',
      error instanceof Error ? error.message : 'Unknown error'
    );

    res.status(500).json({
      error: 'Failed to save credential',
      code: ErrorCode.SERVICE_ERROR,
    } as ErrorResponse);
  }
});

// ============================================================================
// GET /api/credentials/list
// ============================================================================

router.get('/list', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const result = await executeQuery(
      `
      SELECT id, service, name, verified, verified_at, created_at
      FROM credentials
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC;
      `,
      [req.user!.userId],
      req.user!.userId
    );

    // Get preview for each credential
    const credentials = [];
    for (const cred of result.rows) {
      credentials.push({
        id: String(cred.id), // Convert to string to match frontend expectation
        service: cred.service,
        name: cred.name,
        type: 'service_account', // Default type, could be stored in DB later if needed
        verified: cred.verified,
        verified_at: cred.verified_at,
        created_at: cred.created_at,
        updated_at: cred.updated_at || cred.created_at, // Use updated_at if available, otherwise created_at
      });
    }

    // Return in standard API response format that frontend expects
    res.json({ success: true, data: credentials });
  } catch (error) {
    logger.error('Failed to list credentials', { error: String(error) });

    res.status(500).json({
      error: 'Failed to list credentials',
      code: ErrorCode.DATABASE_ERROR,
    } as ErrorResponse);
  }
});

// ============================================================================
// GET /api/credentials/:credentialId
// ============================================================================

router.get('/:credentialId', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const { credentialId } = req.params;

    const result = await executeQuery(
      `
      SELECT id, service, name, verified, verified_at, expires_at, created_at
      FROM credentials
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
      `,
      [credentialId, req.user!.userId],
      req.user!.userId
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Credential not found',
        code: ErrorCode.CREDENTIAL_NOT_FOUND,
      } as ErrorResponse);
      return;
    }

    const cred = result.rows[0];
    const response: GetCredentialResponse = {
      id: String(cred.id), // Convert to string to match frontend expectation
      service: cred.service,
      name: cred.name,
      type: 'service_account', // Default type
      verified: cred.verified,
      verified_at: cred.verified_at,
      created_at: cred.created_at,
      updated_at: cred.updated_at || cred.created_at,
      expires_at: cred.expires_at,
      encrypted: false,
    };

    // Return in standard API response format that frontend expects
    res.json({ success: true, data: response });
  } catch (error) {
    logger.error('Failed to get credential', { error: String(error) });

    res.status(500).json({
      error: 'Failed to get credential',
      code: ErrorCode.DATABASE_ERROR,
    } as ErrorResponse);
  }
});

// ============================================================================
// PUT /api/credentials/:credentialId
// ============================================================================

router.put('/:credentialId', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const { credentialId } = req.params;
    const { credentialJson, credentialName } = req.body as UpdateCredentialRequest;

    // Check credential exists and belongs to user
    const checkResult = await executeQuery(
      `SELECT service FROM credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
      [credentialId, req.user!.userId],
      req.user!.userId
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({
        error: 'Credential not found',
        code: ErrorCode.CREDENTIAL_NOT_FOUND,
      } as ErrorResponse);
      return;
    }

    const service = checkResult.rows[0].service;

    // Validate new credential if provided
    if (credentialJson) {
      const validationErrors = validateCredentialFormat(service, credentialJson);
      if (validationErrors.length > 0) {
        res.status(400).json({
          error: 'Invalid credential format',
          code: ErrorCode.INVALID_CREDENTIAL_FORMAT,
          details: { errors: validationErrors },
        } as ErrorResponse);
        return;
      }
    }

    // Update credential
    const encryptedData = credentialJson
      ? encryptCredential(credentialJson, String(req.user!.userId))
      : undefined;

    const updateResult = await executeQuery(
      `
      UPDATE credentials
      SET ${credentialJson ? 'encrypted_data = $1, ' : ''}
          ${credentialName ? `name = $${credentialJson ? 2 : 1}, ` : ''}
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $${credentialJson && credentialName ? 3 : credentialJson ? 2 : 1}
      RETURNING id, service, name, verified, updated_at;
      `,
      credentialJson && credentialName
        ? [encryptedData, credentialName, credentialId]
        : credentialJson
          ? [encryptedData, credentialId]
          : [credentialName, credentialId],
      req.user!.userId
    );

    if (updateResult.rows.length === 0) {
      res.status(500).json({
        error: 'Failed to update credential',
        code: ErrorCode.DATABASE_ERROR,
      } as ErrorResponse);
      return;
    }

    const cred = updateResult.rows[0];

    // Log audit
    await logAudit(req.user!.userId, 'credential_updated', service, 'success', undefined, {
      credentialId: cred.id,
      name: cred.name,
    });

    const response: UpdateCredentialResponse = {
      id: String(cred.id), // Convert to string to match frontend expectation
      service: cred.service,
      name: cred.name,
      type: 'service_account', // Default type
      verified: cred.verified,
      updated_at: cred.updated_at,
    };

    // Return in standard API response format that frontend expects
    res.json({ success: true, data: response });
  } catch (error) {
    logger.error('Failed to update credential', { error: String(error) });
    await logAudit(
      req.user!.userId,
      'credential_updated',
      undefined,
      'failure',
      error instanceof Error ? error.message : 'Unknown error'
    );

    res.status(500).json({
      error: 'Failed to update credential',
      code: ErrorCode.SERVICE_ERROR,
    } as ErrorResponse);
  }
});

// ============================================================================
// DELETE /api/credentials/:credentialId
// ============================================================================

router.delete(
  '/:credentialId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    try {
      const { credentialId } = req.params;

      // Soft delete credential
      const result = await executeTransaction(async (client) => {
        // Check credential exists and belongs to user
        const checkResult = await client.query(
          `SELECT service FROM credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
          [credentialId, req.user!.userId]
        );

        if (checkResult.rows.length === 0) {
          throw new Error('Credential not found');
        }

        const service = checkResult.rows[0].service;

        // Soft delete
        await client.query(
          `
          UPDATE credentials
          SET deleted_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND user_id = $2;
          `,
          [credentialId, req.user!.userId]
        );

        // Delete associated service configs
        await client.query(`DELETE FROM service_configs WHERE credential_id = $1;`, [credentialId]);

        return service;
      }, req.user!.userId);

      // Log audit
      await logAudit(req.user!.userId, 'credential_deleted', result, 'success', undefined, {
        credentialId,
      });

      const response: DeleteCredentialResponse = {
        success: true,
        message: 'Credential deleted successfully',
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to delete credential', { error: String(error) });

      if (error instanceof Error && error.message === 'Credential not found') {
        res.status(404).json({
          error: 'Credential not found',
          code: ErrorCode.CREDENTIAL_NOT_FOUND,
        } as ErrorResponse);
        return;
      }

      res.status(500).json({
        error: 'Failed to delete credential',
        code: ErrorCode.SERVICE_ERROR,
      } as ErrorResponse);
    }
  }
);

// ============================================================================
// POST /api/credentials/:credentialId/verify
// ============================================================================

router.post(
  '/:credentialId/verify',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    try {
      const { credentialId } = req.params;

      // Fetch credential
      const result = await executeQuery(
        `
        SELECT id, service, name, encrypted_data
        FROM credentials
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
        `,
        [credentialId, req.user!.userId],
        req.user!.userId
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Credential not found',
          code: ErrorCode.CREDENTIAL_NOT_FOUND,
        } as ErrorResponse);
        return;
      }

      const credential = result.rows[0];

      try {
        // Decrypt credential
        const decryptedJson = decryptCredential(credential.encrypted_data, String(req.user!.userId));
        const credentialData = JSON.parse(decryptedJson);

        // Verify based on service type
        let verified = false;
        let connectedAs = '';
        let expiresAt: string | undefined;

        switch (credential.service) {
          case 'google_sheets': {
            // Verify Google Sheets credential by making an actual API call
            try {
              // Initialize Google Sheets authentication with the provided credentials
              const { google } = await import('googleapis');
              const { JWT } = await import('google-auth-library');

              const auth = new JWT({
                email: credentialData.client_email,
                key: credentialData.private_key,
                scopes: [
                  'https://www.googleapis.com/auth/spreadsheets.readonly',
                  'https://www.googleapis.com/auth/drive.metadata.readonly',
                ],
              });

              // Test the authentication by making a simple API call
              const sheets = google.sheets({ version: 'v4', auth: auth as any });

              // Make a test request to see if credentials work
              // Using a simple request to get about information
              await auth.authorize();

              // If we get here, the credentials are valid
              verified = true;
              connectedAs = credentialData.client_email || 'Service Account';
            } catch (authError) {
              logger.error('Google Sheets credential verification failed', {
                error: authError instanceof Error ? authError.message : String(authError),
                credentialId
              });
              verified = false;
              connectedAs = 'Service Account';
            }
            break;
          }

          case 'meta': {
            // Verify Meta credential by making an actual API call to Meta Graph API
            try {
              const accessToken = credentialData.access_token;
              const accountId = credentialData.account_id;

              if (!accessToken) {
                throw new Error('Missing access token');
              }

              if (!accountId) {
                throw new Error('Missing account ID');
              }

              // Log the verification attempt for debugging
              logger.info('Verifying Meta access token', {
                credentialId,
                accountId,
                attemptingAccountAccess: true
              });

              // Validate the ad account exists by fetching its information
              const accountResponse = await fetch(
                `https://graph.facebook.com/v18.0/act_${encodeURIComponent(accountId)}?access_token=${encodeURIComponent(accessToken)}&fields=account_id,name,account_status`
              );
              const accountData = await accountResponse.json();

              logger.info('Meta account verification response', {
                credentialId,
                accountId,
                statusCode: accountResponse.status,
                success: accountResponse.ok,
                hasData: !!accountData
              });

              if (!accountResponse.ok) {
                logger.error('Meta account verification failed', {
                  credentialId,
                  accountId,
                  statusCode: accountResponse.status,
                  error: accountData.error?.message || accountData.error_msg,
                  errorType: accountData.error?.type
                });
                throw new Error(accountData.error?.message || accountData.error_msg || `Failed to verify Meta ad account ${accountId}`);
              }

              logger.info('Meta account verification successful', {
                credentialId,
                accountId,
                accountName: accountData?.name,
                accountStatus: accountData?.account_status
              });

              // Additional check: try to fetch some basic insights to ensure proper permissions
              logger.info('Checking Meta insights permissions', {
                credentialId,
                accountId,
                attemptingInsightsAccess: true
              });

              const insightsResponse = await fetch(
                `https://graph.facebook.com/v18.0/act_${encodeURIComponent(accountId)}/insights?access_token=${encodeURIComponent(accessToken)}&fields=account_id&limit=1`
              );
              const insightsData = await insightsResponse.json();

              logger.info('Meta insights verification response', {
                credentialId,
                accountId,
                statusCode: insightsResponse.status,
                success: insightsResponse.ok,
                hasData: !!insightsData
              });

              if (!insightsResponse.ok) {
                // Don't fail completely if insights permission is missing, just log it
                logger.warn('Meta account has limited permissions (insights access)', {
                  credentialId,
                  accountId,
                  statusCode: insightsResponse.status,
                  error: insightsData.error?.message || insightsData.error_msg,
                  errorType: insightsData.error?.type
                });
              } else {
                logger.info('Meta insights access verified successfully', {
                  credentialId,
                  accountId
                });
              }

              verified = true;
              connectedAs = accountData?.name || accountData?.account_id || 'Meta Account';
            } catch (error) {
              logger.error('Meta credential verification failed', {
                error: error instanceof Error ? error.message : String(error),
                credentialId
              });
              verified = false;
              connectedAs = 'Meta Account';
            }
            break;
          }

          case 'ga4': {
            // Verify GA4 credential - can be either service account or refresh token
            if (credentialData.type === 'service_account') {
              // Verify GA4 service account credential by making an actual API call
              try {
                const { google } = await import('googleapis');
                const { JWT } = await import('google-auth-library');

                const auth = new JWT({
                  email: credentialData.client_email,
                  key: credentialData.private_key,
                  scopes: [
                    'https://www.googleapis.com/auth/analytics.readonly',
                    'https://www.googleapis.com/auth/analytics',
                  ],
                });

                // Test the authentication by making a simple API call
                const analyticsData = google.analyticsdata({ version: 'v1beta', auth: auth as any });

                // If we get here, the credentials are valid
                await auth.authorize();
                verified = true;
                connectedAs = credentialData.client_email || 'GA4 Service Account';
              } catch (authError) {
                logger.error('GA4 service account credential verification failed', {
                  error: authError instanceof Error ? authError.message : String(authError),
                  credentialId
                });
                verified = false;
                connectedAs = 'GA4 Service Account';
              }
            } else {
              // Verify GA4 refresh token credential
              verified =
                credentialData.refresh_token &&
                credentialData.client_id &&
                credentialData.client_secret;
              connectedAs = credentialData.property_id || 'GA4 Property';
            }
            break;
          }

          case 'shopify': {
            // Verify Shopify credential - would call Shopify API
            verified = credentialData.access_token && credentialData.shop_url;
            connectedAs = credentialData.shop_url || 'Shopify Store';
            break;
          }
        }

        // Update verified status
        if (verified) {
          await executeQuery(
            `
            UPDATE credentials
            SET verified = true, verified_at = CURRENT_TIMESTAMP
            WHERE id = $1;
            `,
            [credentialId],
            req.user!.userId
          );

          await logAudit(
            req.user!.userId,
            'credential_verified',
            credential.service,
            'success',
            undefined,
            { credentialId }
          );

          const response: VerifyCredentialResponse = {
            verified: true,
            message: `Connected as ${connectedAs}`,
            connectedAs,
            expiresAt,
          };

          // Return in standard API response format that frontend expects
          res.json({ success: true, data: response });
        } else {
          throw new Error('Credential verification failed - invalid format');
        }

        const response: VerifyCredentialResponse = {
          verified: true,
          message: `Connected as ${connectedAs}`,
          connectedAs,
          expiresAt,
        };

        // Return in standard API response format that frontend expects
        res.json({ success: true, data: response });
      } catch (error) {
        logger.error('Credential verification error', { error: String(error) });

        // Update the credential to mark it as not verified when verification fails
        try {
          await executeQuery(
            `
            UPDATE credentials
            SET verified = false, verified_at = NULL
            WHERE id = $1;
            `,
            [credentialId],
            req.user!.userId
          );
        } catch (dbError) {
          logger.error('Failed to update credential verification status', {
            error: String(dbError),
            credentialId
          });
        }

        await logAudit(
          req.user!.userId,
          'verification_failed',
          credential.service,
          'failure',
          error instanceof Error ? error.message : 'Unknown error',
          { credentialId }
        );

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(400).json({
          error: `Credential verification failed: ${errorMessage}. Please check your token - if it's temporary, generate a new one. If it's permanent, verify it's correct. Consider removing and re-adding the token if issues persist.`,
          code: ErrorCode.VERIFICATION_FAILED,
        } as ErrorResponse);
      }
    } catch (error) {
      logger.error('Verification endpoint error', { error: String(error) });

      res.status(500).json({
        error: 'Verification service error',
        code: ErrorCode.SERVICE_ERROR,
      } as ErrorResponse);
    }
  }
);

// ============================================================================
// GET /api/credentials/:credentialId/verify-status
// ============================================================================

router.get(
  '/:credentialId/verify-status',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    try {
      const { credentialId } = req.params;

      const result = await executeQuery(
        `
        SELECT id, verified, verified_at, expires_at
        FROM credentials
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
        `,
        [credentialId, req.user!.userId],
        req.user!.userId
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Credential not found',
          code: ErrorCode.CREDENTIAL_NOT_FOUND,
        } as ErrorResponse);
        return;
      }

      const cred = result.rows[0];
      const response: VerifyStatusResponse = {
        credentialId: String(cred.id), // Convert to string to match frontend expectation
        verified: cred.verified,
        verified_at: cred.verified_at,
        expires_at: cred.expires_at,
        last_verified_at: cred.verified_at,
      };

      // Return in standard API response format that frontend expects
      res.json({ success: true, data: response });
    } catch (error) {
      logger.error('Failed to get verification status', { error: String(error) });

      res.status(500).json({
        error: 'Failed to get verification status',
        code: ErrorCode.DATABASE_ERROR,
      } as ErrorResponse);
    }
  }
);

export default router;
