/**
 * Health Controller
 * 
 * System health and status endpoints
 */

import {
  Controller,
  Get,
  Route,
  Tags,
  Response,
} from 'tsoa';
import { etlQueue } from '../lib/queue.js';
import { ErrorResponse, HealthCheckResponse, QueueStats } from './models.js';

const startTime = Date.now();

@Route('api')
@Tags('Health')
export class HealthController extends Controller {
  /**
   * Get system health status
   * @summary Health check endpoint
   */
  @Get('health')
  @Response<ErrorResponse>(503, 'Service unhealthy')
  public async getHealth(): Promise<HealthCheckResponse> {
    try {
      const queueStats = await etlQueue.getStats();
      
      return {
        status: 'healthy',
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        redis: {
          connected: queueStats.waiting >= 0,
          latencyMs: undefined,
        },
      };
    } catch (error) {
      this.setStatus(503);
      throw error;
    }
  }

  /**
   * Get queue statistics
   * @summary Queue stats endpoint
   */
  @Get('v1/queue/stats')
  @Response<ErrorResponse>(500, 'Internal error')
  public async getQueueStats(): Promise<{ success: boolean; data: QueueStats }> {
    try {
      const stats = await etlQueue.getStats();
      return { success: true, data: stats };
    } catch (error) {
      this.setStatus(500);
      throw error;
    }
  }
}
