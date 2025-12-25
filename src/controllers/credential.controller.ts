/**
 * Credential Controller
 * 
 * Handles credential management operations:
 * - Save, list, get, update, delete credentials
 * - Verify credentials
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Route,
  Path,
  Body,
  Tags,
  Security,
  Response,
  SuccessResponse,
  Request,
} from 'tsoa';
import * as express from 'express';
import { encryptCredential, decryptCredential } from '../lib/encryption.js';
import { executeQuery, executeTransaction } from '../lib/database.js';
import { logAudit } from '../lib/audit-log.js';
import { logger } from '../lib/logger.js';
import { AuthenticatedUser } from '../authentication.js';
import {
  ErrorResponse,
  SaveCredentialRequest,
  SaveCredentialResponse,
  CredentialListItem,
  GetCredentialResponse,
  UpdateCredentialRequest,
  UpdateCredentialResponse,
  DeleteCredentialResponse,
  VerifyCredentialResponse,
  VerifyStatusResponse,
} from './models.js';

// Helper functions
function validateCredentialFormat(service: string, credentialJson: string): string[] {
  const errors: string[] = [];
  try {
    const data = JSON.parse(credentialJson);
    switch (service) {
      case 'google_sheets': {
        if (!data.type || data.type !== 'service_account') errors.push('Google credential must be a service account');
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
        const isServiceAccount = data.type === 'service_account';
        if (isServiceAccount) {
          if (!data.private_key) errors.push('Missing private_key');
          if (!data.client_email) errors.push('Missing client_email');
          if (!data.project_id) errors.push('Missing project_id');
        } else {
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
  } catch {
    errors.push('Invalid JSON format');
  }
  return errors;
}

@Route('api/credentials')
@Tags('Credentials')
@Security('jwt')
export class CredentialController extends Controller {
  /**
   * Save a new credential
   */
  @Post('save')
  @SuccessResponse('201', 'Created')
  @Response<ErrorResponse>(400, 'Invalid request')
  @Response<ErrorResponse>(409, 'Duplicate credential')
  public async saveCredential(
    @Body() body: SaveCredentialRequest,
    @Request() request: express.Request
  ): Promise<{ success: boolean; data: SaveCredentialResponse }> {
    const user = request.user as AuthenticatedUser;
    const { credentialJson, credentialName, service } = body;

    // Validate request body
    if (!credentialJson || !credentialName || !service) {
      this.setStatus(400);
      throw new Error('Missing required fields: credentialJson, credentialName, service');
    }

    if (!['google_sheets', 'meta', 'ga4', 'shopify'].includes(service)) {
      this.setStatus(400);
      throw new Error(`Invalid service: ${service}`);
    }

    // Validate credential format
    const validationErrors = validateCredentialFormat(service, credentialJson);
    if (validationErrors.length > 0) {
      this.setStatus(400);
      throw new Error(`Invalid credential format: ${validationErrors.join(', ')}`);
    }

    // Check for duplicate credential
    const existingCredentials = await executeQuery(
      `SELECT id, encrypted_data FROM credentials WHERE user_id = $1 AND service = $2 AND deleted_at IS NULL;`,
      [user.userId, service],
      user.userId
    );

    for (const existing of existingCredentials.rows) {
      try {
        const decryptedExisting = decryptCredential(existing.encrypted_data, String(user.userId));
        if (decryptedExisting === credentialJson) {
          this.setStatus(409);
          throw new Error('This credential already exists');
        }
      } catch (error) {
        if ((error as Error).message === 'This credential already exists') throw error;
        logger.warn('Failed to decrypt existing credential for duplicate check', { credentialId: existing.id });
      }
    }

    // Encrypt and save
    const encryptedData = encryptCredential(credentialJson, String(user.userId));

    const result = await executeTransaction(async (client) => {
      const insertResult = await client.query(
        `INSERT INTO credentials (user_id, service, name, encrypted_data)
         VALUES ($1, $2, $3, $4)
         RETURNING id, service, name, verified, created_at;`,
        [user.userId, service, credentialName, encryptedData]
      );
      const credential = insertResult.rows[0];

      await client.query(
        `INSERT INTO service_configs (user_id, service, credential_id, enabled)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (user_id, service) DO UPDATE
         SET credential_id = $3, enabled = true, updated_at = CURRENT_TIMESTAMP;`,
        [user.userId, service, credential.id]
      );

      return credential;
    }, user.userId);

    await logAudit(user.userId, 'credential_saved', service, 'success', undefined, {
      credentialId: result.id,
      name: credentialName,
    });

    this.setStatus(201);
    return {
      success: true,
      data: {
        credentialId: String(result.id),
        service: result.service,
        name: result.name,
        type: 'service_account',
        verified: result.verified,
        created_at: result.created_at,
      },
    };
  }

  /**
   * List all credentials for the authenticated user
   */
  @Get('list')
  @Response<ErrorResponse>(500, 'Internal error')
  public async listCredentials(
    @Request() request: express.Request
  ): Promise<{ success: boolean; data: CredentialListItem[] }> {
    const user = request.user as AuthenticatedUser;

    const result = await executeQuery(
      `SELECT id, service, name, verified, verified_at, created_at, updated_at
       FROM credentials
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC;`,
      [user.userId],
      user.userId
    );

    const credentials = result.rows.map((cred) => ({
      id: String(cred.id),
      service: cred.service,
      name: cred.name,
      type: 'service_account',
      verified: cred.verified,
      verified_at: cred.verified_at,
      created_at: cred.created_at,
      updated_at: cred.updated_at || cred.created_at,
    }));

    return { success: true, data: credentials };
  }

  /**
   * Get a specific credential by ID
   */
  @Get('{credentialId}')
  @Response<ErrorResponse>(404, 'Credential not found')
  public async getCredential(
    @Path() credentialId: string,
    @Request() request: express.Request
  ): Promise<{ success: boolean; data: GetCredentialResponse }> {
    const user = request.user as AuthenticatedUser;

    const result = await executeQuery(
      `SELECT id, service, name, verified, verified_at, expires_at, created_at, updated_at
       FROM credentials
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
      [credentialId, user.userId],
      user.userId
    );

    if (result.rows.length === 0) {
      this.setStatus(404);
      throw new Error('Credential not found');
    }

    const cred = result.rows[0];
    return {
      success: true,
      data: {
        id: String(cred.id),
        service: cred.service,
        name: cred.name,
        type: 'service_account',
        verified: cred.verified,
        verified_at: cred.verified_at,
        created_at: cred.created_at,
        updated_at: cred.updated_at || cred.created_at,
        expires_at: cred.expires_at,
        encrypted: false,
      },
    };
  }

  /**
   * Update a credential
   */
  @Put('{credentialId}')
  @Response<ErrorResponse>(400, 'Invalid request')
  @Response<ErrorResponse>(404, 'Credential not found')
  public async updateCredential(
    @Path() credentialId: string,
    @Body() body: UpdateCredentialRequest,
    @Request() request: express.Request
  ): Promise<{ success: boolean; data: UpdateCredentialResponse }> {
    const user = request.user as AuthenticatedUser;
    const { credentialJson, credentialName } = body;

    const checkResult = await executeQuery(
      `SELECT service FROM credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
      [credentialId, user.userId],
      user.userId
    );

    if (checkResult.rows.length === 0) {
      this.setStatus(404);
      throw new Error('Credential not found');
    }

    const service = checkResult.rows[0].service;

    if (credentialJson) {
      const validationErrors = validateCredentialFormat(service, credentialJson);
      if (validationErrors.length > 0) {
        this.setStatus(400);
        throw new Error(`Invalid credential format: ${validationErrors.join(', ')}`);
      }
    }

    const encryptedData = credentialJson ? encryptCredential(credentialJson, String(user.userId)) : undefined;

    const updateResult = await executeQuery(
      `UPDATE credentials
       SET ${credentialJson ? 'encrypted_data = $1, ' : ''}
           ${credentialName ? `name = $${credentialJson ? 2 : 1}, ` : ''}
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $${credentialJson && credentialName ? 3 : credentialJson ? 2 : 1}
       RETURNING id, service, name, verified, updated_at;`,
      credentialJson && credentialName
        ? [encryptedData, credentialName, credentialId]
        : credentialJson
          ? [encryptedData, credentialId]
          : [credentialName, credentialId],
      user.userId
    );

    if (updateResult.rows.length === 0) {
      this.setStatus(500);
      throw new Error('Failed to update credential');
    }

    const cred = updateResult.rows[0];

    await logAudit(user.userId, 'credential_updated', service, 'success', undefined, {
      credentialId: cred.id,
      name: cred.name,
    });

    return {
      success: true,
      data: {
        id: String(cred.id),
        service: cred.service,
        name: cred.name,
        type: 'service_account',
        verified: cred.verified,
        updated_at: cred.updated_at,
      },
    };
  }

  /**
   * Delete a credential
   */
  @Delete('{credentialId}')
  @Response<ErrorResponse>(404, 'Credential not found')
  public async deleteCredential(
    @Path() credentialId: string,
    @Request() request: express.Request
  ): Promise<DeleteCredentialResponse> {
    const user = request.user as AuthenticatedUser;

    const result = await executeTransaction(async (client) => {
      const checkResult = await client.query(
        `SELECT service FROM credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
        [credentialId, user.userId]
      );

      if (checkResult.rows.length === 0) {
        throw new Error('Credential not found');
      }

      const service = checkResult.rows[0].service;

      await client.query(
        `UPDATE credentials SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2;`,
        [credentialId, user.userId]
      );

      await client.query(`DELETE FROM service_configs WHERE credential_id = $1;`, [credentialId]);

      return service;
    }, user.userId);

    await logAudit(user.userId, 'credential_deleted', result, 'success', undefined, { credentialId });

    return { success: true, message: 'Credential deleted successfully' };
  }

  /**
   * Verify a credential
   */
  @Post('{credentialId}/verify')
  @Response<ErrorResponse>(400, 'Verification failed')
  @Response<ErrorResponse>(404, 'Credential not found')
  public async verifyCredential(
    @Path() credentialId: string,
    @Request() request: express.Request
  ): Promise<{ success: boolean; data: VerifyCredentialResponse }> {
    const user = request.user as AuthenticatedUser;

    const result = await executeQuery(
      `SELECT id, service, name, encrypted_data
       FROM credentials
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
      [credentialId, user.userId],
      user.userId
    );

    if (result.rows.length === 0) {
      this.setStatus(404);
      throw new Error('Credential not found');
    }

    const credential = result.rows[0];

    try {
      const decryptedJson = decryptCredential(credential.encrypted_data, String(user.userId));
      const credentialData = JSON.parse(decryptedJson);

      let verified = false;
      let connectedAs = '';
      let expiresAt: string | undefined;

      switch (credential.service) {
        case 'google_sheets': {
          try {
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

            await auth.authorize();
            verified = true;
            connectedAs = credentialData.client_email || 'Service Account';
          } catch {
            verified = false;
            connectedAs = 'Service Account';
          }
          break;
        }
        case 'meta': {
          try {
            const accessToken = credentialData.access_token;
            const accountId = credentialData.account_id;
            const accountResponse = await fetch(
              `https://graph.facebook.com/v18.0/act_${encodeURIComponent(accountId)}?access_token=${encodeURIComponent(accessToken)}&fields=account_id,name,account_status`
            );
            const accountData = await accountResponse.json();
            if (accountResponse.ok) {
              verified = true;
              connectedAs = accountData?.name || accountData?.account_id || 'Meta Account';
            }
          } catch {
            verified = false;
            connectedAs = 'Meta Account';
          }
          break;
        }
        case 'ga4': {
          if (credentialData.type === 'service_account') {
            try {
              const { google } = await import('googleapis');
              const { JWT } = await import('google-auth-library');

              const auth = new JWT({
                email: credentialData.client_email,
                key: credentialData.private_key,
                scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
              });

              await auth.authorize();
              verified = true;
              connectedAs = credentialData.client_email || 'GA4 Service Account';
            } catch {
              verified = false;
              connectedAs = 'GA4 Service Account';
            }
          } else {
            verified = !!(credentialData.refresh_token && credentialData.client_id && credentialData.client_secret);
            connectedAs = credentialData.property_id || 'GA4 Property';
          }
          break;
        }
        case 'shopify': {
          try {
            const response = await fetch(
              `https://${credentialData.shop_url}/admin/api/2025-10/graphql.json`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Shopify-Access-Token': credentialData.access_token,
                },
                body: JSON.stringify({ query: 'query { shop { id name } }' }),
              }
            );
            const data = await response.json();
            if (response.ok && data.data?.shop) {
              verified = true;
              connectedAs = data.data.shop.name || credentialData.shop_url;
            }
          } catch {
            verified = false;
            connectedAs = 'Shopify Store';
          }
          break;
        }
      }

      if (verified) {
        await executeQuery(
          `UPDATE credentials SET verified = true, verified_at = CURRENT_TIMESTAMP WHERE id = $1;`,
          [credentialId],
          user.userId
        );

        await logAudit(user.userId, 'credential_verified', credential.service, 'success', undefined, { credentialId });

        return {
          success: true,
          data: { verified: true, message: `Connected as ${connectedAs}`, connectedAs, expiresAt },
        };
      } else {
        throw new Error('Credential verification failed - invalid format');
      }
    } catch (error) {
      await executeQuery(
        `UPDATE credentials SET verified = false, verified_at = NULL WHERE id = $1;`,
        [credentialId],
        user.userId
      );

      await logAudit(user.userId, 'verification_failed', credential.service, 'failure', (error as Error).message, { credentialId });

      this.setStatus(400);
      throw new Error(`Credential verification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get verification status of a credential
   */
  @Get('{credentialId}/verify-status')
  @Response<ErrorResponse>(404, 'Credential not found')
  public async getVerifyStatus(
    @Path() credentialId: string,
    @Request() request: express.Request
  ): Promise<{ success: boolean; data: VerifyStatusResponse }> {
    const user = request.user as AuthenticatedUser;

    const result = await executeQuery(
      `SELECT id, verified, verified_at, expires_at
       FROM credentials
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
      [credentialId, user.userId],
      user.userId
    );

    if (result.rows.length === 0) {
      this.setStatus(404);
      throw new Error('Credential not found');
    }

    const cred = result.rows[0];
    return {
      success: true,
      data: {
        credentialId: String(cred.id),
        verified: cred.verified,
        verified_at: cred.verified_at,
        expires_at: cred.expires_at,
        last_verified_at: cred.verified_at,
      },
    };
  }
}
