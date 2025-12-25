/**
 * Job Scheduler
 * Handles cron-based job scheduling with support for both global and user-specific schedules
 *
 * @module lib/scheduler
 */

import cron from 'node-cron';
import { config } from '../config/index.js';
import { logger } from './logger.js';
import { etlQueue } from './queue.js';
import { enhancedScheduler } from './enhanced-scheduler.js';

/**
 * Scheduler class
 * Manages cron jobs for automated ETL runs
 *
 * Note: This class now acts as a facade that delegates to the enhanced scheduler
 * for user-specific scheduling, while maintaining backward compatibility
 */
class Scheduler {
  private isRunning = false;

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    try {
      // Start the enhanced scheduler which handles user-specific schedules
      await enhancedScheduler.start();
      this.isRunning = true;
      logger.info('Scheduler started with enhanced user-specific scheduling');
    } catch (error) {
      logger.error('Failed to start scheduler', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    // Stop the enhanced scheduler
    enhancedScheduler.stop();
    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning && enhancedScheduler.isActive();
  }

  /**
   * Get next scheduled run time (placeholder - actual next runs are tracked per user in DB)
   */
  getNextRun(): Date | null {
    // This method is kept for backward compatibility
    // Next run times are now tracked per user and service in the database
    return null;
  }

  /**
   * Manually trigger a sync run
   */
  async triggerNow(): Promise<void> {
    logger.info('Manual sync triggered - this will trigger all configured services for all users');

    // For backward compatibility, trigger all syncs for all users
    // In a production system, this might be implemented differently
    await etlQueue.enqueueAllSyncs();
  }

  /**
   * Manually trigger a sync for a specific user and service
   */
  async triggerUserSync(userId: number, service: 'meta' | 'ga4' | 'shopify'): Promise<void> {
    logger.info('Manual sync triggered for user and service', { userId, service });
    await enhancedScheduler.triggerNow(userId, service);
  }

  /**
   * Refresh schedules from database
   */
  async refreshSchedules(): Promise<void> {
    await enhancedScheduler.refreshSchedules();
  }

  /**
   * Update a specific schedule
   */
  async updateSchedule(scheduleId: number, userId: number, service: string, cronExpression: string, enabled: boolean, timezone: string): Promise<void> {
    await enhancedScheduler.updateSchedule(scheduleId, userId, service, cronExpression, enabled, timezone);
  }

  /**
   * Create a new schedule
   */
  async createSchedule(userId: number, service: string, cronExpression: string, enabled: boolean, timezone: string): Promise<any> {
    return await enhancedScheduler.createSchedule(userId, service, cronExpression, enabled, timezone);
  }

  /**
   * Get all schedules for a user
   */
  async getSchedulesForUser(userId: number): Promise<any[]> {
    return await enhancedScheduler.getSchedulesForUser(userId);
  }
}

// Export singleton instance
export const scheduler = new Scheduler();

export { Scheduler };
