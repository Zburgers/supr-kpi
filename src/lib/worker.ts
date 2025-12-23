/**
 * BullMQ Worker
 * Processes ETL sync jobs from the queue
 *
 * @module lib/worker
 */

import { Worker, Job } from 'bullmq';
import { config, getSourceCredentials } from '../config/index.js';
import { logger, events } from './logger.js';
import { ETLJobPayload, ETLJobResult, DataSource } from '../types/etl.js';
import { metaAdapter } from '../adapters/meta.adapter.js';
import { ga4Adapter } from '../adapters/ga4.adapter.js';
import { shopifyAdapter } from '../adapters/shopify.adapter.js';
import { notifier } from './notifier.js';
import { etlQueue } from './queue.js';

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
 */
async function processJob(job: Job<ETLJobPayload, ETLJobResult>): Promise<ETLJobResult> {
  const { source, targetDate, jobId, userId: jobUserId } = job.data;
  const startTime = Date.now();

  logger.info(`Processing ${source} sync job`, { jobId, targetDate, userId: jobUserId });
  events.syncStarted(source, targetDate, jobId);

  try {
    // Get credentials from the database (new system)
    let credentialJson: string | undefined;
    let userId: number | undefined;

    // We need to get the service configuration to find the credential ID
    // This would require fetching from the service_configs table
    // For now, we'll use the workflowRunner approach which already handles this
    const { executeQuery } = await import('../lib/database.js');
    const { decryptCredential } = await import('../lib/encryption.js');

    // Get the service configuration to find the credential ID
    // If userId is provided in job, filter by it (multi-tenant support)
    const userFilter = jobUserId ? 'AND sc.user_id = $2' : '';
    const queryParams = jobUserId 
      ? [source, jobUserId] 
      : [source];
    
    const serviceConfigResult = await executeQuery(
      `SELECT sc.credential_id, sc.user_id FROM service_configs sc
       WHERE sc.service = $1 AND sc.enabled = true ${userFilter}
       LIMIT 1`,
      queryParams
    );

    let result: ETLJobResult;

    if (serviceConfigResult.rows.length > 0 && serviceConfigResult.rows[0].credential_id) {
      // Get the credential from the database
      const credentialId = serviceConfigResult.rows[0].credential_id;
      const credentialResult = await executeQuery(
        `SELECT encrypted_data, user_id FROM credentials
         WHERE id = $1 AND deleted_at IS NULL`,
        [credentialId]
      );

      if (credentialResult.rows.length > 0) {
        const encryptedData = credentialResult.rows[0].encrypted_data;
        userId = credentialResult.rows[0].user_id;
        credentialJson = decryptCredential(encryptedData, String(userId));
      }
    }

    // If no stored credentials found, throw an error instead of falling back to environment variables
    if (!credentialJson) {
      throw new Error(`No stored credentials found for service: ${source}. Please configure credentials in the dashboard.`);
    }

    // Parse the credential JSON to get the credential data
    const credentialData = JSON.parse(credentialJson);

    switch (source) {
      case 'meta': {
        const options = {
          // Use credentials from the JSON
          ...credentialData,
          targetDate,
          spreadsheetId: job.data.spreadsheetId || config.sources.meta.spreadsheetId,
          sheetName: job.data.sheetName || config.sources.meta.sheetName,
        };

        const adapterResult = await metaAdapter.sync(options, credentialJson);
        result = {
          success: adapterResult.success,
          jobId,
          source,
          date: targetDate,
          mode: adapterResult.mode,
          rowNumber: adapterResult.rowNumber,
          metrics: adapterResult.metrics,
          error: adapterResult.error,
          durationMs: Date.now() - startTime,
          completedAt: new Date().toISOString(),
        };
        break;
      }

      case 'ga4': {
        const options = {
          // Use credentials from the JSON
          ...credentialData,
          targetDate,
          spreadsheetId: job.data.spreadsheetId || config.sources.ga4.spreadsheetId,
          sheetName: job.data.sheetName || config.sources.ga4.sheetName,
        };

        const adapterResult = await ga4Adapter.sync(options, credentialJson);
        result = {
          success: adapterResult.success,
          jobId,
          source,
          date: targetDate,
          mode: adapterResult.mode,
          rowNumber: adapterResult.rowNumber,
          metrics: adapterResult.metrics,
          error: adapterResult.error,
          durationMs: Date.now() - startTime,
          completedAt: new Date().toISOString(),
        };
        break;
      }

      case 'shopify': {
        const options = {
          // Use credentials from the JSON
          ...credentialData,
          targetDate,
          spreadsheetId: job.data.spreadsheetId || config.sources.shopify.spreadsheetId,
          sheetName: job.data.sheetName || config.sources.shopify.sheetName,
        };

        const adapterResult = await shopifyAdapter.sync(options, credentialJson);
        result = {
          success: adapterResult.success,
          jobId,
          source,
          date: targetDate,
          mode: adapterResult.mode,
          rowNumber: adapterResult.rowNumber,
          metrics: adapterResult.metrics,
          error: adapterResult.error,
          durationMs: Date.now() - startTime,
          completedAt: new Date().toISOString(),
        };
        break;
      }

      default:
        throw new Error(`Unknown source: ${source}`);
    }

    // Emit success event
    if (result.success) {
      events.syncSuccess(source, targetDate, jobId, result.durationMs, 1);
      
      if (result.mode === 'append' && result.rowNumber) {
        events.rowAppended(source, targetDate, result.rowNumber);
      } else if (result.mode === 'update' && result.rowNumber) {
        events.rowUpdated(source, targetDate, result.rowNumber);
      }
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for specific error types
    if (errorMessage.includes('token') || errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      events.tokenExpired(source);
    }

    if (errorMessage.includes('rate') || errorMessage.includes('429') || errorMessage.includes('throttl')) {
      events.rateLimited(source);
    }

    events.syncFailure(source, targetDate, jobId, errorMessage, durationMs);

    // Send failure notification
    await notifier.sendSyncFailure(source, targetDate, errorMessage).catch((notifyError) => {
      logger.error('Failed to send failure notification', {
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

    this.worker.on('error', (error) => {
      logger.error('Worker error', { error: error.message });
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
