/**
 * Activity Log Routes
 *
 * Provides access to sync activity history and logs
 *
 * @module routes/activity-log
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { executeQuery } from '../lib/database.js';
import { logger } from '../lib/logger.js';

const router = Router();

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  service: string;
  action: string;
  status: 'success' | 'failure' | 'partial';
  record_count: number;
  duration: number; // seconds
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

interface ActivityLogFilters {
  service?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// GET /api/activity-log
// ============================================================================

router.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    try {
      const filters: ActivityLogFilters = {
        service: req.query.service as string,
        status: req.query.status as string,
        startDate: req.query.start_date as string,
        endDate: req.query.end_date as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      // Build query with filters
      const conditions: string[] = [];
      const params: (string | number)[] = [];
      let paramIndex = 1;

      if (filters.service) {
        conditions.push(`service = $${paramIndex++}`);
        params.push(filters.service);
      }

      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
      }

      if (filters.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
      const countResult = await executeQuery(countQuery, params, req.user!.userId);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      // Get paginated entries
      const limit = Math.min(filters.limit || 50, 100);
      const offset = filters.offset || 0;

      const dataQuery = `
        SELECT
          id::text,
          created_at as timestamp,
          service,
          action,
          status,
          NULL as record_count,
          NULL as duration_ms,
          error_message,
          metadata
        FROM audit_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;
      params.push(limit, offset);

      const dataResult = await executeQuery(dataQuery, params, req.user!.userId);

      const entries: ActivityLogEntry[] = dataResult.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp || new Date().toISOString(),
        service: row.service || 'unknown',
        action: row.action || 'sync',
        status: row.status || 'success',
        record_count: row.record_count || 0,
        duration: (row.duration_ms ? Math.floor(row.duration_ms / 1000) : 0), // Convert ms to seconds
        error_message: row.error_message || undefined,
        metadata: row.metadata || null,
      }));

      res.json({
        success: true,
        data: {
          entries,
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      // If table doesn't exist yet, return empty results
      if ((error as Error).message?.includes('audit_logs')) {
        res.json({
          success: true,
          data: {
            entries: [],
            total: 0,
            limit: 50,
            offset: 0,
          },
        });
        return;
      }

      logger.error('Failed to get activity log', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve activity log',
      });
    }
  }
);

export default router;
