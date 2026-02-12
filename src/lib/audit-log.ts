/**
 * Audit Logging Service
 * Logs all credential operations for security and compliance
 * 
 * Security:
 * - NEVER logs credential data, encryption keys, or API tokens
 * - Always logs action, user_id, service, status, and timestamp
 * - Metadata sanitized before logging
 */

import { executeQuery } from './database.js';
import { logger } from './logger.js';

export type AuditAction =
  | 'credential_saved'
  | 'credential_updated'
  | 'credential_deleted'
  | 'credential_verified'
  | 'credential_decrypted'
  | 'credential_accessed'
  | 'service_enabled'
  | 'service_disabled'
  | 'sheet_mapping_set'
  | 'verification_failed'
  | 'workflow_run'
  | 'workflow_completed'
  | 'workflow_failed';

export type AuditStatus = 'success' | 'failure' | 'partial';

export interface AuditLogEntry {
  id?: number;
  user_id: number;
  action: AuditAction;
  service?: string;
  status: AuditStatus;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

/**
 * Log audit event
 * 
 * IMPORTANT: Sanitize metadata to remove sensitive data
 * Never log: credential JSON, encryption keys, API tokens, passwords
 */
export async function logAudit(
  userId: number,
  action: AuditAction,
  service?: string,
  status: AuditStatus = 'success',
  errorMessage?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Sanitize metadata - remove sensitive fields
    const sanitizedMetadata = sanitizeMetadata(metadata);

    await executeQuery(
      `
      INSERT INTO audit_logs (user_id, action, service, status, error_message, metadata)
      VALUES ($1, $2, $3, $4, $5, $6);
      `,
      [userId, action, service, status, errorMessage || null, JSON.stringify(sanitizedMetadata)],
      userId
    );

    logger.debug('Audit logged', {
      userId,
      action,
      service,
      status,
    });
  } catch (error) {
    logger.error('Failed to log audit', {
      error: String(error),
      action,
      userId,
    });
    // Don't throw - audit failures should not break the application
  }
}

/**
 * Sanitize metadata to remove sensitive information
 */
function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata) return {};

  const sanitized = { ...metadata };
  const sensitiveFields = [
    'credential',
    'encrypted_data',
    'password',
    'token',
    'access_token',
    'refresh_token',
    'api_key',
    'secret',
    'private_key',
    'credentialJson',
    'credentials',
    'auth',
  ];

  // Remove sensitive fields recursively
  const sanitize = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj !== null && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitize(value);
        }
      }
      return result;
    }
    return obj;
  };

  return sanitize(sanitized);
}

/**
 * Get audit logs for user
 */
export async function getAuditLogs(
  userId: number,
  options?: {
    action?: AuditAction;
    service?: string;
    limit?: number;
    offset?: number;
  }
): Promise<AuditLogEntry[]> {
  // CRITICAL: Always filter by user_id for multi-tenant isolation
  // This ensures logs are isolated per user and reinforces RLS policy
  let query = 'SELECT * FROM audit_logs WHERE user_id = $1';
  const params: any[] = [userId];

  if (options?.action) {
    query += ` AND action = $${params.length + 1}`;
    params.push(options.action);
  }

  if (options?.service) {
    query += ` AND service = $${params.length + 1}`;
    params.push(options.service);
  }

  query += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(options.limit);
  }

  if (options?.offset) {
    query += ` OFFSET $${params.length + 1}`;
    params.push(options.offset);
  }

  query += ';';

  const result = await executeQuery(query, params, userId);
  return result.rows;
}

/**
 * Get audit logs summary (count by action)
 */
export async function getAuditLogsSummary(
  userId: number
): Promise<Record<string, number>> {
  // CRITICAL: Filter by user_id for multi-tenant isolation
  const result = await executeQuery(
    `
    SELECT action, COUNT(*) as count
    FROM audit_logs
    WHERE user_id = $1
    GROUP BY action
    ORDER BY count DESC;
    `,
    [userId],
    userId
  );

  const summary: Record<string, number> = {};
  result.rows.forEach(row => {
    summary[row.action] = row.count;
  });

  return summary;
}
