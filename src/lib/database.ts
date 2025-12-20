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
    connectionTimeoutMillis: 2000,
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
 * Creates all tables with RLS enabled
 */
export async function initializeSchema(): Promise<void> {
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');

    // Create users table (if not exists)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Create credentials table
    await client.query(`
      CREATE TABLE IF NOT EXISTS credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        encrypted_data TEXT NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

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

    // Create service_configs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_configs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service VARCHAR(50) NOT NULL,
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

    // Create sheet_mappings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sheet_mappings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service VARCHAR(50) NOT NULL,
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

    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        service VARCHAR(50),
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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
      await client.query('SET app.current_user_id = $1', [userId]);
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
      await client.query('SET app.current_user_id = $1', [userId]);
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
  email: string
): Promise<{ id: number; clerk_id: string; email: string }> {
  const result = await executeQuery(
    `
    INSERT INTO users (clerk_id, email)
    VALUES ($1, $2)
    ON CONFLICT (clerk_id) DO UPDATE SET email = $2
    RETURNING id, clerk_id, email;
    `,
    [clerkId, email]
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
    `SELECT id, clerk_id, email FROM users WHERE clerk_id = $1;`,
    [clerkId]
  );

  return result.rows[0] || null;
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
