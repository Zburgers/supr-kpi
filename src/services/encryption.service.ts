/**
 * Encryption Service Implementation
 * 
 * Handles AES-256-GCM encryption and decryption of credentials.
 * This is the critical security component that protects stored credentials.
 * 
 * NEVER MODIFY WITHOUT SECURITY REVIEW
 */

import crypto from 'crypto';
import { Logger } from '../lib/logger';
import {
  CredentialData,
  DecryptionResult,
  EncryptionResult,
  MasterKey,
  ServiceType,
} from '../types/credential-system';

/**
 * Encryption Service
 * 
 * Responsibilities:
 * - Encrypting credentials with AES-256-GCM
 * - Decrypting stored credentials
 * - Key rotation support
 * - Secure random IV generation
 * - Auth tag verification
 */
export class EncryptionService {
  private logger: Logger;
  private masterKeys: Map<number, MasterKey> = new Map();
  private activeMasterKeyVersion: number = 1;

  constructor() {
    this.logger = new Logger('EncryptionService');
  }

  /**
   * Initialize the encryption service with master keys from Vault
   * 
   * CRITICAL: Master keys must come from AWS Secrets Manager or HashiCorp Vault
   * NEVER load from environment variables or database
   * 
   * @param keyVersion - The active key version
   * @param keyMaterial - The 32-byte AES-256 key material
   */
  async initializeMasterKey(
    keyVersion: number,
    keyMaterial: Buffer
  ): Promise<void> {
    if (keyMaterial.length !== 32) {
      const error = new Error('Master key must be exactly 32 bytes');
      this.logger.error('Invalid master key size', { error });
      throw error;
    }

    this.masterKeys.set(keyVersion, {
      version: keyVersion,
      key: keyMaterial,
      algorithm: 'aes-256-gcm',
      isActive: true,
    });

    this.activeMasterKeyVersion = keyVersion;
    this.logger.info('Master key initialized', { keyVersion });
  }

  /**
   * Add a retired key for decryption of old credentials during rotation
   * 
   * @param keyVersion - The retired key version
   * @param keyMaterial - The 32-byte key material
   */
  async addRetiredKey(
    keyVersion: number,
    keyMaterial: Buffer
  ): Promise<void> {
    if (keyMaterial.length !== 32) {
      throw new Error('Master key must be exactly 32 bytes');
    }

    this.masterKeys.set(keyVersion, {
      version: keyVersion,
      key: keyMaterial,
      algorithm: 'aes-256-gcm',
      isActive: false,
    });

    this.logger.info('Retired key loaded', { keyVersion });
  }

  /**
   * Encrypt a credential with AES-256-GCM
   * 
   * Process:
   * 1. Generate random 16-byte IV
   * 2. Create AAD (Additional Authenticated Data) for integrity
   * 3. Encrypt credential JSON with active master key
   * 4. Extract authentication tag (GCM provides this automatically)
   * 5. Return encrypted data, IV, auth tag, and key version
   * 
   * @param credential - The credential data to encrypt
   * @param userId - User ID for AAD
   * @param serviceType - Service type for AAD
   * @param credentialName - Credential name for AAD
   * @returns Encryption result with encrypted data, IV, auth tag
   * 
   * @throws Error if master key not initialized or encryption fails
   */
  async encryptCredential(
    credential: CredentialData,
    userId: number,
    serviceType: ServiceType,
    credentialName: string
  ): Promise<EncryptionResult> {
    const masterKey = this.masterKeys.get(this.activeMasterKeyVersion);
    if (!masterKey) {
      const error = new Error('Master key not initialized');
      this.logger.error('Encryption failed: no active key', { error });
      throw error;
    }

    try {
      // Generate random IV (16 bytes for GCM)
      const iv = crypto.randomBytes(16);

      // Create AAD (Additional Authenticated Data)
      // This ensures encrypted data cannot be moved between users/services
      const aad = Buffer.from(
        `${userId}:${serviceType}:${credentialName}`,
        'utf8'
      );

      // Create cipher
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        masterKey.key,
        iv
      );

      // Encrypt credential JSON
      const credentialJson = JSON.stringify(credential);
      let encrypted = cipher.update(credentialJson, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      this.logger.info('Credential encrypted successfully', {
        userId,
        serviceType,
        keyVersion: masterKey.version,
      });

      return {
        encryptedData: encrypted,
        iv,
        authTag,
        keyVersion: masterKey.version,
      };
    } catch (error) {
      this.logger.error('Encryption failed', {
        userId,
        serviceType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Decrypt a credential with AES-256-GCM
   * 
   * Process:
   * 1. Load master key for the specified version
   * 2. Recreate AAD from metadata
   * 3. Create decipher with IV and auth tag
   * 4. Decrypt data
   * 5. Verify auth tag (automatic in GCM)
   * 6. Parse and return credential JSON
   * 
   * @param encryptedData - The ciphertext
   * @param iv - The initialization vector used for encryption
   * @param authTag - The GCM authentication tag
   * @param keyVersion - Which master key was used
   * @param userId - User ID for AAD verification
   * @param serviceType - Service type for AAD verification
   * @param credentialName - Credential name for AAD verification
   * @returns Decrypted credential data
   * 
   * @throws Error if decryption or auth tag verification fails
   */
  async decryptCredential(
    encryptedData: Buffer,
    iv: Buffer,
    authTag: Buffer,
    keyVersion: number,
    userId: number,
    serviceType: ServiceType,
    credentialName: string
  ): Promise<CredentialData> {
    const masterKey = this.masterKeys.get(keyVersion);
    if (!masterKey) {
      this.logger.error('Decryption failed: key version not available', {
        userId,
        keyVersion,
      });
      throw new Error('Decryption failed: credential access denied');
    }

    try {
      // Recreate AAD
      const aad = Buffer.from(
        `${userId}:${serviceType}:${credentialName}`,
        'utf8'
      );

      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey.key, iv);

      // Set the auth tag for verification
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      // Parse JSON
      const credentialJson = decrypted.toString('utf8');
      const credential = JSON.parse(credentialJson) as CredentialData;

      this.logger.info('Credential decrypted successfully', {
        userId,
        serviceType,
        keyVersion,
      });

      // Clear decrypted buffer from memory
      decrypted.fill(0);

      return credential;
    } catch (error) {
      // Log generic error (not "auth tag failed" which could leak information)
      this.logger.warn('Decryption failed', {
        userId,
        serviceType,
        keyVersion,
        error: error instanceof Error ? 'verification_failed' : 'unknown_error',
      });

      // Always throw same generic error to not leak information
      throw new Error('Decryption failed: credential access denied');
    }
  }

  /**
   * Rotate encryption keys
   * 
   * Process:
   * 1. Create new master key
   * 2. Mark new key as active
   * 3. Keep old key for decryption during transition
   * 4. Background job re-encrypts all credentials
   * 5. After transition period, retire old key
   * 
   * @param newKeyMaterial - The new 32-byte key material
   * @returns New key version
   */
  async rotateKey(newKeyMaterial: Buffer): Promise<number> {
    if (newKeyMaterial.length !== 32) {
      throw new Error('Master key must be exactly 32 bytes');
    }

    const newVersion = this.activeMasterKeyVersion + 1;

    this.masterKeys.set(newVersion, {
      version: newVersion,
      key: newKeyMaterial,
      algorithm: 'aes-256-gcm',
      isActive: true,
    });

    this.activeMasterKeyVersion = newVersion;

    this.logger.info('Key rotated', {
      oldVersion: newVersion - 1,
      newVersion: newVersion,
    });

    return newVersion;
  }

  /**
   * Get active master key version
   * Used to tag encrypted data with the key version
   */
  getActiveMasterKeyVersion(): number {
    return this.activeMasterKeyVersion;
  }

  /**
   * Check if a key version is available (for decryption)
   */
  hasKeyVersion(version: number): boolean {
    return this.masterKeys.has(version);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Get or create the encryption service singleton
 * 
 * Usage:
 * const service = getEncryptionService();
 * await service.initializeMasterKey(1, keyBuffer);
 * const encrypted = await service.encryptCredential(cred, userId, service, name);
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a secure random key for testing only
 * NEVER use in production - load from Vault instead
 */
export function generateTestMasterKey(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * Calculate SHA-256 hash of a key for identification
 * Used to verify key integrity without exposing the key itself
 */
export function hashKeyMaterial(keyMaterial: Buffer): string {
  return crypto.createHash('sha256').update(keyMaterial).digest('hex');
}

/**
 * Validate that a credential can be decrypted
 * Used for verification endpoints
 * 
 * @returns true if decryption succeeded, false otherwise
 */
export async function verifyCredentialDecryption(
  encryptedData: Buffer,
  iv: Buffer,
  authTag: Buffer,
  keyVersion: number,
  userId: number,
  serviceType: ServiceType,
  credentialName: string
): Promise<boolean> {
  try {
    const service = getEncryptionService();
    await service.decryptCredential(
      encryptedData,
      iv,
      authTag,
      keyVersion,
      userId,
      serviceType,
      credentialName
    );
    return true;
  } catch {
    return false;
  }
}
