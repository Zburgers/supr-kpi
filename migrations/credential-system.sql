/**
 * Database Migration Scripts
 * 
 * Run these migrations in order:
 * 1. 001-create-users-table.sql
 * 2. 002-create-encryption-keys-table.sql
 * 3. 003-create-api-credentials-table.sql
 * 4. 004-create-service-configs-table.sql
 * 5. 005-create-sheet-mappings-table.sql
 * 6. 006-create-sync-jobs-table.sql
 * 7. 007-create-audit-log-table.sql
 * 8. 008-enable-rls.sql
 * 
 * Execute with:
 * psql -h localhost -U postgres -d kpi_db -f migration-file.sql
 */

-- ============================================================================
-- Migration 001: Create Users Table
-- ============================================================================
-- File: migrations/001-create-users-table.sql

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

COMMENT ON TABLE users IS 'User accounts linked to Clerk user IDs';
COMMENT ON COLUMN users.clerk_id IS 'Unique Clerk user identifier';
COMMENT ON COLUMN users.status IS 'active, suspended, or deleted';

-- ============================================================================
-- Migration 002: Create Encryption Keys Table
-- ============================================================================
-- File: migrations/002-create-encryption-keys-table.sql

CREATE TABLE IF NOT EXISTS encryption_keys (
  id BIGSERIAL PRIMARY KEY,
  key_version INT NOT NULL UNIQUE,
  algorithm VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm',
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_retired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  retired_at TIMESTAMP WITH TIME ZONE,
  rotation_reason VARCHAR(255),
  rotated_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_version ON encryption_keys(key_version);

COMMENT ON TABLE encryption_keys IS 'Tracks encryption key versions for rotation';
COMMENT ON COLUMN encryption_keys.key_hash IS 'SHA-256 hash for key identification (not the key itself)';
COMMENT ON COLUMN encryption_keys.is_active IS 'Only one key should be active at a time';

-- ============================================================================
-- Migration 003: Create API Credentials Table
-- ============================================================================
-- File: migrations/003-create-api-credentials-table.sql

CREATE TABLE IF NOT EXISTS api_credentials (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('google_sheets', 'meta', 'ga4', 'shopify')),
  
  -- Credential metadata
  credential_name VARCHAR(255) NOT NULL,
  
  -- Encrypted data (AES-256-GCM)
  encrypted_data BYTEA NOT NULL,
  iv BYTEA NOT NULL CHECK (octet_length(iv) = 16),
  auth_tag BYTEA NOT NULL CHECK (octet_length(auth_tag) = 16),
  
  -- Encryption metadata
  key_version INT NOT NULL REFERENCES encryption_keys(key_version),
  
  -- Version tracking
  version INT NOT NULL DEFAULT 1,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  verification_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'valid', 'invalid')),
  last_verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Lifecycle
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_credential_per_user_service_name 
    UNIQUE(user_id, service_type, credential_name),
  
  CONSTRAINT valid_iv_size CHECK (octet_length(iv) = 16),
  CONSTRAINT valid_auth_tag_size CHECK (octet_length(auth_tag) = 16)
);

CREATE INDEX IF NOT EXISTS idx_api_credentials_user_id ON api_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_service_type ON api_credentials(service_type);
CREATE INDEX IF NOT EXISTS idx_api_credentials_is_active ON api_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_api_credentials_user_service ON api_credentials(user_id, service_type);
CREATE INDEX IF NOT EXISTS idx_api_credentials_expires ON api_credentials(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE api_credentials IS 'Encrypted API credentials for external services';
COMMENT ON COLUMN api_credentials.encrypted_data IS 'AES-256-GCM encrypted credential JSON';
COMMENT ON COLUMN api_credentials.iv IS 'Random 16-byte initialization vector for this encryption';
COMMENT ON COLUMN api_credentials.auth_tag IS 'GCM authentication tag for integrity verification';
COMMENT ON COLUMN api_credentials.key_version IS 'Links to encryption_keys.key_version for rotation support';

-- ============================================================================
-- Migration 004: Create Service Configs Table
-- ============================================================================
-- File: migrations/004-create-service-configs-table.sql

CREATE TABLE IF NOT EXISTS service_configs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('google_sheets', 'meta', 'ga4', 'shopify')),
  
  -- Configuration
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  config_data JSONB DEFAULT '{}',
  
  -- OAuth tracking
  oauth_refresh_token_id BIGINT REFERENCES api_credentials(id) ON DELETE SET NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_service_config_per_user 
    UNIQUE(user_id, service_type)
);

CREATE INDEX IF NOT EXISTS idx_service_configs_user_id ON service_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_service_configs_enabled ON service_configs(is_enabled);
CREATE INDEX IF NOT EXISTS idx_service_configs_user_service ON service_configs(user_id, service_type);

COMMENT ON TABLE service_configs IS 'Service enablement and configuration per user';
COMMENT ON COLUMN service_configs.config_data IS 'Service-specific config (not encrypted)';
COMMENT ON COLUMN service_configs.oauth_refresh_token_id IS 'References the refresh token credential if OAuth';

-- ============================================================================
-- Migration 005: Create Sheet Mappings Table
-- ============================================================================
-- File: migrations/005-create-sheet-mappings-table.sql

CREATE TABLE IF NOT EXISTS sheet_mappings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('google_sheets', 'meta', 'ga4', 'shopify')),
  
  -- Sheet reference
  sheet_id VARCHAR(255) NOT NULL,
  sheet_name VARCHAR(255) NOT NULL,
  
  -- Column mappings
  column_mappings JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_mapping_per_user_service 
    UNIQUE(user_id, service_type, sheet_id)
);

CREATE INDEX IF NOT EXISTS idx_sheet_mappings_user_id ON sheet_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_sheet_mappings_service ON sheet_mappings(service_type);
CREATE INDEX IF NOT EXISTS idx_sheet_mappings_is_default ON sheet_mappings(is_default);

COMMENT ON TABLE sheet_mappings IS 'Maps which Google Sheet each service syncs data to';
COMMENT ON COLUMN sheet_mappings.column_mappings IS 'JSON object mapping metric fields to sheet columns';

-- ============================================================================
-- Migration 006: Create Sync Jobs Table
-- ============================================================================
-- File: migrations/006-create-sync-jobs-table.sql

CREATE TABLE IF NOT EXISTS sync_jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('google_sheets', 'meta', 'ga4', 'shopify')),
  
  -- Job scheduling
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('scheduled', 'manual', 'webhook')),
  cron_expression VARCHAR(255),
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  
  -- Results
  last_run_status VARCHAR(50),
  last_error_message TEXT, -- No sensitive data
  run_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  
  -- Configuration
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_user_id ON sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_next_run ON sync_jobs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_is_enabled ON sync_jobs(is_enabled);

COMMENT ON TABLE sync_jobs IS 'Scheduled and manual data sync jobs';
COMMENT ON COLUMN sync_jobs.last_error_message IS 'Generic error summary (no sensitive data)';

-- ============================================================================
-- Migration 007: Create Audit Log Table
-- ============================================================================
-- File: migrations/007-create-audit-log-table.sql

CREATE TABLE IF NOT EXISTS credential_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id BIGINT REFERENCES api_credentials(id) ON DELETE SET NULL,
  
  -- Action details
  action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'retrieved', 'updated', 'deleted', 'verified')),
  action_status VARCHAR(50) NOT NULL CHECK (action_status IN ('success', 'failed')),
  
  -- Context
  ip_address INET,
  user_agent VARCHAR(255),
  request_id VARCHAR(255),
  
  -- Failure info (non-sensitive)
  failure_reason VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON credential_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_credential_id ON credential_audit_log(credential_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON credential_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON credential_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_request_id ON credential_audit_log(request_id);

COMMENT ON TABLE credential_audit_log IS 'Immutable audit trail of all credential access';
COMMENT ON COLUMN credential_audit_log.request_id IS 'Correlation ID for request tracing';

-- ============================================================================
-- Migration 008: Enable Row Level Security (RLS)
-- ============================================================================
-- File: migrations/008-enable-rls.sql

-- Enable RLS on credential tables
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_credentials
DROP POLICY IF EXISTS api_credentials_user_isolation ON api_credentials;
CREATE POLICY api_credentials_user_isolation ON api_credentials
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

DROP POLICY IF EXISTS api_credentials_service_read ON api_credentials;
CREATE POLICY api_credentials_service_read ON api_credentials
  FOR SELECT
  USING (
    user_id = current_user_id()
    AND is_active = true
  );

-- Create RLS policies for service_configs
DROP POLICY IF EXISTS service_configs_user_isolation ON service_configs;
CREATE POLICY service_configs_user_isolation ON service_configs
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- Create RLS policies for sheet_mappings
DROP POLICY IF EXISTS sheet_mappings_user_isolation ON sheet_mappings;
CREATE POLICY sheet_mappings_user_isolation ON sheet_mappings
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- Create RLS policies for sync_jobs
DROP POLICY IF EXISTS sync_jobs_user_isolation ON sync_jobs;
CREATE POLICY sync_jobs_user_isolation ON sync_jobs
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- Create RLS policies for audit_log (audit-only, users can read their own)
DROP POLICY IF EXISTS audit_log_user_isolation ON credential_audit_log;
CREATE POLICY audit_log_user_isolation ON credential_audit_log
  FOR SELECT
  USING (user_id = current_user_id());

DROP POLICY IF EXISTS audit_log_prevent_modification ON credential_audit_log;
CREATE POLICY audit_log_prevent_modification ON credential_audit_log
  FOR INSERT, UPDATE, DELETE
  WITH CHECK (FALSE);

-- ============================================================================
-- Migration 009: Add Initial Encryption Key
-- ============================================================================
-- File: migrations/009-add-initial-encryption-key.sql

-- Insert initial encryption key (key material NOT stored here)
INSERT INTO encryption_keys (
  key_version,
  algorithm,
  key_hash,
  is_active,
  created_at
) VALUES (
  1,
  'aes-256-gcm',
  'SHA256_OF_INITIAL_KEY_PLACEHOLDER',
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (key_version) DO NOTHING;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run these to verify the schema was created correctly:
/*
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'api_credentials', 'service_configs', 'sheet_mappings', 'sync_jobs', 'credential_audit_log', 'encryption_keys')
ORDER BY table_name;

-- Check for RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('api_credentials', 'service_configs', 'sheet_mappings', 'sync_jobs', 'credential_audit_log')
ORDER BY tablename, policyname;

-- Check indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('users', 'api_credentials', 'service_configs', 'sheet_mappings', 'sync_jobs', 'credential_audit_log', 'encryption_keys')
ORDER BY tablename, indexname;
*/
