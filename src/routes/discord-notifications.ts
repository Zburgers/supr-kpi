/**
 * Discord Notifications API Routes
 * 
 * @module routes/discord-notifications
 */

import express, { Request, Response } from 'express';
import { notifier } from '../lib/notifier.js';
import { logger } from '../lib/logger.js';
import { authenticateUser } from '../middleware/auth.js';

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notification sent to Discord successfully"
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Message is required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to send notification"
 */
router.post('/send', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const success = await notifier.sendDiscord(message);

    if (success) {
      logger.info('Discord notification sent successfully', {
        userId: req.auth?.userId,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : '') // Truncate long messages
      });

      res.json({
        success: true,
        message: 'Notification sent to Discord successfully'
      });
    } else {
      logger.error('Failed to send Discord notification', {
        userId: req.auth?.userId,
        error: 'Discord webhook failed'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to send notification to Discord'
      });
    }
  } catch (error) {
    logger.error('Error sending Discord notification', {
      userId: req.auth?.userId,
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
 *     description: Send a test notification to verify Discord webhook is working
 *     tags: [Discord Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Test notification sent successfully"
 *                 results:
 *                   type: object
 *                   properties:
 *                     discord:
 *                       type: boolean
 *                       example: true
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to send test notification"
 */
router.post('/test', authenticateUser, async (req: Request, res: Response) => {
  try {
    const discordMessage = `🧪 **Test Notification**\n\nKPI ETL Pipeline notification test.\nUser ID: ${req.auth?.userId}\nTime: ${new Date().toISOString()}`;
    
    const success = await notifier.sendDiscord(discordMessage);

    if (success) {
      logger.info('Discord test notification sent successfully', {
        userId: req.auth?.userId
      });

      res.json({
        success: true,
        message: 'Test notification sent successfully',
        results: {
          discord: true
        }
      });
    } else {
      logger.error('Failed to send Discord test notification', {
        userId: req.auth?.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to send test notification to Discord'
      });
    }
  } catch (error) {
    logger.error('Error sending Discord test notification', {
      userId: req.auth?.userId,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;