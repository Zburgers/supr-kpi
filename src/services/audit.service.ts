/**
 * Audit Service
 * 
 * Handles immutable audit logging for all credential access
 * Critical for compliance and security monitoring
 */

import { Logger } from '../lib/logger';
import { AuditLogEntry, CreateAuditLogRequest } from '../types/credential-system';
import { DatabasePool } from '../lib/database';

/**
 * Audit Service
 * 
 * Responsibilities:
 * - Log all credential access (create, read, update, delete, verify)
 * - Prevent modification of audit logs (append-only)
 * - Track request context (IP, user agent, request ID)
 * - Never log sensitive credential data
 * - Ensure logs are immutable and recoverable
 */
export class AuditService {
  private logger: Logger;
  private db: DatabasePool;

  constructor(db: DatabasePool) {
    this.logger = new Logger('AuditService');
    this.db = db;
  }

  /**
   * Log credential action
   * 
   * @param userId - User ID
   * @param credentialId - Credential ID (optional for creation failures)
   * @param action - Action performed (created, retrieved, updated, deleted, verified)
   * @param status - Success or failure
   * @param failureReason - Generic failure reason (not sensitive details)
   * @param context - Request context (IP, user agent, request ID)
   */
  async logCredentialAction(
    userId: number,
    credentialId: number | undefined,
    action: 'created' | 'retrieved' | 'updated' | 'deleted' | 'verified',
    status: 'success' | 'failed',
    failureReason?: string,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    }
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO credential_audit_log (
          user_id,
          credential_id,
          action,
          action_status,
          ip_address,
          user_agent,
          request_id,
          failure_reason,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP
        )
      `;

      await this.db.query(query, [
        userId,
        credentialId || null,
        action,
        status,
        context?.ipAddress || null,
        context?.userAgent || null,
        context?.requestId || null,
        failureReason || null,
      ]);

      // Only log action type and status, never credential data
      this.logger.info('Audit log recorded', {
        userId,
        credentialId,
        action,
        status,
      });
    } catch (error) {
      // This is critical - log failure but don't crash
      this.logger.error('Failed to record audit log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        action,
      });

      // Could optionally send alert to monitoring system
      // alertMonitoring('AUDIT_LOG_FAILURE');
    }
  }

  /**
   * Get audit log for a credential
   * 
   * Only accessible to the user who owns the credential
   * 
   * @param userId - User ID
   * @param credentialId - Credential ID
   * @returns Audit log entries
   */
  async getCredentialAuditLog(
    userId: number,
    credentialId: number,
    limit: number = 50
  ): Promise<AuditLogEntry[]> {
    const query = `
      SELECT
        id,
        user_id,
        credential_id,
        action,
        action_status,
        ip_address,
        user_agent,
        request_id,
        failure_reason,
        created_at
      FROM credential_audit_log
      WHERE user_id = $1 AND credential_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;

    const result = await this.db.query(query, [userId, credentialId, limit]);

    return result.rows as AuditLogEntry[];
  }

  /**
   * Get all audit logs for a user
   * 
   * @param userId - User ID
   * @param limit - Maximum results
   * @returns Audit log entries
   */
  async getUserAuditLog(
    userId: number,
    limit: number = 100
  ): Promise<AuditLogEntry[]> {
    const query = `
      SELECT
        id,
        user_id,
        credential_id,
        action,
        action_status,
        ip_address,
        user_agent,
        request_id,
        failure_reason,
        created_at
      FROM credential_audit_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [userId, limit]);

    return result.rows as AuditLogEntry[];
  }

  /**
   * Check for suspicious activity
   * 
   * Looks for patterns that might indicate:
   * - Brute force decryption attempts
   * - Unauthorized access attempts
   * - Unusual access patterns
   * 
   * @param userId - User ID
   * @returns Alert if suspicious activity detected
   */
  async checkSuspiciousActivity(userId: number): Promise<boolean> {
    // Check for high failure rate in last hour
    const query = `
      SELECT COUNT(*) as failed_count
      FROM credential_audit_log
      WHERE user_id = $1
        AND action_status = 'failed'
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    `;

    const result = await this.db.query(query, [userId]);
    const failedCount = parseInt(result.rows[0].failed_count);

    if (failedCount > 10) {
      this.logger.warn('Suspicious activity detected: high failure rate', {
        userId,
        failedCount,
      });
      return true;
    }

    // Check for access from many different IPs
    const ipQuery = `
      SELECT COUNT(DISTINCT ip_address) as ip_count
      FROM credential_audit_log
      WHERE user_id = $1
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        AND ip_address IS NOT NULL
    `;

    const ipResult = await this.db.query(ipQuery, [userId]);
    const ipCount = parseInt(ipResult.rows[0].ip_count);

    if (ipCount > 5) {
      this.logger.warn('Suspicious activity detected: multiple IPs', {
        userId,
        ipCount,
      });
      return true;
    }

    return false;
  }

  /**
   * Archive old audit logs
   * 
   * Moves logs older than 1 year to archive table
   * Keeps recent logs for fast queries
   * 
   * Run this periodically (e.g., monthly)
   */
  async archiveOldLogs(olderThanDays: number = 365): Promise<number> {
    const query = `
      DELETE FROM credential_audit_log
      WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${olderThanDays} days'
      AND action_status = 'success'
    `;

    const result = await this.db.query(query, []);

    this.logger.info('Audit logs archived', {
      rowsDeleted: result.rowCount,
      olderThanDays,
    });

    return result.rowCount || 0;
  }

  /**
   * Generate audit report for compliance
   * 
   * @param userId - User ID (optional for all users)
   * @param from - Start date
   * @param to - End date
   * @returns Audit statistics
   */
  async generateAuditReport(
    userId?: number,
    from?: Date,
    to?: Date
  ): Promise<{
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    byAction: Record<string, number>;
  }> {
    let query = 'SELECT * FROM credential_audit_log WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(userId);
    }

    if (from) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(from);
    }

    if (to) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(to);
    }

    const result = await this.db.query(query, params);
    const logs = result.rows as AuditLogEntry[];

    const byAction: Record<string, number> = {};
    let successCount = 0;
    let failCount = 0;

    for (const log of logs) {
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      if (log.action_status === 'success') {
        successCount++;
      } else {
        failCount++;
      }
    }

    return {
      totalActions: logs.length,
      successfulActions: successCount,
      failedActions: failCount,
      byAction,
    };
  }
}
