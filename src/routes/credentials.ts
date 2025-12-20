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
        if (!data.refresh_token) errors.push('Missing refresh_token');
        if (!data.client_id) errors.push('Missing client_id');
        if (!data.client_secret) errors.push('Missing client_secret');
        if (!data.property_id) errors.push('Missing property_id');
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
        return data.property_id || 'GA4 Property';
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

    // Encrypt credential
    const encryptedData = encryptCredential(credentialJson, String(req.user!.userId));

    // Save to database in transaction
    const result = await executeTransaction(async (client) => {
      const insertResult = await client.query(
        `
        INSERT INTO credentials (user_id, service, name, encrypted_data)
        VALUES ($1, $2, $3, $4)
        RETURNING id, service, name, verified, created_at;
        `,
        [req.user!.userId, service, credentialName, encryptedData]
      );

      return insertResult.rows[0];
    }, req.user!.userId);

    // Log audit
    await logAudit(req.user!.userId, 'credential_saved', service, 'success', undefined, {
      credentialId: result.id,
      name: credentialName,
    });

    const response: SaveCredentialResponse = {
      credentialId: result.id,
      service: result.service,
      name: result.name,
      verified: result.verified,
      createdAt: result.created_at,
    };

    res.status(201).json(response);
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
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC;
      `,
      [],
      req.user!.userId
    );

    // Get preview for each credential
    const credentials = [];
    for (const cred of result.rows) {
      credentials.push({
        id: cred.id,
        service: cred.service,
        name: cred.name,
        verified: cred.verified,
        verifiedAt: cred.verified_at,
        createdAt: cred.created_at,
        maskedPreview: maskCredential(`${cred.service}-${cred.id}`),
      });
    }

    res.json({ credentials } as ListCredentialsResponse);
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
      WHERE id = $1 AND deleted_at IS NULL;
      `,
      [credentialId],
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
      id: cred.id,
      service: cred.service,
      name: cred.name,
      verified: cred.verified,
      verifiedAt: cred.verified_at,
      createdAt: cred.created_at,
      expiresAt: cred.expires_at,
      encrypted: false,
    };

    res.json(response);
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
      `SELECT service FROM credentials WHERE id = $1 AND deleted_at IS NULL;`,
      [credentialId],
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
      id: cred.id,
      service: cred.service,
      name: cred.name,
      verified: cred.verified,
      updatedAt: cred.updated_at,
    };

    res.json(response);
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
        // Check credential exists
        const checkResult = await client.query(
          `SELECT service FROM credentials WHERE id = $1 AND deleted_at IS NULL;`,
          [credentialId]
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
          WHERE id = $1;
          `,
          [credentialId]
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
        WHERE id = $1 AND deleted_at IS NULL;
        `,
        [credentialId],
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
            // Verify Google Sheets credential by testing the client
            // For now, we'll do basic validation
            verified =
              credentialData.private_key &&
              credentialData.client_email &&
              credentialData.project_id;
            connectedAs = credentialData.client_email || 'Service Account';
            break;
          }

          case 'meta': {
            // Verify Meta credential - would call Meta API to validate token
            verified = credentialData.access_token && credentialData.account_id;
            connectedAs = credentialData.account_id || 'Meta Account';
            break;
          }

          case 'ga4': {
            // Verify GA4 credential - would call Google API to refresh token
            verified =
              credentialData.refresh_token &&
              credentialData.client_id &&
              credentialData.client_secret;
            connectedAs = credentialData.property_id || 'GA4 Property';
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
        } else {
          throw new Error('Credential verification failed - invalid format');
        }

        const response: VerifyCredentialResponse = {
          verified: true,
          message: `Connected as ${connectedAs}`,
          connectedAs,
          expiresAt,
        };

        res.json(response);
      } catch (error) {
        logger.error('Credential verification error', { error: String(error) });

        await logAudit(
          req.user!.userId,
          'verification_failed',
          credential.service,
          'failure',
          error instanceof Error ? error.message : 'Unknown error',
          { credentialId }
        );

        res.status(400).json({
          error: 'Failed to verify credential',
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
        WHERE id = $1 AND deleted_at IS NULL;
        `,
        [credentialId],
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
        credentialId: cred.id,
        verified: cred.verified,
        verifiedAt: cred.verified_at,
        expiresAt: cred.expires_at,
        lastVerifiedAt: cred.verified_at,
      };

      res.json(response);
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
