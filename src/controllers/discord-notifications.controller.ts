/**
 * Discord Notifications Controller
 * 
 * @module controllers/discord-notifications
 */

import { Controller, Post, Route, Body, Security, Response } from 'tsoa';
import { notifier } from '../lib/notifier.js';
import { logger } from '../lib/logger.js';

interface DiscordNotificationRequest {
  message: string;
}

interface DiscordTestRequest {
  message?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

@Route('/discord')
export class DiscordNotificationsController extends Controller {
  /**
   * Send a notification to Discord
   */
  @Post('/send')
  @Security('bearerAuth')
  @Response(400, 'Bad Request')
  @Response(500, 'Internal Server Error')
  public async sendNotification(
    @Body() requestBody: DiscordNotificationRequest
  ): Promise<ApiResponse> {
    try {
      const { message } = requestBody;

      if (!message) {
        return {
          success: false,
          error: 'Message is required'
        };
      }

      const success = await notifier.sendDiscord(message);

      if (success) {
        logger.info('Discord notification sent successfully', {
          message: message.substring(0, 100) + (message.length > 100 ? '...' : '') // Truncate long messages
        });

        return {
          success: true,
          message: 'Notification sent to Discord successfully'
        };
      } else {
        logger.error('Failed to send Discord notification');

        return {
          success: false,
          error: 'Failed to send notification to Discord'
        };
      }
    } catch (error) {
      logger.error('Error sending Discord notification', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Test Discord notification
   */
  @Post('/test')
  @Security('bearerAuth')
  @Response(500, 'Internal Server Error')
  public async testNotification(
    @Body() requestBody?: DiscordTestRequest
  ): Promise<ApiResponse<{ discord: boolean }>> {
    try {
      const message = requestBody?.message || `🧪 **Test Notification**\n\nKPI ETL Pipeline notification test.\nTime: ${new Date().toISOString()}`;
      
      const success = await notifier.sendDiscord(message);

      if (success) {
        logger.info('Discord test notification sent successfully');

        return {
          success: true,
          message: 'Test notification sent successfully',
          data: {
            discord: true
          }
        };
      } else {
        logger.error('Failed to send Discord test notification');

        return {
          success: false,
          error: 'Failed to send test notification to Discord',
          data: {
            discord: false
          }
        };
      }
    } catch (error) {
      logger.error('Error sending Discord test notification', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }
}