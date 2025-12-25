/**
 * Schedule Routes
 *
 * Handles schedule management for automated sync jobs
 * Now supports per-user schedule configurations stored in the database
 *
 * @module routes/schedules
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { scheduler } from '../lib/scheduler.js';
import { etlQueue } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

const router = Router();

const VALID_SERVICES = ['meta', 'ga4', 'shopify'];

interface ScheduleConfig {
  id: number;
  service: string;
  cron: string;
  enabled: boolean;
  timezone: string;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
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
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      // Get schedules for the authenticated user from the database
      let userSchedules = [];
      try {
        userSchedules = await scheduler.getSchedulesForUser(userId);
      } catch (dbError) {
        // If the table doesn't exist or there's another database error,
        // return empty schedules but don't fail the request
        logger.warn('Failed to fetch schedules for user (may not exist yet)', {
          userId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
        // Continue with empty schedules array
      }

      // Convert database schedules to API response format
      const schedules: ScheduleConfig[] = userSchedules.map(dbSchedule => ({
        id: dbSchedule.id,
        service: dbSchedule.service,
        cron: dbSchedule.cron_expression,
        enabled: dbSchedule.enabled,
        timezone: dbSchedule.timezone,
        last_run_at: dbSchedule.last_run_at,
        next_run_at: dbSchedule.next_run_at,
        created_at: dbSchedule.created_at,
        updated_at: dbSchedule.updated_at,
      }));

      // Ensure each service has a schedule entry (create default if missing)
      for (const service of VALID_SERVICES) {
        if (!schedules.some(s => s.service === service)) {
          try {
            // Create a default schedule for this service
            const defaultSchedule = await scheduler.createSchedule(
              userId,
              service,
              config.cronSchedule || '0 2 * * *', // Default 2 AM daily
              false, // Default to disabled
              config.timezone || 'Asia/Kolkata' // Default to IST
            );

            schedules.push({
              id: defaultSchedule.id,
              service: defaultSchedule.service,
              cron: defaultSchedule.cron_expression,
              enabled: defaultSchedule.enabled,
              timezone: defaultSchedule.timezone,
              last_run_at: defaultSchedule.last_run_at,
              next_run_at: defaultSchedule.next_run_at,
              created_at: defaultSchedule.created_at,
              updated_at: defaultSchedule.updated_at,
            });
          } catch (createError) {
            logger.error('Failed to create default schedule for service', {
              userId,
              service,
              error: createError instanceof Error ? createError.message : String(createError),
            });
            // Add a default schedule object without database persistence for now
            schedules.push({
              id: 0, // Placeholder ID
              service,
              cron: config.cronSchedule || '0 2 * * *',
              enabled: false,
              timezone: config.timezone || 'Asia/Kolkata',
              last_run_at: null,
              next_run_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

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
      const { cron, enabled, timezone } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      if (!VALID_SERVICES.includes(service)) {
        res.status(400).json({
          success: false,
          error: `Invalid service: ${service}`,
        });
        return;
      }

      // Validate cron expression
      const cronParts = cron.split(' ');
      if (cronParts.length !== 5) {
        res.status(400).json({
          success: false,
          error: 'Invalid cron expression: must have 5 parts (minute, hour, day, month, weekday)',
        });
        return;
      }

      // Validate timezone if provided
      let validTimezone = config.timezone || 'Asia/Kolkata'; // Default
      if (timezone) {
        try {
          // Test if the provided timezone is valid
          new Intl.DateTimeFormat('en', { timeZone: timezone });
          validTimezone = timezone;
        } catch (tzError) {
          res.status(400).json({
            success: false,
            error: `Invalid timezone: ${timezone}`,
          });
          return;
        }
      }

      let updatedSchedule;

      try {
        // Check if a schedule already exists for this user and service
        const existingSchedules = await scheduler.getSchedulesForUser(userId);
        const existingSchedule = existingSchedules.find(s => s.service === service);

        if (existingSchedule) {
          // Update existing schedule
          await scheduler.updateSchedule(
            existingSchedule.id,
            userId,
            service,
            cron,
            enabled,
            validTimezone
          );

          // Get the updated schedule from the database
          const updatedSchedules = await scheduler.getSchedulesForUser(userId);
          updatedSchedule = updatedSchedules.find(s => s.service === service);
        } else {
          // Create new schedule
          updatedSchedule = await scheduler.createSchedule(
            userId,
            service,
            cron,
            enabled,
            validTimezone
          );
        }
      } catch (error) {
        logger.error('Failed to create or update schedule', {
          userId,
          service,
          error: error instanceof Error ? error.message : String(error),
        });

        res.status(500).json({
          success: false,
          error: 'Failed to create or update schedule',
        });
        return;
      }

      if (!updatedSchedule) {
        logger.error('Schedule not found after create/update operation', {
          userId,
          service,
        });

        res.status(500).json({
          success: false,
          error: 'Failed to create or update schedule',
        });
        return;
      }

      // Return the updated schedule
      res.json({
        success: true,
        data: {
          id: updatedSchedule.id,
          service: updatedSchedule.service,
          cron: updatedSchedule.cron_expression,
          enabled: updatedSchedule.enabled,
          timezone: updatedSchedule.timezone,
          last_run_at: updatedSchedule.last_run_at,
          next_run_at: updatedSchedule.next_run_at,
          created_at: updatedSchedule.created_at,
          updated_at: updatedSchedule.updated_at,
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
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      if (!VALID_SERVICES.includes(service)) {
        res.status(400).json({
          success: false,
          error: `Invalid service: ${service}`,
        });
        return;
      }

      // Enqueue the sync job for the specific user
      const job = await etlQueue.enqueueSync(service as 'meta' | 'ga4' | 'shopify', {
        userId: userId,
      });

      logger.info('Manual sync triggered for user', {
        userId,
        service,
        jobId: job.id,
      });

      res.json({
        success: true,
        message: `${service} sync job enqueued for user ${userId}`,
        data: {
          jobId: job.id,
          service,
          userId,
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
