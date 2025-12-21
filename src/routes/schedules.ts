/**
 * Schedule Routes
 * 
 * Handles schedule management for automated sync jobs
 * 
 * Note: Current implementation is a facade over the global scheduler.
 * Future versions will support per-user schedule configurations.
 * 
 * @module routes/schedules
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { executeQuery } from '../lib/database.js';
import { scheduler } from '../lib/scheduler.js';
import { etlQueue } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

const router = Router();

const VALID_SERVICES = ['meta', 'ga4', 'shopify'];

interface ScheduleConfig {
  service: string;
  cron: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

// ============================================================================
// GET /api/schedules
// ============================================================================

router.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    try {
      // For now, return a global schedule config for all services
      // Future: support per-service schedules stored in DB
      const globalCron = config.cronSchedule || '0 6 * * *'; // Default 6 AM
      const isActive = scheduler.isActive();
      const nextRun = scheduler.getNextRun();

      const schedules: ScheduleConfig[] = VALID_SERVICES.map(service => ({
        service,
        cron: globalCron,
        enabled: isActive,
        last_run_at: null, // TODO: Track per-service last run
        next_run_at: nextRun?.toISOString() || null,
      }));

      res.json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      logger.error('Failed to get schedules', { 
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve schedules',
      });
    }
  }
);

// ============================================================================
// PUT /api/schedules/:service
// ============================================================================

router.put(
  '/:service',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    try {
      const { service } = req.params;
      const { cron, enabled } = req.body;

      if (!VALID_SERVICES.includes(service)) {
        res.status(400).json({
          success: false,
          error: `Invalid service: ${service}`,
        });
        return;
      }

      // Note: Current implementation cannot change cron per-service
      // This endpoint is a placeholder for future per-user schedule storage
      
      // Toggle scheduler based on enabled flag
      if (enabled === false && scheduler.isActive()) {
        // Don't actually stop scheduler for all users - this is a limitation
        logger.warn('Schedule disable requested but global scheduler cannot be stopped per-user', {
          userId: req.user?.userId,
          service,
        });
      }

      const globalCron = config.cronSchedule || '0 6 * * *';
      const isActive = scheduler.isActive();
      const nextRun = scheduler.getNextRun();

      res.json({
        success: true,
        data: {
          service,
          cron: globalCron,
          enabled: isActive,
          last_run_at: null,
          next_run_at: nextRun?.toISOString() || null,
        },
      });
    } catch (error) {
      logger.error('Failed to update schedule', { 
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to update schedule',
      });
    }
  }
);

// ============================================================================
// POST /api/schedules/:service/run
// ============================================================================

router.post(
  '/:service/run',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    try {
      const { service } = req.params;

      if (!VALID_SERVICES.includes(service)) {
        res.status(400).json({
          success: false,
          error: `Invalid service: ${service}`,
        });
        return;
      }

      // Enqueue the sync job
      const job = await etlQueue.enqueueSync(service as 'meta' | 'ga4' | 'shopify', {});

      logger.info('Manual sync triggered', {
        userId: req.user?.userId,
        service,
        jobId: job.id,
      });

      res.json({
        success: true,
        message: `${service} sync job enqueued`,
        data: {
          jobId: job.id,
          service,
        },
      });
    } catch (error) {
      logger.error('Failed to trigger sync', { 
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to trigger sync',
      });
    }
  }
);

export default router;
