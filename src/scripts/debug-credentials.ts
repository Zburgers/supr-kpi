#!/usr/bin/env node

/**
 * Debug script to test credential retrieval and validation
 * This script helps diagnose issues with credential storage and retrieval
 */

import { executeQuery } from '../lib/database.js';
import { decryptCredential } from '../lib/encryption.js';
import { config } from '../config/index.js';

async function debugCredentials() {
  console.log('🔍 Debugging credential retrieval...\n');
  
  try {
    // Check if database is configured
    console.log('✅ Database configuration:');
    console.log(`   Redis URL: ${config.redisUrl}`);
    console.log(`   Port: ${config.port}\n`);
    
    // Check if credentials exist in the database
    console.log('📋 Fetching stored credentials...');
    const credentialsResult = await executeQuery(
      `SELECT id, user_id, service, name, verified, created_at FROM credentials 
       WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`
    );
    
    if (credentialsResult.rows.length === 0) {
      console.log('❌ No credentials found in database\n');
      return;
    }
    
    console.log(`✅ Found ${credentialsResult.rows.length} credentials:\n`);
    for (const cred of credentialsResult.rows) {
      console.log(`   ID: ${cred.id}`);
      console.log(`   User ID: ${cred.user_id}`);
      console.log(`   Service: ${cred.service}`);
      console.log(`   Name: ${cred.name}`);
      console.log(`   Verified: ${cred.verified}`);
      console.log(`   Created: ${cred.created_at}\n`);
    }
    
    // Try to get a specific credential and decrypt it (for testing purposes)
    const firstCred = credentialsResult.rows[0];
    console.log(`🔐 Attempting to decrypt credential ID: ${firstCred.id} for user: ${firstCred.user_id}\n`);
    
    const encryptedResult = await executeQuery(
      `SELECT encrypted_data, user_id FROM credentials WHERE id = $1`,
      [firstCred.id]
    );
    
    if (encryptedResult.rows.length > 0) {
      const encryptedData = encryptedResult.rows[0].encrypted_data;
      const userId = encryptedResult.rows[0].user_id;
      
      console.log(`   Encrypted data length: ${encryptedData.length} characters`);
      
      try {
        const decrypted = decryptCredential(encryptedData, String(userId));
        const credentialData = JSON.parse(decrypted);
        
        console.log('✅ Successfully decrypted credential!');
        console.log('   Credential data structure:');
        
        // Show available fields without exposing sensitive values
        for (const [key, value] of Object.entries(credentialData)) {
          if (typeof value === 'string' && 
              (key.toLowerCase().includes('token') || 
               key.toLowerCase().includes('key') || 
               key.toLowerCase().includes('secret'))) {
            console.log(`     ${key}: [HIDDEN - ${value.length} chars]`);
          } else {
            console.log(`     ${key}: ${JSON.stringify(value)}`);
          }
        }
        console.log('');
      } catch (decryptError: any) {
        console.error(`❌ Failed to decrypt credential:`, decryptError.message);
        console.log('');
      }
    }
    
    // Check service configurations
    console.log('⚙️  Checking service configurations...');
    const serviceConfigsResult = await executeQuery(
      `SELECT service, credential_id, enabled, created_at FROM service_configs 
       ORDER BY created_at DESC LIMIT 10`
    );
    
    if (serviceConfigsResult.rows.length === 0) {
      console.log('❌ No service configurations found in database\n');
    } else {
      console.log(`✅ Found ${serviceConfigsResult.rows.length} service configurations:\n`);
      for (const config of serviceConfigsResult.rows) {
        console.log(`   Service: ${config.service}`);
        console.log(`   Credential ID: ${config.credential_id}`);
        console.log(`   Enabled: ${config.enabled}`);
        console.log(`   Created: ${config.created_at}\n`);
      }
    }
    
    console.log('✅ Credential debugging completed successfully!\n');
  } catch (error: any) {
    console.error('❌ Error during credential debugging:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the debug function if this script is executed directly
if (require.main === module) {
  debugCredentials().catch(console.error);
}

export { debugCredentials };