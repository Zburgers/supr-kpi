# Secure Credential Storage & Management System Design

## Executive Summary

This document defines the architecture for a multi-user, enterprise-grade credential management system for the KPI ETL pipeline. The system ensures:
- **Encryption at Rest**: All credentials encrypted with AES-256-GCM
- **Per-User Isolation**: Row-level security via PostgreSQL policies
- **Audit Trail**: Complete logging of credential access
- **Zero Trust**: No credentials in logs, environment variables, or memory

---

## 1. DATABASE SCHEMA ARCHITECTURE

### 1.1 Entity Relationship Diagram

```
┌─────────────┐
│   users     │
│ (from Clerk)│
└──────┬──────┘
       │
       ├─→ ┌──────────────────────┐
       │   │  api_credentials     │
       │   │ (encrypted storage)  │
       │   └──────────────────────┘
       │
       ├─→ ┌──────────────────────┐
       │   │ service_configs      │
       │   │(enabled services)    │
       │   └──────────────────────┘
       │
       ├─→ ┌──────────────────────┐
       │   │ sheet_mappings       │
       │   │(service→sheet link)  │
       │   └──────────────────────┘
       │
       ├─→ ┌──────────────────────┐
       │   │ sync_jobs            │
       │   │(scheduled jobs)      │
       │   └──────────────────────┘
       │
       └─→ ┌──────────────────────┐
           │ credential_audit_log │
           │(access tracking)     │
           └──────────────────────┘
```

### 1.2 Core Tables

#### **users** Table
Links Clerk user IDs to local system user records.

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, suspended, deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);
```

#### **api_credentials** Table
Stores encrypted credentials with version tracking and rotation support.

```sql
CREATE TABLE api_credentials (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL, -- 'google_sheets', 'meta', 'ga4', 'shopify'
  
  -- Encrypted data
  credential_name VARCHAR(255) NOT NULL, -- User-friendly name
  encrypted_data BYTEA NOT NULL, -- AES-256-GCM encrypted credential
  iv BYTEA NOT NULL, -- Initialization vector (16 bytes)
  auth_tag BYTEA NOT NULL, -- Authentication tag (16 bytes)
  
  -- Metadata
  version INT NOT NULL DEFAULT 1, -- For credential rotation
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  verification_status VARCHAR(50) DEFAULT 'pending', -- pending, valid, invalid
  
  -- Lifecycle
  expires_at TIMESTAMP WITH TIME ZONE, -- For OAuth tokens
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_credential_per_user_service 
    UNIQUE(user_id, service_type, credential_name)
);

CREATE INDEX idx_api_credentials_user_id ON api_credentials(user_id);
CREATE INDEX idx_api_credentials_service_type ON api_credentials(service_type);
CREATE INDEX idx_api_credentials_is_active ON api_credentials(is_active);
```

#### **service_configs** Table
Tracks which services are enabled for each user.

```sql
CREATE TABLE service_configs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL, -- 'google_sheets', 'meta', 'ga4', 'shopify'
  
  -- Configuration
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  config_data JSONB, -- Service-specific configuration (not encrypted)
  
  -- OAuth specific
  oauth_refresh_token_id BIGINT REFERENCES api_credentials(id),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_service_config_per_user 
    UNIQUE(user_id, service_type)
);

CREATE INDEX idx_service_configs_user_id ON service_configs(user_id);
```

#### **sheet_mappings** Table
Maps which Google Sheet URL each service syncs to.

```sql
CREATE TABLE sheet_mappings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL,
  
  -- Sheet reference
  sheet_id VARCHAR(255) NOT NULL, -- Google Sheet ID
  sheet_name VARCHAR(255) NOT NULL, -- Worksheet name
  
  -- Mapping metadata
  column_mappings JSONB NOT NULL DEFAULT '{}', -- {metric_field: column_letter, ...}
  is_default BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_mapping_per_user_service 
    UNIQUE(user_id, service_type, sheet_id)
);

CREATE INDEX idx_sheet_mappings_user_id ON sheet_mappings(user_id);
```

#### **sync_jobs** Table
Tracks scheduled and manual sync jobs.

```sql
CREATE TABLE sync_jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL,
  
  -- Job scheduling
  job_type VARCHAR(50) NOT NULL, -- 'scheduled', 'manual', 'webhook'
  cron_expression VARCHAR(255), -- NULL for manual jobs
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  
  -- Result tracking
  last_run_status VARCHAR(50),
  last_error_message TEXT, -- Non-sensitive error summary
  run_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  
  -- Configuration
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sync_jobs_user_id ON sync_jobs(user_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_next_run ON sync_jobs(next_run_at);
```

#### **credential_audit_log** Table
Immutable audit trail for all credential access.

```sql
CREATE TABLE credential_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id BIGINT NOT NULL REFERENCES api_credentials(id) ON DELETE SET NULL,
  
  -- Action details
  action VARCHAR(50) NOT NULL, -- 'created', 'retrieved', 'updated', 'deleted', 'verified'
  action_status VARCHAR(50) NOT NULL, -- 'success', 'failed'
  
  -- Context
  ip_address INET,
  user_agent VARCHAR(255),
  request_id VARCHAR(255), -- Correlation ID for request tracing
  
  -- Failure details (non-sensitive)
  failure_reason VARCHAR(255), -- e.g., "unauthorized", "invalid_format"
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user_id ON credential_audit_log(user_id);
CREATE INDEX idx_audit_log_credential_id ON credential_audit_log(credential_id);
CREATE INDEX idx_audit_log_created_at ON credential_audit_log(created_at);
CREATE INDEX idx_audit_log_action ON credential_audit_log(action);
```

#### **encryption_keys** Table
Track encryption keys for rotation and versioning.

```sql
CREATE TABLE encryption_keys (
  id BIGSERIAL PRIMARY KEY,
  key_version INT NOT NULL UNIQUE,
  algorithm VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm',
  
  -- Key material (wrapped/encrypted at DB level)
  key_hash VARCHAR(255) NOT NULL, -- SHA-256 hash for identification
  
  -- Lifecycle
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_retired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  retired_at TIMESTAMP WITH TIME ZONE,
  
  -- Rotation metadata
  rotation_reason VARCHAR(255),
  rotated_by VARCHAR(255) -- Admin/system identifier
);

CREATE INDEX idx_encryption_keys_active ON encryption_keys(is_active);
CREATE INDEX idx_encryption_keys_version ON encryption_keys(key_version);
```

---

## 2. SECURITY ARCHITECTURE

### 2.1 Encryption Strategy

#### **Algorithm**: AES-256-GCM (Authenticated Encryption with Associated Data)
- **Cipher**: AES-256 in GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 128 bits (16 bytes) - random per encryption
- **Auth Tag Size**: 128 bits (16 bytes) - built-in integrity verification

#### **Key Management**
1. **Master Key Storage**:
   - Primary: AWS Secrets Manager or HashiCorp Vault
   - Backup: Encrypted key in environment variable (for disaster recovery)
   - Never store in database

2. **Key Rotation Strategy**:
   - Automatic: Rotate every 90 days
   - On-Demand: When compromise suspected
   - Backwards Compatibility: Credentials encrypted with old keys decrypt on rotation
   - New Encryptions: Always use active key

3. **Key Rotation Process**:
   ```
   1. Create new key with version N+1
   2. Mark new key as active
   3. Keep old key version N active (for decryption)
   4. Background job: Re-encrypt old credentials with new key
   5. After 30 days: Retire old key (soft retire - keep for recovery)
   ```

### 2.2 Encryption/Decryption Flow

#### **Storing Credentials** (POST /api/credentials)
```
1. User submits credential through HTTPS
2. Backend validates format (no DB access yet)
3. Generate random 16-byte IV
4. Encrypt credential JSON with:
   - Master Key (256-bit)
   - IV (random)
   - AAD: `${user_id}:${service_type}:${credential_name}`
5. Store: encrypted_data, IV, auth_tag, version
6. Log action (no credential data): "credential_stored_for_${service}"
7. Return: credential_id, created_at (no encrypted data)
```

#### **Retrieving Credentials** (GET /api/credentials/:id)
```
1. Verify user_id from JWT matches credential.user_id
2. Fetch: encrypted_data, IV, auth_tag, key_version
3. Load master key for that version
4. Decrypt with:
   - Master Key
   - Same IV from storage
   - Same AAD
5. Validate auth_tag (automatic in GCM)
6. Parse JSON → return credential object (in-memory only)
7. Log action: "credential_retrieved"
8. Overwrite decrypted value from memory after use
```

#### **Using Credentials During Sync**
```
1. Sync job initiated
2. Load credential (see retrieval flow above)
3. Decrypt to in-memory buffer
4. Connect to external service (Google, Meta, etc.)
5. Clear buffer after connection established
6. Service client never writes credential to logs
```

### 2.3 Access Control

#### **Row-Level Security (RLS) Policies**
```sql
-- Users can only access their own credentials
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation_policy ON api_credentials
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());
```

#### **Application-Level Checks**
```typescript
// Every credential access requires:
1. Valid JWT with user_id
2. user_id === credential.user_id
3. User status !== 'suspended' or 'deleted'
4. Credential.is_active === true
5. Audit log entry
```

### 2.4 Secrets Management

#### **Environment Variables** (Never contains actual credentials)
```env
# Key Management
DATABASE_URL=postgresql://user:pass@host/db
MASTER_KEY_ID=key-version-1
MASTER_KEY_BACKUP=base64-encoded-backup-key (encrypted)

# External Services (never for user credentials)
CLERK_API_KEY=
AWS_REGION=us-east-1
VAULT_ADDR=https://vault.example.com
```

#### **Vault/Secrets Manager Pattern**
```
┌─────────────────────────┐
│  AWS Secrets Manager    │
│  (or HashiCorp Vault)   │
├─────────────────────────┤
│ master-key-v1 (active)  │
│ master-key-v0 (retired) │
│ master-key-v-1(backup)  │
└──────────┬──────────────┘
           │
        [TLS]
           │
   ┌───────▼────────┐
   │  Application   │
   │  (Node.js)     │
   └───────┬────────┘
           │
    ┌──────▼─────────┐
    │  PostgreSQL    │
    │ (encrypted DB) │
    └────────────────┘
```

### 2.5 Defense in Depth

| Layer | Control |
|-------|---------|
| **Transport** | TLS 1.3 for all API calls, database connections |
| **Authentication** | JWT from Clerk, signature verification |
| **Authorization** | Row-level security, application-level checks |
| **Encryption** | AES-256-GCM at rest, IV per encryption |
| **Integrity** | GCM auth tag, checksums, database constraints |
| **Audit** | Immutable logs, request correlation IDs |
| **Secrets** | External key vault, never in code/logs |

---

## 3. API ENDPOINTS SPECIFICATION

### 3.1 Create Credential
```
POST /api/v1/credentials
Authorization: Bearer <jwt_token>
Content-Type: application/json

Request:
{
  "service_type": "google_sheets" | "meta" | "ga4" | "shopify",
  "credential_name": "Primary Google Account",
  "credential_data": { ... service-specific format ... },
  "expires_at": "2025-12-31T23:59:59Z" // optional
}

Response: 201 Created
{
  "id": "cred_1a2b3c4d5e6f7g8h",
  "user_id": 123,
  "service_type": "google_sheets",
  "credential_name": "Primary Google Account",
  "version": 1,
  "is_active": true,
  "verification_status": "pending",
  "created_at": "2025-12-20T10:30:00Z"
}

Errors:
- 400: Invalid credential format
- 401: Unauthorized
- 409: Duplicate credential name for service
```

### 3.2 Retrieve Credential
```
GET /api/v1/credentials/:credential_id
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "id": "cred_1a2b3c4d5e6f7g8h",
  "user_id": 123,
  "service_type": "google_sheets",
  "credential_name": "Primary Google Account",
  "version": 1,
  "is_active": true,
  "verification_status": "valid",
  "last_verified_at": "2025-12-20T09:15:00Z",
  "expires_at": null,
  "created_at": "2025-12-20T10:30:00Z"
}

Notes:
- Response does NOT include encrypted_data or decrypted credentials
- Only decrypts for internal service usage
```

### 3.3 Update Credential
```
PUT /api/v1/credentials/:credential_id
Authorization: Bearer <jwt_token>
Content-Type: application/json

Request:
{
  "credential_name": "Updated Name", // optional
  "credential_data": { ... }, // optional - re-encrypts if provided
  "expires_at": "2025-12-31T23:59:59Z" // optional
}

Response: 200 OK
{
  "id": "cred_1a2b3c4d5e6f7g8h",
  "version": 2, // incremented
  "updated_at": "2025-12-20T11:00:00Z",
  ...
}

Errors:
- 400: Invalid update format
- 401: Unauthorized
- 404: Credential not found
```

### 3.4 Delete Credential
```
DELETE /api/v1/credentials/:credential_id
Authorization: Bearer <jwt_token>

Response: 204 No Content

Notes:
- Soft delete (is_active = false)
- Audit log preserved forever
- Hard deletion after 90 days (configurable)
```

### 3.5 Verify Credential (Test Connection)
```
POST /api/v1/credentials/:credential_id/verify
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "credential_id": "cred_1a2b3c4d5e6f7g8h",
  "is_valid": true,
  "verification_status": "valid",
  "last_verified_at": "2025-12-20T11:15:00Z",
  "message": "Successfully connected to Google Sheets API"
}

Error: 200 OK (still 200 for privacy)
{
  "credential_id": "cred_1a2b3c4d5e6f7g8h",
  "is_valid": false,
  "verification_status": "invalid",
  "message": "Credential verification failed" // Generic message
}

Notes:
- Returns 200 even on failure (doesn't reveal validity)
- Actual error logged only in audit log
- Updates last_verified_at timestamp
```

### 3.6 List Credentials
```
GET /api/v1/credentials?service_type=google_sheets&is_active=true
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "credentials": [
    {
      "id": "cred_1a2b3c4d5e6f7g8h",
      "service_type": "google_sheets",
      "credential_name": "Primary Google Account",
      "version": 1,
      "is_active": true,
      "verification_status": "valid",
      "created_at": "2025-12-20T10:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

## 4. ERROR HANDLING STRATEGY

### 4.1 Security-First Error Responses

#### **Public Errors** (Sent to client)
```typescript
// Generic, non-revealing
{
  "error": "Credential not found or access denied",
  "error_code": "CRED_001",
  "request_id": "req_abc123" // For support tracing
}
```

#### **Internal Errors** (Logged server-side only)
```typescript
{
  "timestamp": "2025-12-20T10:30:00Z",
  "request_id": "req_abc123",
  "severity": "error",
  "component": "credential_service",
  "error": "Decryption failed: auth tag validation failed",
  "context": {
    "credential_id": "cred_123",
    "user_id": 456,
    "key_version": 1,
    // NO credential data ever logged
  }
}
```

### 4.2 Error Categories

| Scenario | User Message | Action | Log Level |
|----------|--------------|--------|-----------|
| Invalid credential format | "Invalid credential format" | Reject | INFO |
| Decryption fails | "Credential access failed" | Alert Security | ERROR |
| Unauthorized access | "Not found or access denied" | Audit log | WARN |
| Database error | "Service unavailable" | Alert Ops | ERROR |
| Expired credential | "Credential expired" | Disable auto-sync | WARN |
| Key missing | "Service unavailable" | Alert Ops | CRITICAL |

### 4.3 What Never Gets Logged
```
❌ Credential values (plaintext or encrypted)
❌ API keys, tokens, passwords
❌ SQL queries with credential data
❌ HTTP request/response bodies with credentials
❌ Stack traces containing sensitive data
❌ User-provided encryption keys
```

### 4.4 What Gets Logged (Sanitized)
```
✅ Action performed (created, retrieved, deleted)
✅ service_type (google_sheets, meta, etc.)
✅ Result status (success, failure)
✅ Timestamp, user_id, request_id
✅ Generic error reason (timeout, auth failed)
✅ IP address, user agent
```

---

## 5. DATA MODELS & TYPES

### 5.1 TypeScript Types
[See separate file: `CREDENTIAL_SYSTEM_TYPES.ts`]

### 5.2 Credential Format by Service

#### **Google Sheets**
```json
{
  "type": "service_account",
  "project_id": "my-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "service@project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

#### **Meta Ads (OAuth 2.0)**
```json
{
  "access_token": "EAAB...",
  "token_type": "bearer",
  "expires_in": 5184000,
  "refresh_token": "...",
  "account_id": "123456789"
}
```

#### **Google Analytics 4**
```json
{
  "type": "oauth2",
  "client_id": "...",
  "client_secret": "...",
  "refresh_token": "...",
  "property_id": "123456789"
}
```

#### **Shopify**
```json
{
  "shop_url": "mystore.myshopify.com",
  "access_token": "shpat_...",
  "api_version": "2024-01"
}
```

---

## 6. MIGRATION & DEPLOYMENT STRATEGY

### 6.1 Phased Rollout
```
Phase 1: Database Schema Deployment
├─ Create all tables
├─ Enable RLS
└─ Verify constraints

Phase 2: Application Code Deployment
├─ Deploy credential service
├─ Deploy encryption/decryption
└─ Test with staging credentials

Phase 3: Data Migration
├─ Migrate env var credentials → encrypted storage
├─ Verify all credentials decrypt properly
└─ Audit log all migrations

Phase 4: Cutover
├─ Disable env var credential loading
├─ Enable database credential loading
└─ Monitor for issues
```

### 6.2 Backup & Recovery

#### **Credential Backup Strategy**
```
1. Daily encrypted database backups (AWS RDS)
2. Test restore quarterly
3. Separate backup encryption key
4. Offsite copies (different region)
5. Immutable audit logs (always recoverable)
```

#### **Key Recovery Process**
```
1. Alert triggered: Master key unavailable
2. Load backup key from Vault
3. Try decryption with backup key
4. If successful: Rotate to new key immediately
5. If failed: Trigger emergency protocol
```

---

## 7. COMPLIANCE & STANDARDS

- **SOC 2 Type II**: Audit logging, encryption, access controls
- **GDPR**: Data minimization, user data deletion, audit trails
- **HIPAA** (if health data): Encryption, access logs, breach notification
- **PCI DSS** (if payment data): No credential logging, encryption
- **ISO 27001**: Information security management

---

## 8. MONITORING & ALERTING

### Critical Alerts
```
- Decryption failure rate > 0.1%
- Key rotation failure
- Unauthorized access attempt
- Credential audit log write failure
- Master key unavailable
```

### Dashboards
```
- Credential count by service type
- Verification success rate
- Failed decryption events
- Audit log volume
- Key rotation timeline
```

---

## Summary

This design provides:
✅ **Encryption at rest** with AES-256-GCM  
✅ **Per-user isolation** via RLS and application checks  
✅ **Complete audit trail** of all access  
✅ **Key rotation** capability without downtime  
✅ **Zero credential exposure** in logs  
✅ **Service verification** with generic error messages  
✅ **GDPR/SOC2 ready** architecture  
✅ **Disaster recovery** paths for key loss  

Next steps:
1. Implement TypeScript service layer
2. Create migration scripts
3. Deploy to staging
4. Run comprehensive security audit
5. Plan credential migration from env vars
