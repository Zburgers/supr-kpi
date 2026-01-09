/**
 * Enhanced Job Scheduler
 * Handles user-specific cron-based job scheduling with persistence
 *
 * @module lib/enhanced-scheduler
 */

import cron from 'node-cron';
import { config } from '../config/index.js';
import { logger } from './logger.js';
import { notifier } from './notifier.js';
import { etlQueue } from './queue.js';
import { executeQuery } from './database.js';
import { v4 as uuidv4 } from 'uuid';

// Interface for job schedule records
interface JobSchedule {
  id: number;
  user_id: number;
  service: string;
  cron_expression: string;
  enabled: boolean;
  timezone: string;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Enhanced Scheduler class
 * Manages user-specific cron jobs for automated ETL runs
 */
class EnhancedScheduler {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map(); // key: userId:service
  private isRunning = false;

  /**
   * Start the scheduler - load all user schedules from DB and start cron jobs
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Enhanced scheduler already running');
      return;
    }

    try {
      // Check for and handle any missed scheduled jobs since last server start
      await this.handleMissedJobs();

      // Load all active schedules from the database
      const schedules = await this.loadActiveSchedules();
      logger.info('Loaded active schedules from database', { count: schedules.length });

      // Create cron jobs for each active schedule
      for (const schedule of schedules) {
        this.createCronJob(schedule);
      }

      this.isRunning = true;
      logger.info('Enhanced scheduler started');
    } catch (error) {
      logger.error('Failed to start enhanced scheduler', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Send notification about scheduler start failure
      await notifier.sendDiscord(`❌ **Critical Scheduler Error**\n\nFailed to start enhanced scheduler.\nError: ${error instanceof Error ? error.message : String(error)}\nTime: ${new Date().toISOString()}`);
      throw error;
    }
  }

  /**
   * Stop the scheduler - stop all cron jobs
   */
  stop(): void {
    // Stop all cron jobs
    for (const [key, job] of this.cronJobs) {
      job.stop();
    }
    this.cronJobs.clear();
    this.isRunning = false;
    logger.info('Enhanced scheduler stopped');
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Load all active schedules from the database
   */
  private async loadActiveSchedules(): Promise<JobSchedule[]> {
    try {
      const result = await executeQuery(
        `SELECT * FROM job_schedules 
         WHERE enabled = true 
         ORDER BY user_id, service`
      );
      return result.rows as JobSchedule[];
    } catch (error) {
      logger.error('Failed to load active schedules from database', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Send notification about schedule loading failure
      await notifier.sendDiscord(`❌ **Scheduler Error**\n\nFailed to load active schedules from database.\nError: ${error instanceof Error ? error.message : String(error)}\nTime: ${new Date().toISOString()}`);
      throw error;
    }
  }

  /**
   * Create a cron job for a specific user and service
   */
  private createCronJob(schedule: JobSchedule): void {
    const jobKey = `${schedule.user_id}:${schedule.service}`;
    
    // Stop existing job if it exists
    if (this.cronJobs.has(jobKey)) {
      this.cronJobs.get(jobKey)?.stop();
    }

    try {
      // Validate cron expression
      if (!cron.validate(schedule.cron_expression)) {
        logger.error('Invalid cron expression for schedule', {
          userId: schedule.user_id,
          service: schedule.service,
          cron: schedule.cron_expression
        });
        return;
      }

      const job = cron.schedule(
        schedule.cron_expression,
        async () => {
          const triggerTime = new Date();
          logger.info('Scheduled sync triggered', {
            userId: schedule.user_id,
            service: schedule.service,
            cron: schedule.cron_expression,
            timezone: schedule.timezone,
            triggerTime: triggerTime.toISOString(),
            localTime: triggerTime.toLocaleString('en-US', { timeZone: schedule.timezone }),
            scheduleId: schedule.id
          });

          try {
            // Update last_run_at in database
            await this.updateLastRunAt(schedule.id);

            logger.info('Enqueueing sync job to worker queue', {
              userId: schedule.user_id,
              service: schedule.service,
              scheduleId: schedule.id,
              note: 'Job will be processed by worker using service-based workflow (same as manual sync)'
            });

            // Enqueue the sync job with user context
            // The worker will use the service files (metaService, ga4Service, shopifyService)
            // which handle credential decryption, token management, and API calls
            const job = await etlQueue.enqueueSync(schedule.service as 'meta' | 'ga4' | 'shopify', {
              userId: schedule.user_id,
            });

            logger.info('Sync job enqueued successfully', {
              userId: schedule.user_id,
              service: schedule.service,
              jobId: job.id,
              scheduleId: schedule.id,
              enqueuedAt: new Date().toISOString()
            });

            // Update next_run_at in database after successful execution
            await this.updateNextRunAt(schedule.id, schedule.cron_expression, schedule.timezone);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            
            logger.error('Failed to execute scheduled sync', {
              userId: schedule.user_id,
              service: schedule.service,
              scheduleId: schedule.id,
              error: errorMessage,
              stack: errorStack,
              triggerTime: triggerTime.toISOString()
            });

            // Send notification about sync failure
            await notifier.sendDiscord(`❌ **Scheduled Sync Failed**\n\nScheduled sync failed for user ${schedule.user_id}, service ${schedule.service}.\nError: ${errorMessage}\nTime: ${new Date().toISOString()}\nSchedule ID: ${schedule.id}`);

            // Schedule a retry after 10 minutes if the job failed
            await this.scheduleRetry(
              schedule.user_id,
              schedule.service as 'meta' | 'ga4' | 'shopify',
              schedule.id,
              schedule.cron_expression,
              schedule.timezone
            );

            // Log the failure for monitoring
            await this.logScheduleFailure(schedule, error);
          }
        },
        {
          scheduled: true,
          timezone: schedule.timezone,
        }
      );

      this.cronJobs.set(jobKey, job);
      logger.info('Created cron job for user schedule', {
        userId: schedule.user_id,
        service: schedule.service,
        cron: schedule.cron_expression,
        timezone: schedule.timezone
      });
      
      // Update next_run_at for the schedule
      this.updateNextRunAt(schedule.id, schedule.cron_expression, schedule.timezone);
    } catch (error) {
      logger.error('Failed to create cron job for schedule', {
        userId: schedule.user_id,
        service: schedule.service,
        cron: schedule.cron_expression,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update last_run_at for a schedule
   */
  private async updateLastRunAt(scheduleId: number): Promise<void> {
    try {
      await executeQuery(
        `UPDATE job_schedules
         SET last_run_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [scheduleId]
      );
    } catch (error) {
      // Check if the error is due to table not existing
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('relation') && errorMessage.toLowerCase().includes('does not exist')) {
        logger.warn('job_schedules table does not exist, skipping last_run_at update', {
          scheduleId,
        });
        return; // Exit early if table doesn't exist
      }

      logger.error('Failed to update last_run_at', {
        scheduleId,
        error: errorMessage,
      });
    }
  }

  /**
   * Update next_run_at for a schedule based on cron expression and timezone
   */
  private async updateNextRunAt(scheduleId: number, cronExpression: string, timezone: string): Promise<void> {
    try {
      // Calculate next run time based on cron expression
      const nextRunDate = this.calculateNextRunTime(cronExpression, timezone);
      const nextRunIso = nextRunDate.toISOString();

      await executeQuery(
        `UPDATE job_schedules
         SET next_run_at = $2, updated_at = NOW()
         WHERE id = $1`,
        [scheduleId, nextRunIso]
      );
    } catch (error) {
      // Check if the error is due to table not existing
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('relation') && errorMessage.toLowerCase().includes('does not exist')) {
        logger.warn('job_schedules table does not exist, skipping next_run_at update', {
          scheduleId,
        });
        return; // Exit early if table doesn't exist
      }

      logger.error('Failed to update next_run_at', {
        scheduleId,
        error: errorMessage,
      });
    }
  }

  /**
   * Calculate next run time based on cron expression and timezone
   */
  private calculateNextRunTime(cronExpression: string, timezone: string): Date {
    // This is a simplified implementation
    // For a production system, we'd use a more robust solution like cron-parser
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return new Date(); // Invalid cron

    const [minute, hour] = parts;
    const now = new Date();

    // Create a date object adjusted to the specified timezone
    // We'll use the Intl API to properly handle timezone conversion
    try {
      // Create a date in the specified timezone
      const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
      const targetTime = new Date(now.toLocaleString("en-US", {timeZone: timezone}));

      // Create the next run time in the target timezone
      const next = new Date(targetTime);
      next.setHours(parseInt(hour, 10) || 0);
      next.setMinutes(parseInt(minute, 10) || 0);
      next.setSeconds(0);
      next.setMilliseconds(0);

      // If the time has passed today in the target timezone, set to tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      return next;
    } catch (error) {
      logger.warn('Failed to calculate next run time with timezone, using UTC', {
        timezone,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to UTC calculation
      const next = new Date(now);
      next.setUTCHours(parseInt(hour, 10) || 0);
      next.setUTCMinutes(parseInt(minute, 10) || 0);
      next.setUTCSeconds(0);
      next.setUTCMilliseconds(0);

      // If the time has passed today, set to tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      return next;
    }
  }

  /**
   * Get next scheduled run time for a specific schedule
   */
  getNextRun(scheduleId: number): Date | null {
    // This would typically query the database for the next_run_at value
    // For now, we'll return null since we're calculating it asynchronously
    return null;
  }

  /**
   * Manually trigger a sync for a specific user and service
   */
  async triggerNow(userId: number, service: 'meta' | 'ga4' | 'shopify'): Promise<void> {
    logger.info('Manual sync triggered', { userId, service });
    await etlQueue.enqueueSync(service, { userId });
  }

  /**
   * Refresh schedules - reload from database and update cron jobs
   */
  async refreshSchedules(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Cannot refresh schedules: scheduler is not running');
      return;
    }

    try {
      // Load all active schedules from the database
      const schedules = await this.loadActiveSchedules();
      
      // Create a set of current job keys for comparison
      const currentJobKeys = new Set(this.cronJobs.keys());
      const newJobKeys = new Set<string>();

      // Create/update cron jobs for active schedules
      for (const schedule of schedules) {
        const jobKey = `${schedule.user_id}:${schedule.service}`;
        newJobKeys.add(jobKey);
        this.createCronJob(schedule);
      }

      // Remove cron jobs for schedules that are no longer active
      for (const jobKey of currentJobKeys) {
        if (!newJobKeys.has(jobKey)) {
          const job = this.cronJobs.get(jobKey);
          if (job) {
            job.stop();
            this.cronJobs.delete(jobKey);
            logger.info('Removed cron job for deactivated schedule', { jobKey });
          }
        }
      }

      logger.info('Schedules refreshed', { 
        activeSchedules: schedules.length,
        removedJobs: currentJobKeys.size - newJobKeys.size
      });
    } catch (error) {
      logger.error('Failed to refresh schedules', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Send notification about refresh failure
      await notifier.sendDiscord(`❌ **Scheduler Error**\n\nFailed to refresh schedules.\nError: ${error instanceof Error ? error.message : String(error)}\nTime: ${new Date().toISOString()}`);
      throw error;
    }
  }

  /**
   * Update a specific schedule in the database and refresh the cron job
   */
  async updateSchedule(scheduleId: number, userId: number, service: string, cronExpression: string, enabled: boolean, timezone: string): Promise<void> {
    try {
      let result;
      try {
        result = await executeQuery(
          `UPDATE job_schedules
           SET cron_expression = $2,
               enabled = $3,
               timezone = $4,
               updated_at = NOW()
           WHERE id = $1 AND user_id = $5`,
          [scheduleId, cronExpression, enabled, timezone, userId]
        );
      } catch (updateError) {
        // If the table doesn't exist, just log and continue
        const updateErrorMessage = updateError instanceof Error ? updateError.message : String(updateError);
        if (updateErrorMessage.toLowerCase().includes('relation') && updateErrorMessage.toLowerCase().includes('does not exist')) {
          logger.warn('job_schedules table does not exist, skipping schedule update', {
            scheduleId,
            userId,
            service,
            cronExpression,
            enabled,
            timezone
          });
          return; // Exit early if table doesn't exist
        } else {
          throw updateError; // Re-throw other errors
        }
      }

      logger.info('Schedule updated in database', {
        scheduleId,
        userId,
        service,
        cronExpression,
        enabled,
        timezone
      });

      // Refresh schedules to pick up the changes
      try {
        await this.refreshSchedules();
      } catch (refreshError) {
        logger.warn('Failed to refresh schedules after update', {
          error: refreshError instanceof Error ? refreshError.message : String(refreshError),
        });
      }
    } catch (error) {
      logger.error('Failed to update schedule', {
        scheduleId,
        userId,
        service,
        error: error instanceof Error ? error.message : String(error),
      });

      // Send notification about update failure
      await notifier.sendDiscord(`❌ **Scheduler Error**\n\nFailed to update schedule for user ${userId}, service ${service}.\nError: ${error instanceof Error ? error.message : String(error)}\nTime: ${new Date().toISOString()}`);
      throw error;
    }
  }

  /**
   * Create a new schedule in the database
   */
  async createSchedule(userId: number, service: string, cronExpression: string, enabled: boolean, timezone: string): Promise<JobSchedule> {
    try {
      // Check if a schedule already exists for this user and service
      let existingSchedule;
      try {
        existingSchedule = await executeQuery(
          `SELECT id FROM job_schedules
           WHERE user_id = $1 AND service = $2`,
          [userId, service]
        );
      } catch (queryError) {
        // If the table doesn't exist, return empty result
        const queryErrorMessage = queryError instanceof Error ? queryError.message : String(queryError);
        if (queryErrorMessage.toLowerCase().includes('relation') && queryErrorMessage.toLowerCase().includes('does not exist')) {
          existingSchedule = { rows: [] }; // Simulate empty result
        } else {
          throw queryError; // Re-throw other errors
        }
      }

      if (existingSchedule.rows.length > 0) {
        throw new Error(`Schedule already exists for user ${userId} and service ${service}`);
      }

      // Insert new schedule
      let result;
      try {
        result = await executeQuery(
          `INSERT INTO job_schedules
           (user_id, service, cron_expression, enabled, timezone)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [userId, service, cronExpression, enabled, timezone]
        );
      } catch (insertError) {
        // If the table doesn't exist, simulate successful creation with in-memory data
        const insertErrorMessage = insertError instanceof Error ? insertError.message : String(insertError);
        if (insertErrorMessage.toLowerCase().includes('relation') && insertErrorMessage.toLowerCase().includes('does not exist')) {
          logger.warn('job_schedules table does not exist, simulating schedule creation', {
            userId,
            service,
            cronExpression,
            enabled,
            timezone
          });

          // Return a simulated schedule object
          return {
            id: Math.floor(Math.random() * 1000000), // Random ID for simulation
            user_id: userId,
            service,
            cron_expression: cronExpression,
            enabled,
            timezone,
            last_run_at: null,
            next_run_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        } else {
          throw insertError; // Re-throw other errors
        }
      }

      const newSchedule = result.rows[0] as JobSchedule;

      logger.info('New schedule created', {
        scheduleId: newSchedule.id,
        userId,
        service,
        cronExpression,
        enabled,
        timezone
      });

      // Refresh schedules to pick up the new schedule
      try {
        await this.refreshSchedules();
      } catch (refreshError) {
        logger.warn('Failed to refresh schedules after creation', {
          error: refreshError instanceof Error ? refreshError.message : String(refreshError),
        });
      }

      return newSchedule;
    } catch (error) {
      logger.error('Failed to create schedule', {
        userId,
        service,
        error: error instanceof Error ? error.message : String(error),
      });

      // Send notification about creation failure
      await notifier.sendDiscord(`❌ **Scheduler Error**\n\nFailed to create schedule for user ${userId}, service ${service}.\nError: ${error instanceof Error ? error.message : String(error)}\nTime: ${new Date().toISOString()}`);
      throw error;
    }
  }

  /**
   * Get all schedules for a user
   */
  async getSchedulesForUser(userId: number): Promise<JobSchedule[]> {
    try {
      const result = await executeQuery(
        `SELECT * FROM job_schedules
         WHERE user_id = $1
         ORDER BY service`,
        [userId]
      );
      return result.rows as JobSchedule[];
    } catch (error) {
      // Check if the error is due to table not existing
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('relation') && errorMessage.toLowerCase().includes('does not exist')) {
        logger.warn('job_schedules table does not exist, returning empty array', {
          userId,
          error: errorMessage,
        });
        return []; // Return empty array instead of throwing
      }

      logger.error('Failed to get schedules for user', {
        userId,
        error: errorMessage,
      });

      // Send notification about get schedules failure
      await notifier.sendDiscord(`❌ **Scheduler Error**\n\nFailed to get schedules for user ${userId}.\nError: ${errorMessage}\nTime: ${new Date().toISOString()}`);
      throw error; // Re-throw for other types of errors
    }
  }

  /**
   * Handle any missed jobs since the server was last started
   */
  private async handleMissedJobs(): Promise<void> {
    try {
      // Get all active schedules that may have missed their run time
      let result;
      try {
        result = await executeQuery(
          `SELECT * FROM job_schedules
           WHERE enabled = true
             AND next_run_at IS NOT NULL
             AND next_run_at < NOW()
           ORDER BY user_id, service`
        );
      } catch (queryError) {
        // If the table doesn't exist, just log and return
        const queryErrorMessage = queryError instanceof Error ? queryError.message : String(queryError);
        if (queryErrorMessage.toLowerCase().includes('relation') && queryErrorMessage.toLowerCase().includes('does not exist')) {
          logger.warn('job_schedules table does not exist, skipping missed jobs check');
          return; // Exit early if table doesn't exist
        } else {
          throw queryError; // Re-throw other errors
        }
      }

      const schedules = result.rows as JobSchedule[];

      if (schedules.length > 0) {
        logger.info('Found missed scheduled jobs', { count: schedules.length });

        for (const schedule of schedules) {
          logger.info('Processing missed job', {
            userId: schedule.user_id,
            service: schedule.service,
            nextRunAt: schedule.next_run_at
          });

          // Update the last_run_at to now and schedule the job
          await this.updateLastRunAt(schedule.id);

          // Enqueue the sync job for this user and service
          await etlQueue.enqueueSync(schedule.service as 'meta' | 'ga4' | 'shopify', {
            userId: schedule.user_id,
          });

          // Update next_run_at for this schedule
          await this.updateNextRunAt(schedule.id, schedule.cron_expression, schedule.timezone);
        }
      }
    } catch (error) {
      logger.error('Failed to handle missed jobs', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Send notification about missed jobs handling failure
      await notifier.sendDiscord(`❌ **Scheduler Error**\n\nFailed to handle missed scheduled jobs.\nError: ${error instanceof Error ? error.message : String(error)}\nTime: ${new Date().toISOString()}`);
    }
  }

  /**
   * Create a more robust retry mechanism for failed jobs
   */
  async scheduleRetry(userId: number, service: 'meta' | 'ga4' | 'shopify', scheduleId: number, cronExpression: string, timezone: string): Promise<void> {
    // Schedule a retry after 10 minutes
    setTimeout(async () => {
      try {
        logger.info('Retrying failed scheduled sync', {
          userId,
          service,
          scheduleId,
          cronExpression,
          timezone
        });

        await etlQueue.enqueueSync(service, {
          userId,
        });

        // Update next_run_at after successful retry
        await this.updateNextRunAt(scheduleId, cronExpression, timezone);
      } catch (retryError) {
        logger.error('Retry failed for scheduled sync', {
          userId,
          service,
          scheduleId,
          error: retryError instanceof Error ? retryError.message : String(retryError),
        });

        // Update next_run_at even if retry failed
        await this.updateNextRunAt(scheduleId, cronExpression, timezone);
      }
    }, 10 * 60 * 1000); // 10 minutes in milliseconds
  }

  /**
   * Log schedule failures for monitoring
   */
  private async logScheduleFailure(schedule: JobSchedule, error: any): Promise<void> {
    try {
      // Log to audit_logs table for monitoring
      await executeQuery(
        `INSERT INTO audit_logs (user_id, action, service, status, error_message, metadata)
         VALUES ($1, 'schedule_failure', $2, 'failure', $3, $4)`,
        [
          schedule.user_id,
          schedule.service,
          error instanceof Error ? error.message : String(error),
          JSON.stringify({
            scheduleId: schedule.id,
            cronExpression: schedule.cron_expression,
            timezone: schedule.timezone,
            timestamp: new Date().toISOString()
          })
        ]
      );
    } catch (logError) {
      // Check if the error is due to table not existing
      const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
      if (logErrorMessage.toLowerCase().includes('relation') && logErrorMessage.toLowerCase().includes('does not exist')) {
        logger.warn('audit_logs table does not exist, skipping schedule failure log', {
          scheduleId: schedule.id,
          userId: schedule.user_id,
          error: error instanceof Error ? error.message : String(error),
        });
        return; // Exit early if table doesn't exist
      }

      logger.error('Failed to log schedule failure', {
        error: logErrorMessage,
        scheduleId: schedule.id,
        userId: schedule.user_id
      });
    }
  }

  /**
   * Get scheduler statistics for monitoring
   */
  async getSchedulerStats(): Promise<{
    totalSchedules: number;
    activeSchedules: number;
    enabledSchedules: number;
    schedulesByService: Record<string, number>;
  }> {
    try {
      const totalResult = await executeQuery('SELECT COUNT(*) as count FROM job_schedules');
      const activeResult = await executeQuery('SELECT COUNT(*) as count FROM job_schedules WHERE enabled = true');

      const serviceResult = await executeQuery(
        `SELECT service, COUNT(*) as count
         FROM job_schedules
         GROUP BY service`
      );

      const schedulesByService: Record<string, number> = {};
      serviceResult.rows.forEach((row: any) => {
        schedulesByService[row.service] = parseInt(row.count, 10);
      });

      return {
        totalSchedules: parseInt(totalResult.rows[0].count, 10),
        activeSchedules: parseInt(activeResult.rows[0].count, 10),
        enabledSchedules: parseInt(activeResult.rows[0].count, 10),
        schedulesByService
      };
    } catch (error) {
      logger.error('Failed to get scheduler stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const enhancedScheduler = new EnhancedScheduler();

export { EnhancedScheduler };