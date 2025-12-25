/**
 * Discord Notifications API Routes
 * 
 * Provides endpoints for sending Discord webhook notifications
 * Used for observability and alerting
 * 
 * @module routes/discord-notifications
 */

import express, { Request, Response } from 'express';
import { notifier } from '../lib/notifier.js';
import { logger } from '../lib/logger.js';
import { authenticate, requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/discord/send:
 *   post:
 *     summary: Send a notification to Discord
 *     description: Send a custom notification message to the configured Discord webhook
 *     tags: [Discord Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: The message to send to Discord
 *                 example: "Sync completed successfully"
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       400:
 *         description: Bad request - missing required fields
 *       500:
 *         description: Internal server error
 */
router.post('/send', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const { message } = req.body;

    if (!message) {
      res.status(400).json({
        success: false,
        error: 'Message is required'
      });
      return;
    }

    const success = await notifier.sendDiscord(message);

    if (success) {
      logger.info('Discord notification sent successfully', {
        userId: req.user?.userId,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
      });

      res.json({
        success: true,
        message: 'Notification sent to Discord successfully'
      });
    } else {
      logger.error('Failed to send Discord notification');
      res.status(500).json({
        success: false,
        error: 'Failed to send notification to Discord'
      });
    }
  } catch (error) {
    logger.error('Error sending Discord notification', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/discord/test:
 *   post:
 *     summary: Test Discord notification
 *     description: Send a test notification to verify Discord webhook is configured correctly
 *     tags: [Discord Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Optional custom test message
 *     responses:
 *       200:
 *         description: Test notification sent
 *       500:
 *         description: Failed to send test notification
 */
router.post('/test', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const customMessage = req.body?.message;
    const message = customMessage || `🧪 **Test Notification**\n\nKPI ETL Pipeline notification test.\nUser: ${req.user?.userId || 'unknown'}\nTime: ${new Date().toISOString()}`;

    const success = await notifier.sendDiscord(message);

    if (success) {
      logger.info('Discord test notification sent successfully', {
        userId: req.user?.userId
      });

      res.json({
        success: true,
        message: 'Test notification sent successfully',
        data: { discord: true }
      });
    } else {
      logger.error('Failed to send Discord test notification');
      res.status(500).json({
        success: false,
        error: 'Failed to send test notification to Discord',
        data: { discord: false }
      });
    }
  } catch (error) {
    logger.error('Error sending Discord test notification', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
