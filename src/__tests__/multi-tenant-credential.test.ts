/**
 * Credential Multi-Tenant Test
 * 
 * This test verifies that different users can save the same credential
 * while the same user cannot save duplicate credentials.
 */

import { Router, Request, Response } from 'express';
import { executeQuery, executeTransaction } from '../lib/database.js';
import { encryptCredential, decryptCredential } from '../lib/encryption.js';
import { logAudit } from '../lib/audit-log.js';
import { logger } from '../lib/logger.js';
import { areCredentialsEqual } from '../lib/credential-utils.js';

// Mock request and response for testing
interface MockRequest extends Request {
  user?: {
    userId: number;
    clerkId: string;
    email: string;
    status: string;
  };
  body: any;
}

// Test function to verify multi-tenant credential functionality
export async function testMultiTenantCredentials(): Promise<void> {
  console.log('🧪 Starting multi-tenant credential tests...\n');

  try {
    // Test 1: Verify different users can save the same credential
    await testDifferentUsersSameCredential();
    
    // Test 2: Verify same user cannot save duplicate credentials
    await testSameUserDuplicateCredentials();
    
    console.log('✅ All multi-tenant credential tests passed!\n');
  } catch (error) {
    console.error('❌ Multi-tenant credential tests failed:', error);
    throw error;
  }
}

async function testDifferentUsersSameCredential(): Promise<void> {
  console.log('📝 Test 1: Different users saving same credential');
  
  // Create a sample credential
  const sampleCredential = JSON.stringify({
    access_token: 'test_token_123',
    account_id: 'test_account_456',
    _custom_field: 'test_value'
  });
  
  const serviceName = 'meta';
  const credentialName = 'Test Meta Account';
  
  // Simulate first user saving the credential
  const mockRequest1: MockRequest = {
    user: { userId: 1 },
    body: {
      credentialJson: sampleCredential,
      credentialName,
      service: serviceName
    }
  } as MockRequest;
  
  // Simulate second user saving the same credential
  const mockRequest2: MockRequest = {
    user: { userId: 2 },
    body: {
      credentialJson: sampleCredential,
      credentialName,
      service: serviceName
    }
  } as MockRequest;
  
  // Save credential for first user
  const result1 = await saveCredentialForTest(mockRequest1);
  console.log(`   ✓ User 1 credential saved with ID: ${result1.credentialId}`);
  
  // Save credential for second user (should succeed)
  const result2 = await saveCredentialForTest(mockRequest2);
  console.log(`   ✓ User 2 credential saved with ID: ${result2.credentialId}`);
  
  // Verify both credentials exist and are different encrypted values
  const credential1 = await getCredentialForTest(1, result1.credentialId);
  const credential2 = await getCredentialForTest(2, result2.credentialId);
  
  // The encrypted values should be different due to user-specific encryption keys
  if (credential1.encrypted_data === credential2.encrypted_data) {
    throw new Error('Expected different encrypted values for different users');
  }
  
  // But when decrypted, they should be the same
  const decrypted1 = decryptCredential(credential1.encrypted_data, '1');
  const decrypted2 = decryptCredential(credential2.encrypted_data, '2');
  
  if (!areCredentialsEqual(decrypted1, decrypted2)) {
    throw new Error('Expected same credential content after decryption');
  }
  
  console.log('   ✅ Different users can save the same credential\n');
}

async function testSameUserDuplicateCredentials(): Promise<void> {
  console.log('📝 Test 2: Same user saving duplicate credentials');
  
  // Create a sample credential
  const sampleCredential = JSON.stringify({
    access_token: 'test_token_789',
    account_id: 'test_account_012',
    _custom_field: 'test_value'
  });
  
  const serviceName = 'ga4';
  const credentialName = 'Test GA4 Account';
  
  // Simulate user saving the credential first time
  const mockRequest1: MockRequest = {
    user: { userId: 3 },
    body: {
      credentialJson: sampleCredential,
      credentialName,
      service: serviceName
    }
  } as MockRequest;
  
  // Save credential for user
  const result1 = await saveCredentialForTest(mockRequest1);
  console.log(`   ✓ User 3 credential saved with ID: ${result1.credentialId}`);
  
  // Try to save the same credential again (should fail with 409)
  const mockRequest2: MockRequest = {
    user: { userId: 3 },
    body: {
      credentialJson: sampleCredential,
      credentialName: 'Another Name',
      service: serviceName
    }
  } as MockRequest;
  
  let duplicateError: Error | null = null;
  try {
    await saveCredentialForTest(mockRequest2);
  } catch (error) {
    duplicateError = error as Error;
  }
  
  if (!duplicateError || !duplicateError.message.includes('409')) {
    throw new Error('Expected 409 conflict error when saving duplicate credential for same user');
  }
  
  console.log('   ✅ Same user cannot save duplicate credentials\n');
}

// Helper function to simulate credential saving for testing
async function saveCredentialForTest(req: MockRequest): Promise<{ credentialId: string; success: boolean }> {
  const { credentialJson, credentialName, service } = req.body;

  // Validate request body
  if (!credentialJson || !credentialName || !service) {
    throw new Error('400: Missing required fields');
  }

  if (!['google_sheets', 'meta', 'ga4', 'shopify'].includes(service)) {
    throw new Error(`400: Invalid service: ${service}`);
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

  // Compare the new credential with existing ones to check for duplicates
  for (const existing of existingCredentials.rows) {
    try {
      const decryptedExisting = decryptCredential(existing.encrypted_data, String(req.user!.userId));
      
      // Use the utility function to check if credentials are equal
      if (areCredentialsEqual(credentialJson, decryptedExisting)) {
        throw new Error('409: This credential already exists');
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

  return {
    credentialId: String(result.id),
    success: true
  };
}

// Helper function to get a credential for testing
async function getCredentialForTest(userId: number, credentialId: string) {
  const result = await executeQuery(
    `
    SELECT id, service, name, encrypted_data, user_id
    FROM credentials
    WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
    `,
    [credentialId, userId],
    userId
  );

  if (result.rows.length === 0) {
    throw new Error(`Credential with ID ${credentialId} not found for user ${userId}`);
  }

  return result.rows[0];
}

// Run the tests if this file is executed directly
if (require.main === module) {
  testMultiTenantCredentials()
    .then(() => console.log('🎉 All tests completed successfully!'))
    .catch(error => {
      console.error('💥 Tests failed:', error);
      process.exit(1);
    });
}