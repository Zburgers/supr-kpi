/**
 * BullMQ Job Queue System
 * Manages ETL job scheduling and processing
 *
 * @module lib/queue
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { config } from '../config/index.js';
import { logger, events } from './logger.js';
import { ETLJobPayload, ETLJobResult, DataSource, IsoDate } from '../types/etl.js';
import { v4 as uuidv4 } from 'uuid';

// Redis connection options
const redisConnection = {
  url: config.redisUrl,
  maxRetriesPerRequest: null,
};

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

// Queue names
const QUEUE_NAME = 'etl-sync';

/**
 * ETL Job Queue
 * Manages job enqueueing and scheduling
 */
class ETLQueue {
  private queue: Queue<ETLJobPayload, ETLJobResult> | null = null;
  private queueEvents: QueueEvents | null = null;
  private isInitialized = false;
  private initializationFailed = false;

  /**
   * Get or create queue instance
   */
  private getQueue(): Queue<ETLJobPayload, ETLJobResult> {
    if (!this.queue) {
      this.queue = new Queue<ETLJobPayload, ETLJobResult>(QUEUE_NAME, {
        connection: connectionConfig,
        defaultJobOptions: {
          attempts: config.maxRetries,
          backoff: {
            type: 'exponential',
            delay: 5000, // Start with 5 second delay
          },
          removeOnComplete: {
            count: 100, // Keep last 100 completed jobs
            age: 24 * 60 * 60, // Keep for 24 hours
          },
          removeOnFail: {
            count: 50, // Keep last 50 failed jobs
            age: 7 * 24 * 60 * 60, // Keep for 7 days
          },
        },
      });
    }
    return this.queue;
  }

  /**
   * Initialize queue and events listener
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationFailed) {
      throw new Error('Queue initialization previously failed');
    }

    try {
      const queue = this.getQueue();
      // Test Redis connection with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      );
      
      await Promise.race([queue.client, timeoutPromise]);
      
      // Setup queue events listener
      this.queueEvents = new QueueEvents(QUEUE_NAME, {
        connection: connectionConfig,
      });

      this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
        logger.info(`Job ${jobId} completed`, { returnvalue });
      });

      this.queueEvents.on('failed', ({ jobId, failedReason }) => {
        logger.error(`Job ${jobId} failed`, { failedReason });
      });

      this.isInitialized = true;
      logger.info('ETL Queue initialized', { queueName: QUEUE_NAME });
    } catch (error) {
      this.initializationFailed = true;
      logger.error('Failed to initialize ETL Queue', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if queue is available
   */
  isAvailable(): boolean {
    return this.isInitialized && !this.initializationFailed;
  }

  /**
   * Get yesterday's date in ISO format
   */
  private getYesterdayDate(): IsoDate {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  /**
   * Enqueue a sync job for a specific source
   */
  async enqueueSync(
    source: DataSource,
    options?: {
      targetDate?: IsoDate;
      spreadsheetId?: string;
      sheetName?: string;
      priority?: number;
      delay?: number;
      userId?: number;
    }
  ): Promise<Job<ETLJobPayload, ETLJobResult>> {
    if (!this.isAvailable()) {
      throw new Error('Queue not available - Redis connection required');
    }

    const queue = this.getQueue();
    const jobId = uuidv4();
    const targetDate = options?.targetDate || this.getYesterdayDate();

    const payload: ETLJobPayload = {
      jobId,
      source,
      targetDate,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      spreadsheetId: options?.spreadsheetId,
      sheetName: options?.sheetName,
      userId: options?.userId,
    };

    const job = await queue.add(`sync-${source}`, payload, {
      jobId,
      priority: options?.priority ?? 0,
      delay: options?.delay ?? 0,
    });

    logger.info(`Enqueued sync job for ${source}`, {
      jobId,
      targetDate,
      priority: options?.priority,
      delay: options?.delay,
    });

    return job;
  }

  /**
   * Enqueue sync jobs for all enabled sources
   */
  async enqueueAllSyncs(options?: { targetDate?: IsoDate; userId?: number }): Promise<Job<ETLJobPayload, ETLJobResult>[]> {
    const jobs: Job<ETLJobPayload, ETLJobResult>[] = [];
    const sources: DataSource[] = ['meta', 'ga4', 'shopify'];
    
    // Stagger jobs by 30 seconds to avoid API burst
    let delay = 0;
    const staggerMs = 30000;

    for (const source of sources) {
      const sourceConfig = config.sources[source];
      if (sourceConfig.enabled) {
        const job = await this.enqueueSync(source, {
          targetDate: options?.targetDate,
          delay,
          userId: options?.userId,
        });
        jobs.push(job);
        delay += staggerMs;
      }
    }

    logger.info(`Enqueued ${jobs.length} sync jobs`, {
      sources: jobs.map((j) => j.data.source),
      userId: options?.userId,
    });

    return jobs;
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    data?: ETLJobPayload;
    result?: ETLJobResult;
    failedReason?: string;
  } | null> {
    if (!this.isAvailable()) return null;
    
    const queue = this.getQueue();
    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      status: state,
      progress: job.progress as number,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.isAvailable()) {
      return { waiting: -1, active: -1, completed: -1, failed: -1, delayed: -1 };
    }
    
    const queue = this.getQueue();
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get recent jobs for a source
   */
  async getRecentJobs(
    source?: DataSource,
    limit: number = 10
  ): Promise<Array<{ id: string; state: string; data: ETLJobPayload; timestamp: number }>> {
    if (!this.isAvailable()) return [];
    
    const queue = this.getQueue();
    const jobs = await queue.getJobs(['completed', 'failed', 'waiting', 'active'], 0, limit);

    return jobs
      .filter((job) => !source || job.data.source === source)
      .map((job) => ({
        id: job.id || '',
        state: '', // Will be populated
        data: job.data,
        timestamp: job.timestamp,
      }));
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    if (!this.isAvailable()) return;
    const queue = this.getQueue();
    await queue.pause();
    logger.info('ETL Queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    if (!this.isAvailable()) return;
    const queue = this.getQueue();
    await queue.resume();
    logger.info('ETL Queue resumed');
  }

  /**
   * Clean old jobs
   */
  async clean(gracePeriodMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.isAvailable()) return;
    const queue = this.getQueue();
    await queue.clean(gracePeriodMs, 100, 'completed');
    await queue.clean(gracePeriodMs * 7, 50, 'failed');
    logger.info('ETL Queue cleaned');
  }

  /**
   * Close the queue connection
   */
  async close(): Promise<void> {
    await this.queueEvents?.close();
    if (this.queue) {
      await this.queue.close();
    }
    logger.info('ETL Queue closed');
  }

  /**
   * Get the underlying BullMQ queue instance (for internal use)
   */
  getBullQueue(): Queue<ETLJobPayload, ETLJobResult> | null {
    return this.queue;
  }
}

// Export singleton instance
export const etlQueue = new ETLQueue();

export { ETLQueue };
