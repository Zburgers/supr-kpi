/**
 * User Routes
 * 
 * Handles:
 * - User status (including onboarding)
 * - Onboarding completion updates
 */

import { Router, Request, Response } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { getUserStatus, updateOnboardingStatus } from '../lib/database.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/user/status
 * Get current user status including onboarding completion
 */
router.get('/status', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const status = await getUserStatus(req.user!.userId);

    if (!status) {
      res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: status.id,
        email: status.email,
        onboardingComplete: status.onboardingComplete,
      },
    });
  } catch (error) {
    logger.error('Failed to get user status', { error: String(error) });
    res.status(500).json({
      error: 'Failed to get user status',
      code: 'DATABASE_ERROR',
    });
  }
});

/**
 * POST /api/user/onboarding/complete
 * Mark user onboarding as complete
 */
router.post('/onboarding/complete', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const dbUserId = req.user!.userId;
    const clerkUserId = req.user!.clerkId;
    const success = await updateOnboardingStatus(dbUserId, true);

    if (!success) {
      res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Also reflect onboarding status in Clerk public metadata (backend-safe)
    try {
      await clerkClient.users.updateUserMetadata(clerkUserId, {
        publicMetadata: { onboardingComplete: true },
      });
    } catch (clerkError) {
      // Do not fail the request if Clerk update fails; log for awareness
      logger.warn('Failed to update Clerk metadata for onboarding completion', {
        userId: dbUserId,
        error: String(clerkError),
      });
    }

    logger.info('User completed onboarding', { userId: req.user!.userId });

    res.json({
      success: true,
      data: {
        onboardingComplete: true,
      },
    });
  } catch (error) {
    logger.error('Failed to update onboarding status', { error: String(error) });
    res.status(500).json({
      error: 'Failed to update onboarding status',
      code: 'DATABASE_ERROR',
    });
  }
});

/**
 * POST /api/user/onboarding/reset
 * Reset user onboarding (for testing/debugging)
 */
router.post('/onboarding/reset', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const dbUserId = req.user!.userId;
    const clerkUserId = req.user!.clerkId;
    const success = await updateOnboardingStatus(dbUserId, false);

    if (!success) {
      res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Keep Clerk metadata in sync (best-effort)
    try {
      await clerkClient.users.updateUserMetadata(clerkUserId, {
        publicMetadata: { onboardingComplete: false },
      });
    } catch (clerkError) {
      logger.warn('Failed to reset Clerk metadata for onboarding', {
        userId: dbUserId,
        error: String(clerkError),
      });
    }

    logger.info('User reset onboarding', { userId: req.user!.userId });

    res.json({
      success: true,
      data: {
        onboardingComplete: false,
      },
    });
  } catch (error) {
    logger.error('Failed to reset onboarding status', { error: String(error) });
    res.status(500).json({
      error: 'Failed to reset onboarding status',
      code: 'DATABASE_ERROR',
    });
  }
});

export default router;
