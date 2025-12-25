/**
 * User Controller
 * 
 * Handles user management and onboarding:
 * - Get user status
 * - Complete/reset onboarding
 */

import {
  Controller,
  Get,
  Post,
  Route,
  Tags,
  Security,
  Response,
  Request,
} from 'tsoa';
import * as express from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { getUserStatus, updateOnboardingStatus } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { AuthenticatedUser } from '../authentication.js';
import { ErrorResponse, UserStatusResponse, OnboardingResponse } from './models.js';

@Route('api/user')
@Tags('User')
export class UserController extends Controller {
  /**
   * Get current user status including onboarding completion
   */
  @Get('status')
  @Security('jwt')
  @Response<ErrorResponse>(404, 'User not found')
  @Response<ErrorResponse>(500, 'Internal error')
  public async getUserStatus(
    @Request() request: express.Request
  ): Promise<{ success: boolean; data: UserStatusResponse }> {
    const user = request.user as AuthenticatedUser;

    const status = await getUserStatus(user.userId);

    if (!status) {
      this.setStatus(404);
      throw new Error('User not found');
    }

    return {
      success: true,
      data: {
        id: status.id,
        email: status.email,
        onboardingComplete: status.onboardingComplete,
      },
    };
  }

  /**
   * Mark user onboarding as complete
   */
  @Post('onboarding/complete')
  @Security('jwt')
  @Response<ErrorResponse>(404, 'User not found')
  @Response<ErrorResponse>(500, 'Internal error')
  public async completeOnboarding(
    @Request() request: express.Request
  ): Promise<{ success: boolean; data: OnboardingResponse }> {
    const user = request.user as AuthenticatedUser;

    const success = await updateOnboardingStatus(user.userId, true);

    if (!success) {
      this.setStatus(404);
      throw new Error('User not found');
    }

    // Also reflect onboarding status in Clerk public metadata
    try {
      await clerkClient.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { onboardingComplete: true },
      });
    } catch (clerkError) {
      logger.warn('Failed to update Clerk metadata for onboarding completion', {
        userId: user.userId,
        error: String(clerkError),
      });
    }

    logger.info('User completed onboarding', { userId: user.userId });

    return {
      success: true,
      data: { onboardingComplete: true },
    };
  }

  /**
   * Reset user onboarding (for testing/debugging)
   */
  @Post('onboarding/reset')
  @Security('jwt')
  @Response<ErrorResponse>(404, 'User not found')
  @Response<ErrorResponse>(500, 'Internal error')
  public async resetOnboarding(
    @Request() request: express.Request
  ): Promise<{ success: boolean; data: OnboardingResponse }> {
    const user = request.user as AuthenticatedUser;

    const success = await updateOnboardingStatus(user.userId, false);

    if (!success) {
      this.setStatus(404);
      throw new Error('User not found');
    }

    // Keep Clerk metadata in sync
    try {
      await clerkClient.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { onboardingComplete: false },
      });
    } catch (clerkError) {
      logger.warn('Failed to reset Clerk metadata for onboarding', {
        userId: user.userId,
        error: String(clerkError),
      });
    }

    logger.info('User reset onboarding', { userId: user.userId });

    return {
      success: true,
      data: { onboardingComplete: false },
    };
  }
}
