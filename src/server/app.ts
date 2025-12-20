/**
 * Express server for ETL Pipeline
 * API endpoints for sync operations and health monitoring
 *
 * @module server
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Config and logging
import { config, validateConfig, logConfig } from '../config/index.js';
import { logger } from '../lib/logger.js';

// Security middleware
import {
  securityHeaders,
  rateLimiter,
  sanitizeRequest,
  requestTimeout,
  apiKeyAuth,
  corsConfig,
} from '../lib/security.js';

// Queue system
import { etlQueue } from '../lib/queue.js';
import { etlWorker } from '../lib/worker.js';
import { scheduler } from '../lib/scheduler.js';
import { notifier } from '../lib/notifier.js';

// Adapters
import { metaAdapter } from '../adapters/meta.adapter.js';
import { ga4Adapter } from '../adapters/ga4.adapter.js';
import { shopifyAdapter } from '../adapters/shopify.adapter.js';

// Legacy services (for backward compatibility)
import { sheetsService } from '../services/sheets.js';
import { metaInsightsWorkflow, META_SPREADSHEET_ID, META_SHEET_NAME } from '../services/meta.js';
import { shopifyWorkflow, SHOPIFY_SPREADSHEET_ID, SHOPIFY_SHEET_NAME } from '../services/shopify.js';
import { googleAnalyticsWorkflow, GA_SPREADSHEET_ID, GA_SHEET_NAME } from '../services/google.js';

// Types
import { ApiResponse, HealthCheckResponse, DataSource } from '../types/etl.js';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../../public');

const app = express();
const PORT = config.port;
const startTime = Date.now();

// ===========================================================================
// MIDDLEWARE SETUP
// ===========================================================================

// Trust proxy if behind reverse proxy (e.g., nginx, load balancer)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Security headers (must be first)
app.use(securityHeaders());

// CORS configuration
app.use(cors(corsConfig()));

// Request parsing
app.use(express.json({ limit: '10mb' })); // Reduced from 50mb for security
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (100 requests per minute per IP)
app.use(rateLimiter(60000, 100));

// Request sanitization
app.use(sanitizeRequest());

// Request timeout (30 seconds)
app.use(requestTimeout(30000));

// API key authentication (optional - enable by setting API_KEY env)
app.use(apiKeyAuth(['/api/health', '/', '/api/init']));

// Static files
app.use(express.static(publicDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
}));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
  });
  next();
});

// ============================================================================
// HEALTH & STATUS ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const queueStats = await etlQueue.getStats();
    
    const response: HealthCheckResponse = {
      status: 'healthy',
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      redis: {
        connected: queueStats.waiting >= 0, // If we can get stats, Redis is connected
        latencyMs: undefined,
      },
    };

    res.json(response);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Queue statistics
 * GET /api/v1/queue/stats
 */
app.get('/api/v1/queue/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await etlQueue.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get job status
 * GET /api/v1/jobs/:jobId
 */
app.get('/api/v1/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const status = await etlQueue.getJobStatus(jobId);

    if (!status) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// SYNC API ENDPOINTS (v1)
// ============================================================================

/**
 * Trigger sync for all sources via queue
 * POST /api/v1/sync/all
 */
app.post('/api/v1/sync/all', async (req: Request, res: Response) => {
  try {
    const { targetDate } = req.body || {};
    const jobs = await etlQueue.enqueueAllSyncs({ targetDate });

    res.json({
      success: true,
      message: `Enqueued ${jobs.length} sync jobs`,
      data: {
        jobs: jobs.map((j) => ({
          jobId: j.id,
          source: j.data.source,
          targetDate: j.data.targetDate,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to enqueue sync jobs', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Trigger Meta sync via queue
 * POST /api/v1/sync/meta
 */
app.post('/api/v1/sync/meta', async (req: Request, res: Response) => {
  try {
    const { targetDate, spreadsheetId, sheetName } = req.body || {};
    const job = await etlQueue.enqueueSync('meta', { targetDate, spreadsheetId, sheetName });

    res.json({
      success: true,
      message: 'Meta sync job enqueued',
      data: {
        jobId: job.id,
        source: 'meta',
        targetDate: job.data.targetDate,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Trigger GA4 sync via queue
 * POST /api/v1/sync/ga4
 */
app.post('/api/v1/sync/ga4', async (req: Request, res: Response) => {
  try {
    const { targetDate, spreadsheetId, sheetName } = req.body || {};
    const job = await etlQueue.enqueueSync('ga4', { targetDate, spreadsheetId, sheetName });

    res.json({
      success: true,
      message: 'GA4 sync job enqueued',
      data: {
        jobId: job.id,
        source: 'ga4',
        targetDate: job.data.targetDate,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Trigger Shopify sync via queue
 * POST /api/v1/sync/shopify
 */
app.post('/api/v1/sync/shopify', async (req: Request, res: Response) => {
  try {
    const { targetDate, spreadsheetId, sheetName } = req.body || {};
    const job = await etlQueue.enqueueSync('shopify', { targetDate, spreadsheetId, sheetName });

    res.json({
      success: true,
      message: 'Shopify sync job enqueued',
      data: {
        jobId: job.id,
        source: 'shopify',
        targetDate: job.data.targetDate,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// DIRECT SYNC ENDPOINTS (bypass queue - for testing/debugging)
// ============================================================================

/**
 * Direct Meta sync (bypasses queue)
 * POST /api/v1/sync/meta/direct
 */
app.post('/api/v1/sync/meta/direct', async (req: Request, res: Response) => {
  try {
    const { accessToken, spreadsheetId, sheetName, targetDate } = req.body || {};

    if (!accessToken) {
      res.status(400).json({
        success: false,
        error: 'accessToken is required',
      });
      return;
    }

    const result = await metaAdapter.sync({
      accessToken,
      targetDate,
      spreadsheetId,
      sheetName,
    });

    res.json({
      success: result.success,
      data: result,
      message: result.success
        ? `Meta sync completed: ${result.mode} at row ${result.rowNumber}`
        : `Meta sync failed: ${result.error}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Direct GA4 sync (bypasses queue)
 * POST /api/v1/sync/ga4/direct
 */
app.post('/api/v1/sync/ga4/direct', async (req: Request, res: Response) => {
  try {
    const { accessToken, propertyId, spreadsheetId, sheetName, targetDate } = req.body || {};

    if (!accessToken || !propertyId) {
      res.status(400).json({
        success: false,
        error: 'accessToken and propertyId are required',
      });
      return;
    }

    const result = await ga4Adapter.sync({
      accessToken,
      propertyId,
      targetDate,
      spreadsheetId,
      sheetName,
    });

    res.json({
      success: result.success,
      data: result,
      message: result.success
        ? `GA4 sync completed: ${result.mode} at row ${result.rowNumber}`
        : `GA4 sync failed: ${result.error}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Direct Shopify sync (bypasses queue)
 * POST /api/v1/sync/shopify/direct
 */
app.post('/api/v1/sync/shopify/direct', async (req: Request, res: Response) => {
  try {
    const { storeDomain, accessToken, spreadsheetId, sheetName, targetDate } = req.body || {};

    if (!storeDomain || !accessToken) {
      res.status(400).json({
        success: false,
        error: 'storeDomain and accessToken are required',
      });
      return;
    }

    const result = await shopifyAdapter.sync({
      storeDomain,
      accessToken,
      targetDate,
      spreadsheetId,
      sheetName,
    });

    res.json({
      success: result.success,
      data: result,
      message: result.success
        ? `Shopify sync completed: ${result.mode} at row ${result.rowNumber}`
        : `Shopify sync failed: ${result.error}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// SCHEDULER CONTROL ENDPOINTS
// ============================================================================

/**
 * Get scheduler status
 * GET /api/v1/scheduler/status
 */
app.get('/api/v1/scheduler/status', (_req: Request, res: Response) => {
  const nextRun = scheduler.getNextRun();
  res.json({
    success: true,
    data: {
      isActive: scheduler.isActive(),
      schedule: config.cronSchedule,
      timezone: config.timezone,
      nextRun: nextRun?.toISOString(),
    },
  });
});

/**
 * Start the scheduler
 * POST /api/v1/scheduler/start
 */
app.post('/api/v1/scheduler/start', (_req: Request, res: Response) => {
  try {
    scheduler.start();
    res.json({
      success: true,
      message: 'Scheduler started',
      data: {
        schedule: config.cronSchedule,
        timezone: config.timezone,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Stop the scheduler
 * POST /api/v1/scheduler/stop
 */
app.post('/api/v1/scheduler/stop', (_req: Request, res: Response) => {
  scheduler.stop();
  res.json({
    success: true,
    message: 'Scheduler stopped',
  });
});

/**
 * Trigger immediate sync (manual trigger)
 * POST /api/v1/scheduler/trigger
 */
app.post('/api/v1/scheduler/trigger', async (_req: Request, res: Response) => {
  try {
    await scheduler.triggerNow();
    res.json({
      success: true,
      message: 'Manual sync triggered',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// NOTIFICATION TEST ENDPOINTS
// ============================================================================

/**
 * Test notifications
 * POST /api/v1/notifications/test
 */
app.post('/api/v1/notifications/test', async (_req: Request, res: Response) => {
  try {
    const results = await notifier.testNotifications();
    res.json({
      success: true,
      data: results,
      message: `Telegram: ${results.telegram ? 'sent' : 'failed/disabled'}, Email: ${results.email ? 'sent' : 'failed/disabled'}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// LEGACY ENDPOINTS (backward compatibility)
// ============================================================================

/**
 * Initialize sheets service
 */
app.get('/api/init', async (_req: Request, res: Response) => {
  try {
    await sheetsService.initialize();
    res.json({ success: true, message: 'Service initialized' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * List spreadsheets
 */
app.get('/api/spreadsheets', async (_req: Request, res: Response) => {
  try {
    const spreadsheets = await sheetsService.listSpreadsheets();
    res.json({ success: true, data: spreadsheets });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get sheet names
 */
app.get('/api/sheets/:spreadsheetId', async (req: Request, res: Response) => {
  try {
    const { spreadsheetId } = req.params;
    const sheets = await sheetsService.getSheetNames(spreadsheetId);
    res.json({ success: true, data: sheets });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Read sheet data
 */
app.get('/api/data/:spreadsheetId/:sheetName', async (req: Request, res: Response) => {
  try {
    const { spreadsheetId, sheetName } = req.params;
    const data = await sheetsService.readSheet(spreadsheetId, sheetName);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Read raw sheet values (including header row)
 * Returns a 2D array exactly as stored in the sheet
 */
app.get('/api/data/raw/:spreadsheetId/:sheetName', async (req: Request, res: Response) => {
  try {
    const { spreadsheetId, sheetName } = req.params;
    const data = await sheetsService.getRawValues(spreadsheetId, sheetName);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Legacy Meta fetch (uses old workflow)
 */
app.post('/api/meta/fetch', async (req: Request, res: Response) => {
  try {
    const { accessToken, spreadsheetId, sheetName } = req.body || {};

    if (!accessToken) {
      res.status(400).json({
        success: false,
        error: 'Access token is required',
      });
      return;
    }

    const result = await metaInsightsWorkflow.runWorkflow(accessToken, {
      spreadsheetId: spreadsheetId || undefined,
      sheetName: sheetName || undefined,
    });

    res.json({
      success: true,
      data: result,
      message: result.appendResult.success
        ? `Meta insights for ${result.metrics.date} synced`
        : `Meta fetch completed but sheet write failed`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Legacy Shopify fetch
 */
app.post('/api/shopify/fetch', async (req: Request, res: Response) => {
  try {
    const { storeDomain, accessToken, spreadsheetId, sheetName } = req.body || {};

    if (!storeDomain || !accessToken) {
      res.status(400).json({
        success: false,
        error: 'storeDomain and accessToken are required',
      });
      return;
    }

    const result = await shopifyWorkflow.runWorkflow(storeDomain, accessToken, {
      spreadsheetId: spreadsheetId || undefined,
      sheetName: sheetName || undefined,
    });

    res.json({
      success: true,
      data: result,
      message: result.appendResult.success
        ? `Shopify metrics for ${result.metrics.date} synced`
        : `Shopify fetch completed but sheet write failed`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Legacy Google Analytics fetch
 */
app.post('/api/google/fetch', async (req: Request, res: Response) => {
  try {
    const { accessToken, propertyId, spreadsheetId, sheetName } = req.body || {};

    if (!accessToken || !propertyId) {
      res.status(400).json({
        success: false,
        error: 'accessToken and propertyId are required',
      });
      return;
    }

    const result = await googleAnalyticsWorkflow.runWorkflow(accessToken, propertyId, {
      spreadsheetId: spreadsheetId || undefined,
      sheetName: sheetName || undefined,
    });

    res.json({
      success: true,
      data: result,
      message: result.appendResult.mode === 'skip'
        ? `GA4 metrics for ${result.metrics.date} already exist`
        : result.appendResult.success
          ? `GA4 metrics for ${result.metrics.date} synced`
          : `GA4 fetch completed but sheet write failed`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Serve frontend SPA (fallback to index.html for client routing)
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function startServer(): Promise<void> {
  // Log configuration
  console.log('\n' + '='.repeat(60));
  console.log('🚀 KPI ETL Pipeline - Starting Server');
  console.log('='.repeat(60) + '\n');

  logConfig();
  console.log('');

  // Validate configuration
  const validation = validateConfig();
  if (!validation.valid) {
    console.warn('⚠️  Configuration warnings:');
    validation.errors.forEach((e) => console.warn(`   - ${e}`));
    console.log('');
  }

  // Initialize queue
  try {
    await etlQueue.initialize();
    logger.info('Queue initialized');
  } catch (error) {
    logger.warn('Queue initialization failed - running without queue', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Start worker
  try {
    await etlWorker.start();
    logger.info('Worker started');
  } catch (error) {
    logger.warn('Worker start failed - running without worker', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Start scheduler if enabled
  if (process.env.ENABLE_SCHEDULER === 'true') {
    try {
      scheduler.start();
      logger.info('Scheduler started');
    } catch (error) {
      logger.warn('Scheduler start failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Start HTTP server
  app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📊 Open http://localhost:${PORT} in browser`);
    console.log('='.repeat(60) + '\n');

    console.log('📡 API Endpoints:');
    console.log('   Health:    GET  /api/health');
    console.log('   Sync All:  POST /api/v1/sync/all');
    console.log('   Sync Meta: POST /api/v1/sync/meta');
    console.log('   Sync GA4:  POST /api/v1/sync/ga4');
    console.log('   Sync Shop: POST /api/v1/sync/shopify');
    console.log('   Jobs:      GET  /api/v1/jobs/:jobId');
    console.log('   Scheduler: GET  /api/v1/scheduler/status');
    console.log('');
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  scheduler.stop();
  await etlWorker.stop();
  await etlQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  scheduler.stop();
  await etlWorker.stop();
  await etlQueue.close();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

export default app;
