/**
 * Credential Utilities
 * 
 * Helper functions for credential management including hashing and comparison
 */

import crypto from 'crypto';

/**
 * Generate a hash of credential data for efficient comparison
 * 
 * This function creates a hash of the credential data after normalizing it
 * to ignore formatting differences like whitespace and key ordering.
 * 
 * @param credentialData - The credential data as a JSON string
 * @returns SHA-256 hash of the normalized credential data
 */
export function hashCredentialData(credentialData: string): string {
  try {
    // Parse the credential JSON to normalize it
    const parsedCredential = JSON.parse(credentialData);
    
    // Stringify with sorted keys to ensure consistent ordering
    const normalizedCredential = JSON.stringify(parsedCredential, Object.keys(parsedCredential).sort());
    
    // Create SHA-256 hash
    return crypto.createHash('sha256').update(normalizedCredential).digest('hex');
  } catch (error) {
    throw new Error(`Failed to hash credential data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Compare two credential JSON strings for equality
 * 
 * This function compares two credential JSON strings by parsing them,
 * normalizing the objects, and comparing the normalized versions.
 * 
 * @param credential1 - First credential JSON string
 * @param credential2 - Second credential JSON string
 * @returns true if the credentials are equivalent, false otherwise
 */
export function areCredentialsEqual(credential1: string, credential2: string): boolean {
  try {
    // Parse both credentials
    const parsed1 = JSON.parse(credential1);
    const parsed2 = JSON.parse(credential2);
    
    // Stringify with sorted keys to normalize
    const normalized1 = JSON.stringify(parsed1, Object.keys(parsed1).sort());
    const normalized2 = JSON.stringify(parsed2, Object.keys(parsed2).sort());
    
    return normalized1 === normalized2;
  } catch (error) {
    // If parsing fails, the credentials are not equal
    return false;
  }
}

/**
 * Normalize credential data by parsing and re-stringifying with sorted keys
 * 
 * @param credentialData - The credential data as a JSON string
 * @returns Normalized credential data as a JSON string
 */
export function normalizeCredentialData(credentialData: string): string {
  try {
    const parsedCredential = JSON.parse(credentialData);
    return JSON.stringify(parsedCredential, Object.keys(parsedCredential).sort());
  } catch (error) {
    throw new Error(`Failed to normalize credential data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}