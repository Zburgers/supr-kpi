/**
 * Example Integration Code
 * How to use the credential management system from the frontend
 */

// ============================================================================
// 1. SETUP - Initialize API client
// ============================================================================

// Create an API client with authentication
const api = {
  baseUrl: 'http://localhost:3001/api',
  token: null,

  setToken(token: string) {
    this.token = token;
  },

  async request<T>(method: string, path: string, body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  },
};

// ============================================================================
// 2. SAVE CREDENTIALS
// ============================================================================

// Save a Google Sheets credential
async function saveGoogleCredential(
  serviceAccountJson: string,
  name: string
) {
  const response = await api.request('POST', '/credentials/save', {
    credentialJson: serviceAccountJson,
    credentialName: name,
    service: 'google_sheets',
  });

  return response;
  // Response: { credentialId, service, name, verified, createdAt }
}

// Example usage:
async function example_saveGoogleCredential() {
  const serviceAccount = `{
    "type": "service_account",
    "project_id": "my-project",
    "private_key_id": "key123",
    "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIB...",
    "client_email": "service@my-project.iam.gserviceaccount.com",
    "client_id": "123456789",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token"
  }`;

  try {
    const credential = await saveGoogleCredential(
      serviceAccount,
      'My Google Service Account'
    );
    console.log('Saved credential:', credential.credentialId);
  } catch (error) {
    console.error('Failed to save credential:', error);
  }
}

// ============================================================================
// 3. LIST CREDENTIALS
// ============================================================================

async function listCredentials() {
  const response = await api.request<any>('GET', '/credentials/list');
  return response.credentials;
}

// Example usage:
async function example_listCredentials() {
  try {
    const credentials = await listCredentials();
    credentials.forEach(cred => {
      console.log(`${cred.service}: ${cred.name} (verified: ${cred.verified})`);
    });
  } catch (error) {
    console.error('Failed to list credentials:', error);
  }
}

// ============================================================================
// 4. VERIFY CREDENTIAL
// ============================================================================

async function verifyCredential(credentialId: number) {
  const response = await api.request(
    'POST',
    `/credentials/${credentialId}/verify`
  );
  return response;
  // Response: { verified, message, connectedAs, expiresAt }
}

// Example usage:
async function example_verifyCredential(credentialId: number) {
  try {
    const result = await verifyCredential(credentialId);
    if (result.verified) {
      console.log(`Connected as: ${result.connectedAs}`);
    } else {
      console.log('Verification failed');
    }
  } catch (error) {
    console.error('Verification error:', error);
  }
}

// ============================================================================
// 5. ENABLE SERVICE
// ============================================================================

async function enableService(
  service: 'google_sheets' | 'meta' | 'ga4' | 'shopify',
  credentialId: number
) {
  const response = await api.request(
    'POST',
    `/services/${service}/enable`,
    { credentialId }
  );
  return response;
}

// Example usage:
async function example_enableService(credentialId: number) {
  try {
    const result = await enableService('google_sheets', credentialId);
    console.log(`Service enabled: ${result.service}`);
  } catch (error) {
    console.error('Failed to enable service:', error);
  }
}

// ============================================================================
// 6. LIST SERVICES
// ============================================================================

async function listServices() {
  const response = await api.request<any>('GET', '/services');
  return response.services;
}

// Example usage:
async function example_listServices() {
  try {
    const services = await listServices();
    services.forEach(service => {
      const status = service.enabled ? '✓ Enabled' : '○ Disabled';
      const cred = service.credential
        ? ` (${service.credential.name})`
        : ' (no credential)';
      console.log(`${status} ${service.name}${cred}`);
    });
  } catch (error) {
    console.error('Failed to list services:', error);
  }
}

// ============================================================================
// 7. SET SHEET MAPPING
// ============================================================================

async function setSheetMapping(
  service: string,
  spreadsheetId: string,
  sheetName: string
) {
  const response = await api.request('POST', '/sheet-mappings/set', {
    service,
    spreadsheetId,
    sheetName,
  });
  return response;
}

// Example usage:
async function example_setSheetMapping() {
  try {
    const mapping = await setSheetMapping(
      'meta',
      '1abc123def456',
      'meta_raw_daily'
    );
    console.log(`Mapped ${mapping.service} to sheet: ${mapping.sheetName}`);
  } catch (error) {
    console.error('Failed to set sheet mapping:', error);
  }
}

// ============================================================================
// 8. COMPLETE SETUP FLOW
// ============================================================================

/**
 * Example: Complete setup flow for a new service
 */
async function example_completeSetupFlow() {
  try {
    console.log('🚀 Starting credential setup...\n');

    // 1. List existing credentials
    console.log('Step 1: Checking existing credentials...');
    const credentials = await listCredentials();
    console.log(`Found ${credentials.length} credentials\n`);

    // 2. Save new credential (if needed)
    console.log('Step 2: Saving new credential...');
    const credentialJson = `{
      "type": "service_account",
      "project_id": "my-project",
      "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIB...",
      "client_email": "service@my-project.iam.gserviceaccount.com",
      "client_id": "123456789",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token"
    }`;

    const newCred = await saveGoogleCredential(
      credentialJson,
      'Production Google Account'
    );
    console.log(`✓ Saved credential ID: ${newCred.credentialId}\n`);

    // 3. Verify credential
    console.log('Step 3: Verifying credential...');
    const verification = await verifyCredential(newCred.credentialId);
    if (verification.verified) {
      console.log(`✓ Verified! Connected as: ${verification.connectedAs}\n`);
    } else {
      console.error('✗ Verification failed\n');
      return;
    }

    // 4. Enable service
    console.log('Step 4: Enabling service...');
    const enabled = await enableService('google_sheets', newCred.credentialId);
    console.log(`✓ Service enabled: ${enabled.service}\n`);

    // 5. Set sheet mapping
    console.log('Step 5: Setting sheet mapping...');
    const mapping = await setSheetMapping(
      'google_sheets',
      '1abc123def456',
      'KPI Data'
    );
    console.log(`✓ Mapped to spreadsheet: ${mapping.spreadsheetId}\n`);

    // 6. List final configuration
    console.log('Step 6: Final configuration...');
    const services = await listServices();
    services.forEach(service => {
      if (service.enabled) {
        console.log(`✓ ${service.name} enabled with: ${service.credential.name}`);
      }
    });

    console.log('\n✅ Setup complete!');
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// ============================================================================
// 9. REACT COMPONENT EXAMPLE
// ============================================================================

import React, { useState, useEffect } from 'react';

interface Credential {
  id: number;
  service: string;
  name: string;
  verified: boolean;
}

export function CredentialManagement() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  async function loadCredentials() {
    try {
      setLoading(true);
      const creds = await listCredentials();
      setCredentials(creds);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(credentialId: number) {
    try {
      const result = await verifyCredential(credentialId);
      if (result.verified) {
        alert(`Verified! Connected as: ${result.connectedAs}`);
        loadCredentials();
      }
    } catch (err) {
      alert('Verification failed');
    }
  }

  if (loading) return <div>Loading credentials...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="credential-management">
      <h2>Credentials</h2>
      {credentials.length === 0 ? (
        <p>No credentials configured</p>
      ) : (
        <ul>
          {credentials.map(cred => (
            <li key={cred.id}>
              <span>{cred.name}</span>
              <span className={cred.verified ? 'verified' : 'unverified'}>
                {cred.verified ? '✓' : '○'} {cred.service}
              </span>
              <button onClick={() => handleVerify(cred.id)}>
                Verify
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// 10. ERROR HANDLING
// ============================================================================

interface ApiError {
  error: string;
  code: string;
  details?: Record<string, any>;
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: any
): Promise<T> {
  try {
    const response = await fetch(`${api.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      switch (error.code) {
        case 'MISSING_TOKEN':
        case 'INVALID_TOKEN':
        case 'AUTH_FAILED':
          throw new Error('Authentication required. Please sign in.');

        case 'CREDENTIAL_NOT_FOUND':
          throw new Error('Credential not found.');

        case 'INVALID_CREDENTIAL_FORMAT':
          throw new Error('Invalid credential format. Check the JSON.');

        case 'VERIFICATION_FAILED':
          throw new Error('Credential verification failed. Check your details.');

        default:
          throw new Error(error.error || 'Request failed');
      }
    }

    return data as T;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ============================================================================
// 11. TYPESCRIPT TYPES
// ============================================================================

// Request bodies
interface SaveCredentialRequest {
  credentialJson: string;
  credentialName: string;
  service: 'google_sheets' | 'meta' | 'ga4' | 'shopify';
}

interface EnableServiceRequest {
  credentialId: number;
}

interface SetSheetMappingRequest {
  service: string;
  spreadsheetId: string;
  sheetName: string;
}

// Response bodies
interface SaveCredentialResponse {
  credentialId: number;
  service: string;
  name: string;
  verified: boolean;
  createdAt: string;
}

interface VerifyCredentialResponse {
  verified: boolean;
  message: string;
  connectedAs?: string;
  expiresAt?: string;
}

interface ListServicesResponse {
  services: Array<{
    name: string;
    enabled: boolean;
    credential?: {
      id: number;
      name: string;
      verified: boolean;
    };
  }>;
}

// ============================================================================
// 12. RUNNING THE EXAMPLES
// ============================================================================

// Run this to execute all examples:
async function runAllExamples() {
  // Set your JWT token first
  api.setToken('your_clerk_jwt_token_here');

  // Run examples
  await example_listCredentials();
  console.log('\n---\n');

  await example_saveGoogleCredential();
  console.log('\n---\n');

  await example_listServices();
  console.log('\n---\n');

  // Uncomment to run full setup flow:
  // await example_completeSetupFlow();
}

// Export for use
export {
  api,
  saveGoogleCredential,
  listCredentials,
  verifyCredential,
  enableService,
  listServices,
  setSheetMapping,
  apiRequest,
};
