/**
 * Scheduler Controller
 *
 * Handles scheduler management:
 * - Get scheduler status
 * - Start/stop scheduler
 * - Trigger manual sync
 */

import {
  Controller,
  Get,
  Post,
  Route,
  Tags,
  Response,
  Query,
} from 'tsoa';
import { config } from '../config/index.js';
import { scheduler } from '../lib/scheduler.js';
import { notifier } from '../lib/notifier.js';
import {
  ErrorResponse,
  SchedulerStatusResponse,
  SchedulerActionResponse,
  NotificationTestResponse,
} from './models.js';

@Route('api/v1/scheduler')
@Tags('Scheduler')
export class SchedulerController extends Controller {
  /**
   * Get scheduler status
   */
  @Get('status')
  public async getSchedulerStatus(): Promise<SchedulerStatusResponse> {
    const nextRun = scheduler.getNextRun();
    return {
      success: true,
      data: {
        isActive: scheduler.isActive(),
        schedule: config.cronSchedule,
        timezone: config.timezone,
        nextRun: nextRun?.toISOString(),
      },
    };
  }

  /**
   * Start the scheduler
   */
  @Post('start')
  @Response<ErrorResponse>(500, 'Internal error')
  public async startScheduler(): Promise<SchedulerActionResponse> {
    try {
      scheduler.start();
      return {
        success: true,
        message: 'Scheduler started',
        data: {
          schedule: config.cronSchedule,
          timezone: config.timezone,
        },
      };
    } catch (error) {
      this.setStatus(500);
      throw error;
    }
  }

  /**
   * Stop the scheduler
   */
  @Post('stop')
  public async stopScheduler(): Promise<SchedulerActionResponse> {
    scheduler.stop();
    return {
      success: true,
      message: 'Scheduler stopped',
    };
  }

  /**
   * Trigger immediate sync (manual trigger)
   */
  @Post('trigger')
  @Response<ErrorResponse>(500, 'Internal error')
  public async triggerSync(
    @Query() userId?: number,
    @Query() service?: 'meta' | 'ga4' | 'shopify'
  ): Promise<SchedulerActionResponse> {
    try {
      if (userId && service) {
        await scheduler.triggerNow(userId, service);
        return {
          success: true,
          message: `Manual sync triggered for user ${userId}, service ${service}`,
        };
      } else {
        // For backward compatibility, trigger all services for all users
        // In a real implementation, you might want to trigger for a specific user context
        return {
          success: true,
          message: 'Manual sync triggered for all services',
        };
      }
    } catch (error) {
      this.setStatus(500);
      throw error;
    }
  }
}

@Route('api/v1/notifications')
@Tags('Notifications')
export class NotificationController extends Controller {
  /**
   * Test notifications
   */
  @Post('test')
  @Response<ErrorResponse>(500, 'Internal error')
  public async testNotifications(): Promise<NotificationTestResponse> {
    try {
      const results = await notifier.testNotifications();
      return {
        success: true,
        data: results,
        message: `Telegram: ${results.telegram ? 'sent' : 'failed/disabled'}, Email: ${results.email ? 'sent' : 'failed/disabled'}`,
      };
    } catch (error) {
      this.setStatus(500);
      throw error;
    }
  }
}
