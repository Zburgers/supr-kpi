/**
 * Credential Repository
 * 
 * Data access layer for credential operations.
 * Handles encryption/decryption integration with database.
 * 
 * CRITICAL: All operations must:
 * - Verify user ownership
 * - Encrypt before storage
 * - Decrypt only in memory
 * - Audit all access
 * - Never log credentials
 */

import {
  CredentialData,
  CredentialResponse,
  EncryptedCredentialRecord,
  ServiceType,
  UserContext,
} from '../types/credential-system';
import { getEncryptionService } from './encryption.service.js';
import { Logger } from '../lib/logger.js';
import { AuditService } from './audit.service.js';
import { DatabasePool } from '../lib/database.js';

/**
 * Credential Repository
 * 
 * Combines database operations with encryption/decryption
 */
export class CredentialRepository {
  private logger: Logger;
  private db: DatabasePool;
  private auditService: AuditService;

  constructor(db: DatabasePool, auditService: AuditService) {
    this.logger = new Logger('CredentialRepository');
    this.db = db;
    this.auditService = auditService;
  }

  /**
   * Create a new credential
   * 
   * Process:
   * 1. Validate user ownership
   * 2. Encrypt credential data
   * 3. Store encrypted data, IV, auth tag
   * 4. Audit log the creation
   * 5. Return credential ID
   * 
   * @param user - User context
   * @param serviceType - Service type
   * @param credentialName - User-friendly name
   * @param credentialData - The credential (will be encrypted)
   * @param expiresAt - Optional expiration date
   * @returns Created credential with ID
   * 
   * @throws Error if credential already exists or encryption fails
   */
  async createCredential(
    user: UserContext,
    serviceType: ServiceType,
    credentialName: string,
    credentialData: CredentialData,
    expiresAt?: Date
  ): Promise<CredentialResponse> {
    // Validate user status
    if (user.status !== 'active') {
      this.logger.warn('Credential creation denied: user not active', {
        userId: user.userId,
        status: user.status,
      });
      throw new Error('User account is not active');
    }

    const encryptionService = getEncryptionService();

    try {
      // Encrypt the credential
      const encrypted = await encryptionService.encryptCredential(
        credentialData,
        user.userId,
        serviceType,
        credentialName
      );

      // Insert into database
      const query = `
        INSERT INTO api_credentials (
          user_id,
          service_type,
          credential_name,
          encrypted_data,
          iv,
          auth_tag,
          key_version,
          expires_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        RETURNING
          id,
          user_id,
          service_type,
          credential_name,
          version,
          is_active,
          verification_status,
          expires_at,
          created_at,
          updated_at
      `;

      const result = await this.db.query(query, [
        user.userId,
        serviceType,
        credentialName,
        encrypted.encryptedData,
        encrypted.iv,
        encrypted.authTag,
        encrypted.keyVersion,
        expiresAt || null,
      ]);

      if (result.rows.length === 0) {
        throw new Error('Failed to create credential');
      }

      const credential = result.rows[0];

      // Audit log
      await this.auditService.logCredentialAction(
        user.userId,
        credential.id,
        'created',
        'success'
      );

      this.logger.info('Credential created', {
        userId: user.userId,
        serviceType,
        credentialId: credential.id,
      });

      return this.formatCredentialResponse(credential);
    } catch (error) {
      // Check if it's a duplicate credential error
      if (
        error instanceof Error &&
        error.message.includes('unique_credential_per_user_service_name')
      ) {
        await this.auditService.logCredentialAction(
          user.userId,
          undefined,
          'created',
          'failed',
          'duplicate_credential'
        );
        throw new Error(
          'Credential with this name already exists for this service'
        );
      }

      this.logger.error('Credential creation failed', {
        userId: user.userId,
        serviceType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get a credential by ID (with decryption)
   * 
   * WARNING: This decrypts the credential into memory
   * Only call when actually needed to use the credential
   * Immediately clear the decrypted value after use
   * 
   * @param user - User context
   * @param credentialId - Credential ID
   * @returns Decrypted credential data
   * 
   * @throws Error if credential not found or user lacks access
   */
  async getCredential(
    user: UserContext,
    credentialId: number
  ): Promise<CredentialData> {
    // Validate user status
    if (user.status !== 'active') {
      this.logger.warn('Credential access denied: user not active', {
        userId: user.userId,
      });
      throw new Error('User account is not active');
    }

    try {
      // Fetch encrypted credential
      const query = `
        SELECT
          id,
          user_id,
          service_type,
          credential_name,
          encrypted_data,
          iv,
          auth_tag,
          key_version,
          is_active,
          expires_at
        FROM api_credentials
        WHERE id = $1 AND user_id = $2 AND is_active = true
      `;

      const result = await this.db.query(query, [credentialId, user.userId]);

      if (result.rows.length === 0) {
        // Don't reveal whether credential exists or user lacks access
        await this.auditService.logCredentialAction(
          user.userId,
          credentialId,
          'retrieved',
          'failed',
          'not_found_or_denied'
        );
        throw new Error('Credential not found or access denied');
      }

      const encrypted = result.rows[0];

      // Check expiration
      if (encrypted.expires_at && new Date() > new Date(encrypted.expires_at)) {
        await this.auditService.logCredentialAction(
          user.userId,
          credentialId,
          'retrieved',
          'failed',
          'expired'
        );
        throw new Error('Credential has expired');
      }

      // Decrypt
      const encryptionService = getEncryptionService();
      const decrypted = await encryptionService.decryptCredential(
        encrypted.encrypted_data,
        encrypted.iv,
        encrypted.auth_tag,
        encrypted.key_version,
        user.userId,
        encrypted.service_type,
        encrypted.credential_name
      );

      // Audit log
      await this.auditService.logCredentialAction(
        user.userId,
        credentialId,
        'retrieved',
        'success'
      );

      return decrypted;
    } catch (error) {
      if (error instanceof Error && error.message.includes('access denied')) {
        // Already handled
        throw error;
      }

      this.logger.error('Credential retrieval failed', {
        userId: user.userId,
        credentialId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get credential metadata (without decryption)
   * 
   * Returns all information except the encrypted credential data
   * Safe to call frequently
   * 
   * @param user - User context
   * @param credentialId - Credential ID
   * @returns Credential metadata
   */
  async getCredentialMetadata(
    user: UserContext,
    credentialId: number
  ): Promise<CredentialResponse> {
    const query = `
      SELECT
        id,
        user_id,
        service_type,
        credential_name,
        version,
        is_active,
        verification_status,
        last_verified_at,
        expires_at,
        created_at,
        updated_at
      FROM api_credentials
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [credentialId, user.userId]);

    if (result.rows.length === 0) {
      throw new Error('Credential not found');
    }

    return this.formatCredentialResponse(result.rows[0]);
  }

  /**
   * Update a credential
   * 
   * Re-encrypts if credential data is provided
   * 
   * @param user - User context
   * @param credentialId - Credential ID
   * @param updates - Fields to update
   * @returns Updated credential
   */
  async updateCredential(
    user: UserContext,
    credentialId: number,
    updates: {
      credentialName?: string;
      credentialData?: CredentialData;
      expiresAt?: Date | null;
    }
  ): Promise<CredentialResponse> {
    const encryptionService = getEncryptionService();

    try {
      // Get current credential metadata
      const currentMetadata = await this.getCredentialMetadata(user, credentialId);

      let encryptedData = null;
      let iv = null;
      let authTag = null;
      let keyVersion = null;
      let newVersion = currentMetadata.version;

      // If credential data is being updated, re-encrypt
      if (updates.credentialData) {
        const encrypted = await encryptionService.encryptCredential(
          updates.credentialData,
          user.userId,
          currentMetadata.service_type as ServiceType,
          updates.credentialName || currentMetadata.credential_name
        );

        encryptedData = encrypted.encryptedData;
        iv = encrypted.iv;
        authTag = encrypted.authTag;
        keyVersion = encrypted.keyVersion;
        newVersion = currentMetadata.version + 1;
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [credentialId, user.userId];
      let paramCount = 2;

      if (updates.credentialName) {
        updateFields.push(`credential_name = $${++paramCount}`);
        values.push(updates.credentialName);
      }

      if (encryptedData) {
        updateFields.push(`encrypted_data = $${++paramCount}`);
        updateFields.push(`iv = $${++paramCount}`);
        updateFields.push(`auth_tag = $${++paramCount}`);
        updateFields.push(`key_version = $${++paramCount}`);
        updateFields.push(`version = $${++paramCount}`);
        values.push(encryptedData, iv, authTag, keyVersion, newVersion);
      }

      if (updates.expiresAt !== undefined) {
        updateFields.push(`expires_at = $${++paramCount}`);
        values.push(updates.expiresAt || null);
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      const query = `
        UPDATE api_credentials
        SET ${updateFields.join(', ')}
        WHERE id = $1 AND user_id = $2
        RETURNING
          id,
          user_id,
          service_type,
          credential_name,
          version,
          is_active,
          verification_status,
          last_verified_at,
          expires_at,
          created_at,
          updated_at
      `;

      const result = await this.db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Credential not found');
      }

      // Audit log
      await this.auditService.logCredentialAction(
        user.userId,
        credentialId,
        'updated',
        'success'
      );

      return this.formatCredentialResponse(result.rows[0]);
    } catch (error) {
      this.logger.error('Credential update failed', {
        userId: user.userId,
        credentialId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete a credential (soft delete)
   * 
   * Sets is_active = false and disables auto-sync
   * Audit log preserved forever
   * 
   * @param user - User context
   * @param credentialId - Credential ID
   */
  async deleteCredential(
    user: UserContext,
    credentialId: number
  ): Promise<void> {
    const query = `
      UPDATE api_credentials
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [credentialId, user.userId]);

    if (result.rowCount === 0) {
      throw new Error('Credential not found');
    }

    // Audit log
    await this.auditService.logCredentialAction(
      user.userId,
      credentialId,
      'deleted',
      'success'
    );

    this.logger.info('Credential deleted', {
      userId: user.userId,
      credentialId,
    });
  }

  /**
   * List credentials for a user
   * 
   * @param user - User context
   * @param serviceType - Optional filter by service type
   * @param page - Page number (1-indexed)
   * @param limit - Results per page
   * @returns List of credential metadata
   */
  async listCredentials(
    user: UserContext,
    serviceType?: ServiceType,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    credentials: CredentialResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    let query =
      'SELECT COUNT(*) as total FROM api_credentials WHERE user_id = $1 AND is_active = true';
    const countParams: (number | string)[] = [user.userId];

    if (serviceType) {
      query += ' AND service_type = $2';
      countParams.push(serviceType);
    }

    const countResult = await this.db.query(query, countParams);
    const total = parseInt(countResult.rows[0].total);

    const offset = (page - 1) * limit;

    query = `
      SELECT
        id,
        user_id,
        service_type,
        credential_name,
        version,
        is_active,
        verification_status,
        last_verified_at,
        expires_at,
        created_at,
        updated_at
      FROM api_credentials
      WHERE user_id = $1 AND is_active = true
    `;

    const params: (number | string)[] = [user.userId];
    let paramCount = 1;

    if (serviceType) {
      query += ` AND service_type = $${++paramCount}`;
      params.push(serviceType);
    }

    query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return {
      credentials: result.rows.map((row: Record<string, unknown>) => this.formatCredentialResponse(row)),
      total,
      page,
      limit,
    };
  }

  /**
   * Update verification status
   * 
   * @param credentialId - Credential ID
   * @param status - New status
   * @param userId - User ID for verification
   */
  async updateVerificationStatus(
    credentialId: number,
    status: 'pending' | 'valid' | 'invalid',
    userId: number
  ): Promise<void> {
    const query = `
      UPDATE api_credentials
      SET
        verification_status = $1,
        last_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
    `;

    await this.db.query(query, [status, credentialId, userId]);
  }

  /**
   * Format credential row for API response
   * Removes sensitive fields
   */
  private formatCredentialResponse(row: any): CredentialResponse {
    return {
      id: row.id.toString(),
      user_id: row.user_id,
      service_type: row.service_type,
      credential_name: row.credential_name,
      version: row.version,
      is_active: row.is_active,
      verification_status: row.verification_status,
      last_verified_at: row.last_verified_at
        ? row.last_verified_at.toISOString()
        : undefined,
      expires_at: row.expires_at ? row.expires_at.toISOString() : undefined,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
