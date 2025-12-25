/**
 * Database Initialization & Management
 * PostgreSQL connection pool with schema initialization and RLS support
 * 
 * Security:
 * - Row-Level Security (RLS) enabled on all credential tables
 * - All queries filtered by user_id
 * - Connection pooling to prevent resource exhaustion
 */

import pg, { Pool, PoolClient } from 'pg';
import { logger } from './logger.js';

// Export Pool type for use in other modules
export type DatabasePool = Pool;

// PostgreSQL connection pool
let pool: Pool | null = null;

/**
 * Database pool configuration
 */
function getPoolConfig() {
  return {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'kpi_etl',
    max: parseInt(process.env.DB_POOL_SIZE || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // 10 seconds for Docker container communication
  };
}

/**
 * Initialize database connection pool
 * Throws error if connection fails
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const config = getPoolConfig();
    pool = new pg.Pool(config);

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connection established');

    // Initialize schema
    await initializeSchema();
  } catch (error) {
    logger.error('Failed to initialize database', { error: String(error) });
    throw new Error('Database initialization failed');
  }
}

/**
 * Get pool instance (throw if not initialized)
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
}

/**
 * Initialize database schema (idempotent)
 * Creates all tables with RLS enabled based on the credential system design
 */
export async function initializeSchema(): Promise<void> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    // Create users table (if not exists) - links Clerk user IDs to local records
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
        onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      COMMENT ON COLUMN users.clerk_id IS 'Unique identifier from Clerk';
      COMMENT ON COLUMN users.status IS 'active, suspended, or deleted';
      COMMENT ON COLUMN users.onboarding_complete IS 'Whether user has completed onboarding flow';

      CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `);

    // Add onboarding_complete column if it doesn't exist (migration for existing tables)
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'users' AND column_name = 'onboarding_complete') THEN
          ALTER TABLE users ADD COLUMN onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
      END $$;
    `);

    // Create credentials table - stores encrypted service credentials
    await client.query(`
      CREATE TABLE IF NOT EXISTS credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service VARCHAR(50) NOT NULL CHECK (service IN ('google_sheets', 'meta', 'ga4', 'shopify')),
        name VARCHAR(255) NOT NULL,
        encrypted_data TEXT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      COMMENT ON COLUMN credentials.name IS 'User-friendly name (e.g. "My Google Account")';
      COMMENT ON COLUMN credentials.encrypted_data IS 'AES-256-GCM encrypted credential JSON';
      COMMENT ON COLUMN credentials.verified IS 'True if credential has been tested';
      COMMENT ON COLUMN credentials.verified_at IS 'When credential was last verified';
      COMMENT ON COLUMN credentials.expires_at IS 'When credential expires (if applicable)';
      COMMENT ON COLUMN credentials.deleted_at IS 'Soft delete timestamp';

      CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
      CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service);
      CREATE INDEX IF NOT EXISTS idx_credentials_deleted_at ON credentials(deleted_at);
    `);

    // Enable RLS on credentials table
    await client.query(`
      ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS credentials_user_isolation ON credentials;
      CREATE POLICY credentials_user_isolation ON credentials
        USING (user_id = current_setting('app.current_user_id')::INTEGER)
        WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);
    `);

    // Create service_configs table - tracks enabled services per user
    await client.query(`
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
    `);

    // Enable RLS on service_configs table
    await client.query(`
      ALTER TABLE service_configs ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS service_configs_user_isolation ON service_configs;
      CREATE POLICY service_configs_user_isolation ON service_configs
        USING (user_id = current_setting('app.current_user_id')::INTEGER)
        WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);
    `);

    // Create sheet_mappings table - maps services to Google Sheets locations
    await client.query(`
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
    `);

    // Enable RLS on sheet_mappings table
    await client.query(`
      ALTER TABLE sheet_mappings ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS sheet_mappings_user_isolation ON sheet_mappings;
      CREATE POLICY sheet_mappings_user_isolation ON sheet_mappings
        USING (user_id = current_setting('app.current_user_id')::INTEGER)
        WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);
    `);

    // Create audit_logs table - comprehensive audit trail
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        service VARCHAR(50),
        status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failure', 'partial')) DEFAULT 'success',
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      COMMENT ON COLUMN audit_logs.action IS 'Operation: credential_saved, credential_verified, etc.';
      COMMENT ON COLUMN audit_logs.service IS 'Service involved (if applicable)';
      COMMENT ON COLUMN audit_logs.error_message IS 'Error details (never credential data)';
      COMMENT ON COLUMN audit_logs.metadata IS 'Additional context (sanitized)';

      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);

    // Enable RLS on audit_logs table
    await client.query(`
      ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS audit_logs_user_isolation ON audit_logs;
      CREATE POLICY audit_logs_user_isolation ON audit_logs
        USING (user_id = current_setting('app.current_user_id')::INTEGER);
    `);

    // Create helper function to set RLS context
    await client.query(`
      CREATE OR REPLACE FUNCTION set_user_context(user_id INTEGER)
      RETURNS void AS $$
      BEGIN
        PERFORM set_config('app.current_user_id', user_id::text, false);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create job_schedules table - stores user-specific cron schedules
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_schedules (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service VARCHAR(50) NOT NULL CHECK (service IN ('meta', 'ga4', 'shopify')),
        cron_expression VARCHAR(100) NOT NULL,  -- e.g., "0 2 * * *" = daily at 2 AM
        enabled BOOLEAN DEFAULT false,
        timezone VARCHAR(50) DEFAULT 'Asia/Kolkata', -- User's timezone
        last_run_at TIMESTAMP,
        next_run_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_job_schedules_user_id ON job_schedules(user_id);
      CREATE INDEX IF NOT EXISTS idx_job_schedules_service ON job_schedules(service);
      CREATE INDEX IF NOT EXISTS idx_job_schedules_enabled ON job_schedules(enabled);
      CREATE INDEX IF NOT EXISTS idx_job_schedules_next_run ON job_schedules(next_run_at);
    `);

    // Enable RLS on job_schedules table
    await client.query(`
      ALTER TABLE job_schedules ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS job_schedules_user_isolation ON job_schedules;
      CREATE POLICY job_schedules_user_isolation ON job_schedules
        USING (user_id = current_setting('app.current_user_id')::INTEGER)
        WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);
    `);

    await client.query('COMMIT');
    logger.info('Database schema initialized');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize schema', { error: String(error) });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute RLS-protected query
 * Automatically sets user_id context for RLS policies
 */
export async function executeQuery<T = any>(
  sql: string,
  params: any[] = [],
  userId?: number
): Promise<{ rows: T[]; rowCount: number }> {
  const client = await getPool().connect();

  try {
    // Set user ID for RLS policies
    if (userId) {
      // Note: SET command doesn't support parameterized queries, so we use string interpolation
      // The userId comes from our auth middleware and is safe
      await client.query(`SET app.current_user_id = '${userId}'`);
    }

    const result = await client.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    logger.error('Query execution failed', { error: String(error), sql });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute transaction (for multi-step operations)
 */
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  userId?: number
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    // Set user ID for RLS policies
    if (userId) {
      // Note: SET command doesn't support parameterized queries, so we use string interpolation
      // The userId comes from our auth middleware and is safe
      await client.query(`SET app.current_user_id = '${userId}'`);
    }

    const result = await callback(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction failed', { error: String(error) });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get or create user by Clerk ID
 */
export async function getOrCreateUser(
  clerkId: string,
  email: string,
  name?: string
): Promise<{ id: number; clerk_id: string; email: string; name?: string }> {
  const result = await executeQuery(
    `
    INSERT INTO users (clerk_id, email, name)
    VALUES ($1, $2, $3)
    ON CONFLICT (clerk_id) DO UPDATE SET email = $2, name = COALESCE($3, users.name)
    RETURNING id, clerk_id, email, name;
    `,
    [clerkId, email, name || null]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to get or create user');
  }

  return result.rows[0];
}

/**
 * Get user by Clerk ID
 */
export async function getUserByClerkId(clerkId: string): Promise<any | null> {
  const result = await executeQuery(
    `SELECT id, clerk_id, email, onboarding_complete FROM users WHERE clerk_id = $1;`,
    [clerkId]
  );

  return result.rows[0] || null;
}

/**
 * Get user status including onboarding
 */
export async function getUserStatus(userId: number): Promise<{
  id: number;
  email: string;
  onboardingComplete: boolean;
} | null> {
  const result = await executeQuery(
    `SELECT id, email, onboarding_complete FROM users WHERE id = $1;`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  return {
    id: result.rows[0].id,
    email: result.rows[0].email,
    onboardingComplete: result.rows[0].onboarding_complete,
  };
}

/**
 * Update user onboarding status
 */
export async function updateOnboardingStatus(
  userId: number,
  complete: boolean
): Promise<boolean> {
  const result = await executeQuery(
    `UPDATE users SET onboarding_complete = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id;`,
    [complete, userId]
  );

  return result.rowCount > 0;
}

/**
 * Verify database connectivity
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await executeQuery('SELECT NOW()');
    return result.rows.length > 0;
  } catch {
    return false;
  }
}
