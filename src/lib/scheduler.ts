/**
 * Job Scheduler
 * Handles cron-based job scheduling
 *
 * @module lib/scheduler
 */

import cron from 'node-cron';
import { config } from '../config/index.js';
import { logger } from './logger.js';
import { etlQueue } from './queue.js';

/**
 * Scheduler class
 * Manages cron jobs for automated ETL runs
 */
class Scheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    const schedule = config.cronSchedule;
    const timezone = config.timezone;

    if (!cron.validate(schedule)) {
      logger.error('Invalid cron schedule', { schedule });
      throw new Error(`Invalid cron schedule: ${schedule}`);
    }

    this.cronJob = cron.schedule(
      schedule,
      async () => {
        logger.info('Scheduled sync triggered', { schedule, timezone });
        try {
          await etlQueue.enqueueAllSyncs();
        } catch (error) {
          logger.error('Failed to enqueue scheduled syncs', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      {
        scheduled: true,
        timezone,
      }
    );

    this.isRunning = true;
    logger.info('Scheduler started', { schedule, timezone });
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get next scheduled run time
   */
  getNextRun(): Date | null {
    if (!this.isRunning) return null;

    // Parse cron and calculate next run
    // This is a simplified implementation
    const parts = config.cronSchedule.split(' ');
    if (parts.length !== 5) return null;

    const [minute, hour] = parts;
    const now = new Date();
    const next = new Date(now);

    next.setHours(parseInt(hour, 10) || 0);
    next.setMinutes(parseInt(minute, 10) || 0);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // If time has passed today, move to tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * Manually trigger a sync run
   */
  async triggerNow(): Promise<void> {
    logger.info('Manual sync triggered');
    await etlQueue.enqueueAllSyncs();
  }
}

// Export singleton instance
export const scheduler = new Scheduler();

export { Scheduler };
