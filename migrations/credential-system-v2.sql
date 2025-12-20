-- ============================================================================
-- KPI ETL Credential System - Database Schema & Initial Migration
-- ============================================================================
--
-- This migration creates the core schema for credential management with
-- Row-Level Security (RLS) enabled for multi-tenant isolation.
--
-- Security Features:
-- - Row-Level Security policies on all user-owned data
-- - User context set via 'app.current_user_id' for RLS enforcement
-- - Soft deletes for credential history
-- - Audit logging for all credential operations
--
-- ============================================================================

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user information linked to Clerk auth system

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE NOT NULL COMMENT 'Unique identifier from Clerk',
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- CREDENTIALS TABLE
-- ============================================================================
-- Stores encrypted credentials for all services
-- Supports soft deletes via deleted_at timestamp

CREATE TABLE IF NOT EXISTS credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL CHECK (service IN ('google_sheets', 'meta', 'ga4', 'shopify')),
  name VARCHAR(255) NOT NULL COMMENT 'User-friendly name (e.g. "My Google Account")',
  encrypted_data TEXT NOT NULL COMMENT 'AES-256-GCM encrypted credential JSON',
  verified BOOLEAN DEFAULT FALSE COMMENT 'True if credential has been tested',
  verified_at TIMESTAMP COMMENT 'When credential was last verified',
  expires_at TIMESTAMP COMMENT 'When credential expires (if applicable)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP COMMENT 'Soft delete timestamp'
);

CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service);
CREATE INDEX IF NOT EXISTS idx_credentials_deleted_at ON credentials(deleted_at);

-- Enable Row-Level Security on credentials table
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS credentials_user_isolation ON credentials;

-- Create RLS policy: users can only see their own credentials
CREATE POLICY credentials_user_isolation ON credentials
  USING (user_id = current_setting('app.current_user_id')::INTEGER)
  WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);

-- ============================================================================
-- SERVICE_CONFIGS TABLE
-- ============================================================================
-- Tracks which services are enabled and which credential each uses

CREATE TABLE IF NOT EXISTS service_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL CHECK (service IN ('google_sheets', 'meta', 'ga4', 'shopify')),
  credential_id INTEGER NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, service)
);

CREATE INDEX IF NOT EXISTS idx_service_configs_user_id ON service_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_service_configs_service ON service_configs(service);

-- Enable Row-Level Security on service_configs table
ALTER TABLE service_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS service_configs_user_isolation ON service_configs;

-- Create RLS policy
CREATE POLICY service_configs_user_isolation ON service_configs
  USING (user_id = current_setting('app.current_user_id')::INTEGER)
  WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);

-- ============================================================================
-- SHEET_MAPPINGS TABLE
-- ============================================================================
-- Maps services to Google Sheets (spreadsheet ID and sheet name)

CREATE TABLE IF NOT EXISTS sheet_mappings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL CHECK (service IN ('google_sheets', 'meta', 'ga4', 'shopify')),
  spreadsheet_id VARCHAR(255) NOT NULL,
  sheet_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, service, spreadsheet_id, sheet_name)
);

CREATE INDEX IF NOT EXISTS idx_sheet_mappings_user_id ON sheet_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_sheet_mappings_service ON sheet_mappings(service);

-- Enable Row-Level Security on sheet_mappings table
ALTER TABLE sheet_mappings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS sheet_mappings_user_isolation ON sheet_mappings;

-- Create RLS policy
CREATE POLICY sheet_mappings_user_isolation ON sheet_mappings
  USING (user_id = current_setting('app.current_user_id')::INTEGER)
  WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================
-- Comprehensive audit trail of all credential operations
-- IMPORTANT: Never logs credential data, keys, or sensitive information

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL COMMENT 'Operation: credential_saved, credential_verified, etc.',
  service VARCHAR(50) COMMENT 'Service involved (if applicable)',
  status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failure', 'partial')) DEFAULT 'success',
  error_message TEXT COMMENT 'Error details (never credential data)',
  metadata JSONB COMMENT 'Additional context (sanitized)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Enable Row-Level Security on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS audit_logs_user_isolation ON audit_logs;

-- Create RLS policy: users can only see their own audit logs
CREATE POLICY audit_logs_user_isolation ON audit_logs
  USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- ============================================================================
-- HELPER FUNCTION: Set RLS context
-- ============================================================================
-- This function should be called at the start of each request to set
-- the current user ID for RLS policies

CREATE OR REPLACE FUNCTION set_user_context(user_id INTEGER)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id::text, false);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Get active services for user
-- ============================================================================
-- Returns configured services with their credentials

CREATE OR REPLACE FUNCTION get_user_active_services(user_id INTEGER)
RETURNS TABLE (
  service VARCHAR,
  enabled BOOLEAN,
  credential_id INTEGER,
  credential_name VARCHAR,
  credential_verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.service::VARCHAR,
    sc.enabled,
    sc.credential_id,
    c.name::VARCHAR,
    c.verified
  FROM service_configs sc
  LEFT JOIN credentials c ON sc.credential_id = c.id
  WHERE sc.user_id = user_id
  ORDER BY sc.service;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
