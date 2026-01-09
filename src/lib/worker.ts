/**
 * BullMQ Worker
 * Processes ETL sync jobs from the queue
 * 
 * Updated to use service-based workflow (same as manual syncs) instead of adapters.
 * This ensures scheduled jobs use the same credential handling and token management
 * as manual syncs triggered from the dashboard.
 *
 * @module lib/worker
 */

import { Worker, Job } from 'bullmq';
import { config } from '../config/index.js';
import { logger, events } from './logger.js';
import { ETLJobPayload, ETLJobResult, DataSource } from '../types/etl.js';
import { notifier } from './notifier.js';
import { etlQueue } from './queue.js';

// Import services (same ones used by manual sync routes)
import { metaService } from '../services/meta.service.js';
import { ga4Service } from '../services/ga4.service.js';
import { shopifyService } from '../services/shopify.service.js';

// Parse Redis URL for connection config
function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const connectionConfig = parseRedisUrl(config.redisUrl);
const QUEUE_NAME = 'etl-sync';

/**
 * Process a sync job based on source
 * Uses the same services as manual syncs (ga4Service, metaService, shopifyService)
 * This ensures consistent credential handling, token refresh, and error handling.
 */
async function processJob(job: Job<ETLJobPayload, ETLJobResult>): Promise<ETLJobResult> {
  const { source, targetDate, jobId, userId: jobUserId } = job.data;
  const startTime = Date.now();

  // Create a job-specific logger for better observability
  const jobLogger = logger.child({ jobId, source, userId: jobUserId });
  jobLogger.info(`Processing ${source} sync job via service workflow`, { targetDate, isScheduledJob: true });

  // Emit sync started event
  events.syncStarted(source, targetDate, jobId);

  try {
    // Import database utilities for credential lookup
    const { executeQuery } = await import('../lib/database.js');

    // Validate userId is provided (required for multi-tenant support)
    if (!jobUserId) {
      jobLogger.error('No userId provided in job payload - required for credential lookup');
      throw new Error('User ID is required for sync jobs. Please ensure userId is passed when enqueueing.');
    }

    // Get the service configuration to find the credential ID
    jobLogger.info('Fetching service configuration for user', { service: source, userId: jobUserId });
    
    const serviceConfigResult = await executeQuery(
      `SELECT sc.credential_id, sc.user_id, c.service as credential_service
       FROM service_configs sc
       LEFT JOIN credentials c ON c.id = sc.credential_id AND c.deleted_at IS NULL
       WHERE sc.service = $1 AND sc.enabled = true AND sc.user_id = $2
       LIMIT 1`,
      [source, jobUserId]
    );

    if (serviceConfigResult.rows.length === 0) {
      jobLogger.error('No enabled service configuration found', { 
        service: source, 
        userId: jobUserId,
        suggestion: 'User needs to configure and enable this service in the dashboard'
      });
      throw new Error(`No enabled service configuration found for ${source}. Please configure and enable the service in Settings.`);
    }

    const serviceConfig = serviceConfigResult.rows[0];
    const credentialId = serviceConfig.credential_id;

    if (!credentialId) {
      jobLogger.error('Service configuration exists but no credential linked', { 
        service: source, 
        userId: jobUserId 
      });
      throw new Error(`No credential linked to ${source} service. Please add credentials in Settings.`);
    }

    jobLogger.info('Found credential for service', { 
      credentialId, 
      credentialService: serviceConfig.credential_service,
      userId: jobUserId 
    });

    let result: ETLJobResult;

    // Use the appropriate service based on source
    // These services handle all credential decryption, token refresh, and API calls
    switch (source) {
      case 'meta': {
        jobLogger.info('Starting Meta sync via metaService.runWorkflow', { credentialId, userId: jobUserId });
        
        try {
          const workflowResult = await metaService.runWorkflow(credentialId, jobUserId);
          
          // Map service metrics to ETL result format
          // Note: Service uses string IDs, ETL uses numeric IDs - we omit id from metrics for compatibility
          const { id: _metaId, metricSources: _sources, ...metaMetrics } = workflowResult.metrics;
          
          result = {
            success: workflowResult.appendResult.success,
            jobId,
            source,
            date: workflowResult.metrics.date || targetDate,
            mode: workflowResult.appendResult.mode,
            rowNumber: workflowResult.appendResult.rowNumber,
            metrics: { ...metaMetrics, source: 'meta' as const } as any,
            error: workflowResult.appendResult.error,
            durationMs: Date.now() - startTime,
            completedAt: new Date().toISOString(),
          };
          
          jobLogger.info('Meta sync completed via service', {
            success: result.success,
            mode: result.mode,
            date: result.date,
            rowNumber: result.rowNumber
          });
        } catch (metaError) {
          const errorMessage = metaError instanceof Error ? metaError.message : String(metaError);
          jobLogger.error('Meta service workflow failed', { error: errorMessage });
          throw metaError;
        }
        break;
      }

      case 'ga4': {
        jobLogger.info('Starting GA4 sync via ga4Service.runWorkflow', { credentialId, userId: jobUserId });
        
        try {
          const workflowResult = await ga4Service.runWorkflow(credentialId, jobUserId);
          
          // Map service metrics to ETL result format
          const { id: _ga4Id, ...ga4Metrics } = workflowResult.metrics;
          
          result = {
            success: workflowResult.appendResult.success,
            jobId,
            source,
            date: workflowResult.metrics.date || targetDate,
            mode: workflowResult.appendResult.mode,
            rowNumber: workflowResult.appendResult.rowNumber,
            metrics: { ...ga4Metrics, source: 'ga4' as const } as any,
            error: workflowResult.appendResult.error,
            durationMs: Date.now() - startTime,
            completedAt: new Date().toISOString(),
          };
          
          jobLogger.info('GA4 sync completed via service', {
            success: result.success,
            mode: result.mode,
            date: result.date,
            rowNumber: result.rowNumber
          });
        } catch (ga4Error) {
          const errorMessage = ga4Error instanceof Error ? ga4Error.message : String(ga4Error);
          jobLogger.error('GA4 service workflow failed', { error: errorMessage });
          throw ga4Error;
        }
        break;
      }

      case 'shopify': {
        jobLogger.info('Starting Shopify sync via shopifyService.runWorkflow', { credentialId, userId: jobUserId });
        
        try {
          const workflowResult = await shopifyService.runWorkflow(credentialId, jobUserId);
          
          // Map service metrics to ETL result format
          const { id: _shopifyId, ...shopifyMetrics } = workflowResult.metrics;
          
          result = {
            success: workflowResult.appendResult.success,
            jobId,
            source,
            date: workflowResult.metrics.date || targetDate,
            mode: workflowResult.appendResult.mode,
            rowNumber: workflowResult.appendResult.rowNumber,
            metrics: { ...shopifyMetrics, source: 'shopify' as const } as any,
            error: workflowResult.appendResult.error,
            durationMs: Date.now() - startTime,
            completedAt: new Date().toISOString(),
          };
          
          jobLogger.info('Shopify sync completed via service', {
            success: result.success,
            mode: result.mode,
            date: result.date,
            rowNumber: result.rowNumber
          });
        } catch (shopifyError) {
          const errorMessage = shopifyError instanceof Error ? shopifyError.message : String(shopifyError);
          jobLogger.error('Shopify service workflow failed', { error: errorMessage });
          throw shopifyError;
        }
        break;
      }

      default:
        jobLogger.error('Unknown source provided', { source });
        throw new Error(`Unknown source: ${source}`);
    }

    // Emit success event
    if (result.success) {
      jobLogger.info('Sync completed successfully', {
        durationMs: result.durationMs,
        mode: result.mode,
        rowNumber: result.rowNumber
      });
      events.syncSuccess(source, targetDate, jobId, result.durationMs, 1);

      if (result.mode === 'append' && result.rowNumber) {
        events.rowAppended(source, targetDate, result.rowNumber);
      } else if (result.mode === 'update' && result.rowNumber) {
        events.rowUpdated(source, targetDate, result.rowNumber);
      }
    } else {
      jobLogger.warn('Sync completed with errors', { error: result.error });
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    jobLogger.error('Sync job failed', {
      error: errorMessage,
      durationMs,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Check for specific error types
    if (errorMessage.includes('token') || errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('Unauthorized')) {
      events.tokenExpired(source);
    }

    if (errorMessage.includes('rate') || errorMessage.includes('429') || errorMessage.includes('throttl')) {
      events.rateLimited(source);
    }

    events.syncFailure(source, targetDate, jobId, errorMessage, durationMs);

    // Send failure notification
    await notifier.sendSyncFailure(source, targetDate, errorMessage).catch((notifyError) => {
      jobLogger.error('Failed to send failure notification', {
        error: notifyError instanceof Error ? notifyError.message : String(notifyError),
      });
    });

    // Re-throw to trigger BullMQ retry
    throw error;
  }
}

/**
 * ETL Worker class
 * Manages job processing
 */
class ETLWorker {
  private worker: Worker<ETLJobPayload, ETLJobResult> | null = null;
  private isRunning = false;

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Worker already running');
      return;
    }

    // Don't start worker if queue is not available
    if (!etlQueue.isAvailable()) {
      logger.warn('Worker not started - queue not available');
      return;
    }

    this.worker = new Worker<ETLJobPayload, ETLJobResult>(
      QUEUE_NAME,
      processJob,
      {
        connection: connectionConfig,
        concurrency: 1, // Process one job at a time to avoid API rate limits
        limiter: {
          max: 5,
          duration: 60000, // Max 5 jobs per minute
        },
      }
    );

    // Event handlers
    this.worker.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed`, {
        source: result.source,
        date: result.date,
        mode: result.mode,
        durationMs: result.durationMs,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error(`Job ${job?.id} failed`, {
        source: job?.data.source,
        date: job?.data.targetDate,
        error: error.message,
        attemptsMade: job?.attemptsMade,
      });
    });

    this.worker.on('error', async (error) => {
      logger.error('Worker error', { error: error.message });

      // Send notification about worker error
      await notifier.sendDiscord(`❌ **Worker Error**\n\nETL worker encountered an error.\nError: ${error.message}\nTime: ${new Date().toISOString()}`);
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn(`Job ${jobId} stalled`);
    });

    this.isRunning = true;
    logger.info('ETL Worker started', { concurrency: 1 });
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.worker) return;

    await this.worker.close();
    this.worker = null;
    this.isRunning = false;
    logger.info('ETL Worker stopped');
  }

  /**
   * Check if worker is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Pause the worker
   */
  async pause(): Promise<void> {
    if (this.worker) {
      await this.worker.pause();
      logger.info('ETL Worker paused');
    }
  }

  /**
   * Resume the worker
   */
  async resume(): Promise<void> {
    if (this.worker) {
      this.worker.resume();
      logger.info('ETL Worker resumed');
    }
  }
}

// Export singleton instance
export const etlWorker = new ETLWorker();

export { ETLWorker };
