/**
 * Sync Controller
 * 
 * Handles data synchronization operations:
 * - Sync all sources
 * - Sync individual sources (Meta, GA4, Shopify)
 * - Job status tracking
 */

import {
  Controller,
  Get,
  Post,
  Route,
  Path,
  Body,
  Tags,
  Security,
  Response,
  Request,
} from 'tsoa';
import * as express from 'express';
import { etlQueue } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { AuthenticatedUser } from '../authentication.js';
import {
  ErrorResponse,
  SyncRequest,
  SyncAllResponse,
  SyncResponse,
  JobStatusResponse,
} from './models.js';

@Route('api/v1')
@Tags('Sync')
export class SyncController extends Controller {
  /**
   * Trigger sync for all sources via queue
   */
  @Post('sync/all')
  @Security('jwt')
  @Response<ErrorResponse>(500, 'Internal error')
  public async syncAll(
    @Body() body: SyncRequest,
    @Request() request: express.Request
  ): Promise<SyncAllResponse> {
    const user = request.user as AuthenticatedUser;

    try {
      const { targetDate } = body || {};
      const jobs = await etlQueue.enqueueAllSyncs({ targetDate, userId: user.userId });

      return {
        success: true,
        message: `Enqueued ${jobs.length} sync jobs`,
        data: {
          jobs: jobs.map((j) => ({
            jobId: j.id,
            source: j.data.source,
            targetDate: j.data.targetDate,
          })),
        },
      };
    } catch (error) {
      logger.error('Failed to enqueue sync jobs', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.userId,
      });
      this.setStatus(500);
      throw error;
    }
  }

  /**
   * Trigger Meta sync via queue
   */
  @Post('sync/meta')
  @Security('jwt')
  @Response<ErrorResponse>(500, 'Internal error')
  public async syncMeta(
    @Body() body: SyncRequest,
    @Request() request: express.Request
  ): Promise<SyncResponse> {
    const user = request.user as AuthenticatedUser;

    try {
      const { targetDate, spreadsheetId, sheetName } = body || {};
      const job = await etlQueue.enqueueSync('meta', {
        targetDate,
        spreadsheetId,
        sheetName,
        userId: user.userId,
      });

      return {
        success: true,
        message: 'Meta sync job enqueued',
        data: {
          jobId: job.id,
          source: 'meta',
          targetDate: job.data.targetDate,
        },
      };
    } catch (error) {
      this.setStatus(500);
      throw error;
    }
  }

  /**
   * Trigger GA4 sync via queue
   */
  @Post('sync/ga4')
  @Security('jwt')
  @Response<ErrorResponse>(500, 'Internal error')
  public async syncGa4(
    @Body() body: SyncRequest,
    @Request() request: express.Request
  ): Promise<SyncResponse> {
    const user = request.user as AuthenticatedUser;

    try {
      const { targetDate, spreadsheetId, sheetName } = body || {};
      const job = await etlQueue.enqueueSync('ga4', {
        targetDate,
        spreadsheetId,
        sheetName,
        userId: user.userId,
      });

      return {
        success: true,
        message: 'GA4 sync job enqueued',
        data: {
          jobId: job.id,
          source: 'ga4',
          targetDate: job.data.targetDate,
        },
      };
    } catch (error) {
      this.setStatus(500);
      throw error;
    }
  }

  /**
   * Trigger Shopify sync via queue
   */
  @Post('sync/shopify')
  @Security('jwt')
  @Response<ErrorResponse>(500, 'Internal error')
  public async syncShopify(
    @Body() body: SyncRequest,
    @Request() request: express.Request
  ): Promise<SyncResponse> {
    const user = request.user as AuthenticatedUser;

    try {
      const { targetDate, spreadsheetId, sheetName } = body || {};
      const job = await etlQueue.enqueueSync('shopify', {
        targetDate,
        spreadsheetId,
        sheetName,
        userId: user.userId,
      });

      return {
        success: true,
        message: 'Shopify sync job enqueued',
        data: {
          jobId: job.id,
          source: 'shopify',
          targetDate: job.data.targetDate,
        },
      };
    } catch (error) {
      this.setStatus(500);
      throw error;
    }
  }

  /**
   * Get job status
   */
  @Get('jobs/{jobId}')
  @Response<ErrorResponse>(404, 'Job not found')
  @Response<ErrorResponse>(500, 'Internal error')
  public async getJobStatus(@Path() jobId: string): Promise<JobStatusResponse> {
    try {
      const status = await etlQueue.getJobStatus(jobId);

      if (!status) {
        this.setStatus(404);
        throw new Error('Job not found');
      }

      return { success: true, data: status };
    } catch (error) {
      if ((error as Error).message === 'Job not found') throw error;
      this.setStatus(500);
      throw error;
    }
  }
}
