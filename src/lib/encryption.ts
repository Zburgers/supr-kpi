/**
 * Credential Encryption Service
 * Handles AES-256-GCM encryption/decryption of stored credentials
 * 
 * Usage:
 *   const encrypted = encryptCredential(credentialJson, userId);
 *   const decrypted = decryptCredential(encrypted, userId);
 */

import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 16;
const SALT = process.env.ENCRYPTION_KEY_SALT || 'default-salt-change-in-production';

/**
 * Derive encryption key from user ID and salt
 * DO NOT expose this key in logs
 */
function deriveKey(userId: string): Buffer {
  return crypto
    .pbkdf2Sync(userId, SALT, 100000, 32, 'sha256');
}

/**
 * Encrypt a credential object
 * Returns: { iv, authTag, encryptedData } all hex-encoded
 */
export function encryptCredential(
  credentialJson: string,
  userId: string
): string {
  try {
    const key = deriveKey(userId);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(credentialJson, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return as JSON-encoded blob: { iv, authTag, encryptedData }
    const blob = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encryptedData: encrypted,
      algorithm: ENCRYPTION_ALGORITHM,
    };
    
    return JSON.stringify(blob);
  } catch (error) {
    console.error('[EncryptionService] Encryption failed (no details logged)');
    throw new Error('Failed to encrypt credential');
  }
}

/**
 * Decrypt a credential object
 * Takes: the blob from encryptCredential()
 */
export function decryptCredential(
  encryptedBlob: string,
  userId: string
): string {
  try {
    const key = deriveKey(userId);
    const blob = JSON.parse(encryptedBlob);
    
    const iv = Buffer.from(blob.iv, 'hex');
    const authTag = Buffer.from(blob.authTag, 'hex');
    const encryptedData = blob.encryptedData;
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    
    return decrypted;
  } catch (error) {
    console.error('[EncryptionService] Decryption failed (invalid blob or key)');
    throw new Error('Failed to decrypt credential - invalid key or corrupted data');
  }
}

/**
 * Mask a credential for display
 * Shows only first and last 3 characters
 */
export function maskCredential(value: string): string {
  if (value.length <= 6) return '***';
  return value.substring(0, 3) + '...' + value.substring(value.length - 3);
}
