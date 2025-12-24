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

// Database and authentication
import { initializeDatabase, closeDatabase } from '../lib/database.js';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { swaggerDocs } from '../middleware/swagger.js';

// Credential management routes
import credentialRoutes from '../routes/credentials.js';
import serviceRoutes from '../routes/services.js';
import sheetRoutes from '../routes/sheets.js';
import sheetExternalRoutes from '../routes/sheets-external.js';
import ga4Routes from '../routes/ga4.js';
import userRoutes from '../routes/user.js';
import scheduleRoutes from '../routes/schedules.js';
import activityLogRoutes from '../routes/activity-log.js';

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
// Note: googleAnalyticsWorkflow has been deprecated and replaced with new GA4 service

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
app.use(apiKeyAuth(['/api/health', '/', '/api/init', '/api/docs', '/api/docs.json']));

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

// Swagger / OpenAPI documentation
swaggerDocs(app);

// ============================================================================
// CREDENTIAL MANAGEMENT ROUTES (NEW)
// ============================================================================
// Routes for managing encrypted credentials and services

app.use('/api/credentials', authenticate, credentialRoutes);
app.use('/api/services', authenticate, serviceRoutes);
app.use('/api/sheet-mappings', authenticate, sheetRoutes);
app.use('/api/sheets', authenticate, sheetExternalRoutes); // Enhanced sheets routes with credential support
app.use('/api/ga4', authenticate, ga4Routes); // GA4 analytics routes
app.use('/api/schedules', authenticate, scheduleRoutes);
app.use('/api/activity-log', authenticate, activityLogRoutes);
app.use('/api/user', userRoutes);

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
// SYNC API ENDPOINTS (v1) - AUTHENTICATED
// ============================================================================

/**
 * Trigger sync for all sources via queue
 * POST /api/v1/sync/all
 * Requires authentication for multi-tenant support
 */
app.post('/api/v1/sync/all', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  
  try {
    const { targetDate } = req.body || {};
    const userId = req.user!.userId;
    const jobs = await etlQueue.enqueueAllSyncs({ targetDate, userId });

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
      userId: req.user?.userId,
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
 * Requires authentication for multi-tenant support
 */
app.post('/api/v1/sync/meta', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  
  try {
    const { targetDate, spreadsheetId, sheetName } = req.body || {};
    const userId = req.user!.userId;
    const job = await etlQueue.enqueueSync('meta', { targetDate, spreadsheetId, sheetName, userId });

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
 * Requires authentication for multi-tenant support
 */
app.post('/api/v1/sync/ga4', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  
  try {
    const { targetDate, spreadsheetId, sheetName } = req.body || {};
    const userId = req.user!.userId;
    const job = await etlQueue.enqueueSync('ga4', { targetDate, spreadsheetId, sheetName, userId });

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
 * Requires authentication for multi-tenant support
 */
app.post('/api/v1/sync/shopify', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  
  try {
    const { targetDate, spreadsheetId, sheetName } = req.body || {};
    const userId = req.user!.userId;
    const job = await etlQueue.enqueueSync('shopify', { targetDate, spreadsheetId, sheetName, userId });

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
app.post('/api/v1/sync/meta/direct', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { accessToken, accountId, spreadsheetId, sheetName, targetDate } = req.body || {};
    const userId = req.user!.userId;

    if (!accessToken) {
      res.status(400).json({
        success: false,
        error: 'accessToken is required',
      });
      return;
    }

    if (!accountId) {
      res.status(400).json({
        success: false,
        error: 'accountId is required',
      });
      return;
    }

    // Dynamically import database functions
    const { executeQuery } = await import('../lib/database.js');
    const { decryptCredential } = await import('../lib/encryption.js');

    // Fetch the credential from the database
    const serviceConfigResult = await executeQuery(
      `SELECT credential_id FROM service_configs
       WHERE service = 'meta' AND user_id = $1 AND enabled = true
       LIMIT 1`,
      [userId],
      userId
    );

    if (serviceConfigResult.rows.length === 0 || !serviceConfigResult.rows[0].credential_id) {
      res.status(400).json({
        success: false,
        error: 'No enabled Meta service configuration found. Please configure credentials in the dashboard.',
      });
      return;
    }

    const credentialId = serviceConfigResult.rows[0].credential_id;
    const credentialResult = await executeQuery(
      `SELECT encrypted_data FROM credentials
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [credentialId, userId],
      userId
    );

    if (credentialResult.rows.length === 0) {
      res.status(400).json({
        success: false,
        error: `Credential with ID ${credentialId} not found in database`,
      });
      return;
    }

    const encryptedData = credentialResult.rows[0].encrypted_data;
    const credentialJson = decryptCredential(encryptedData, String(userId));

    const result = await metaAdapter.sync({
      accessToken,
      accountId,
      targetDate,
      spreadsheetId,
      sheetName,
    }, credentialJson);

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
 * Direct GA4 sync (bypasses queue) - DEPRECATED
 * POST /api/v1/sync/ga4/direct
 */
app.post('/api/v1/sync/ga4/direct', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  res.status(400).json({
    success: false,
    error: 'This endpoint is deprecated. Please use the new authenticated GA4 endpoints: POST /api/ga4/sync',
  });
});

/**
 * Direct Shopify sync (bypasses queue)
 * POST /api/v1/sync/shopify/direct
 */
app.post('/api/v1/sync/shopify/direct', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { storeDomain, accessToken, spreadsheetId, sheetName, targetDate } = req.body || {};
    const userId = req.user!.userId;

    if (!storeDomain || !accessToken) {
      res.status(400).json({
        success: false,
        error: 'storeDomain and accessToken are required',
      });
      return;
    }

    // Dynamically import database functions
    const { executeQuery } = await import('../lib/database.js');
    const { decryptCredential } = await import('../lib/encryption.js');

    // Fetch the credential from the database
    const serviceConfigResult = await executeQuery(
      `SELECT credential_id FROM service_configs
       WHERE service = 'shopify' AND user_id = $1 AND enabled = true
       LIMIT 1`,
      [userId],
      userId
    );

    if (serviceConfigResult.rows.length === 0 || !serviceConfigResult.rows[0].credential_id) {
      res.status(400).json({
        success: false,
        error: 'No enabled Shopify service configuration found. Please configure credentials in the dashboard.',
      });
      return;
    }

    const credentialId = serviceConfigResult.rows[0].credential_id;
    const credentialResult = await executeQuery(
      `SELECT encrypted_data FROM credentials
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [credentialId, userId],
      userId
    );

    if (credentialResult.rows.length === 0) {
      res.status(400).json({
        success: false,
        error: `Credential with ID ${credentialId} not found in database`,
      });
      return;
    }

    const encryptedData = credentialResult.rows[0].encrypted_data;
    const credentialJson = decryptCredential(encryptedData, String(userId));

    const result = await shopifyAdapter.sync({
      storeDomain,
      accessToken,
      targetDate,
      spreadsheetId,
      sheetName,
    }, credentialJson);

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
 * List spreadsheets - DEPRECATED: Use /api/sheets/spreadsheets with authentication instead
 */
app.get('/api/spreadsheets', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    // This endpoint should not be used - users should use authenticated endpoint
    // For backward compatibility, we'll return an error directing to use the new endpoint
    res.status(400).json({
      success: false,
      error: 'This endpoint is deprecated. Please use authenticated endpoint: GET /api/sheets/spreadsheets with credential_id parameter',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get sheet names - DEPRECATED: Use /api/sheets/:spreadsheetId/sheets with authentication instead
 */
app.get('/api/sheets/:spreadsheetId', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    // This endpoint should not be used - users should use authenticated endpoint
    res.status(400).json({
      success: false,
      error: 'This endpoint is deprecated. Please use authenticated endpoint: GET /api/sheets/:spreadsheetId/sheets with credential_id parameter',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Read sheet data - DEPRECATED: Use /api/sheets/:spreadsheetId/values with authentication instead
 */
app.get('/api/data/:spreadsheetId/:sheetName', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    // This endpoint should not be used - users should use authenticated endpoint
    res.status(400).json({
      success: false,
      error: 'This endpoint is deprecated. Please use authenticated endpoint: GET /api/sheets/:spreadsheetId/values with credential_id and sheetName parameters',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Read raw sheet values (including header row) - DEPRECATED: Use /api/sheets/:spreadsheetId/values with authentication instead
 * Returns a 2D array exactly as stored in the sheet
 */
app.get('/api/data/raw/:spreadsheetId/:sheetName', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    // This endpoint should not be used - users should use authenticated endpoint
    res.status(400).json({
      success: false,
      error: 'This endpoint is deprecated. Please use authenticated endpoint: GET /api/sheets/:spreadsheetId/values with credential_id and sheetName parameters',
    });
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
app.post('/api/meta/fetch', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { accessToken, spreadsheetId, sheetName } = req.body || {};
    const userId = req.user!.userId;

    if (!accessToken) {
      res.status(400).json({
        success: false,
        error: 'Access token is required',
      });
      return;
    }

    // Dynamically import database functions
    const { executeQuery } = await import('../lib/database.js');
    const { decryptCredential } = await import('../lib/encryption.js');

    // Fetch the credential from the database
    const serviceConfigResult = await executeQuery(
      `SELECT credential_id FROM service_configs
       WHERE service = 'meta' AND user_id = $1 AND enabled = true
       LIMIT 1`,
      [userId],
      userId
    );

    if (serviceConfigResult.rows.length === 0 || !serviceConfigResult.rows[0].credential_id) {
      res.status(400).json({
        success: false,
        error: 'No enabled Meta service configuration found. Please configure credentials in the dashboard.',
      });
      return;
    }

    const credentialId = serviceConfigResult.rows[0].credential_id;
    const credentialResult = await executeQuery(
      `SELECT encrypted_data FROM credentials
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [credentialId, userId],
      userId
    );

    if (credentialResult.rows.length === 0) {
      res.status(400).json({
        success: false,
        error: `Credential with ID ${credentialId} not found in database`,
      });
      return;
    }

    const encryptedData = credentialResult.rows[0].encrypted_data;
    const credentialJson = decryptCredential(encryptedData, String(userId));

    const result = await metaInsightsWorkflow.runWorkflow(accessToken, {
      spreadsheetId: spreadsheetId || undefined,
      sheetName: sheetName || undefined,
    }, credentialJson);

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
app.post('/api/shopify/fetch', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { storeDomain, accessToken, spreadsheetId, sheetName } = req.body || {};
    const userId = req.user!.userId;

    if (!storeDomain || !accessToken) {
      res.status(400).json({
        success: false,
        error: 'storeDomain and accessToken are required',
      });
      return;
    }

    // Dynamically import database functions
    const { executeQuery } = await import('../lib/database.js');
    const { decryptCredential } = await import('../lib/encryption.js');

    // Fetch the credential from the database
    const serviceConfigResult = await executeQuery(
      `SELECT credential_id FROM service_configs
       WHERE service = 'shopify' AND user_id = $1 AND enabled = true
       LIMIT 1`,
      [userId],
      userId
    );

    if (serviceConfigResult.rows.length === 0 || !serviceConfigResult.rows[0].credential_id) {
      res.status(400).json({
        success: false,
        error: 'No enabled Shopify service configuration found. Please configure credentials in the dashboard.',
      });
      return;
    }

    const credentialId = serviceConfigResult.rows[0].credential_id;
    const credentialResult = await executeQuery(
      `SELECT encrypted_data FROM credentials
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [credentialId, userId],
      userId
    );

    if (credentialResult.rows.length === 0) {
      res.status(400).json({
        success: false,
        error: `Credential with ID ${credentialId} not found in database`,
      });
      return;
    }

    const encryptedData = credentialResult.rows[0].encrypted_data;
    const credentialJson = decryptCredential(encryptedData, String(userId));

    const result = await shopifyWorkflow.runWorkflow(storeDomain, accessToken, {
      spreadsheetId: spreadsheetId || undefined,
      sheetName: sheetName || undefined,
    }, credentialJson);

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
 * Legacy Google Analytics fetch - DEPRECATED
 */
app.post('/api/google/fetch', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  res.status(400).json({
    success: false,
    error: 'This endpoint is deprecated. Please use the new authenticated GA4 endpoints: POST /api/ga4/sync',
  });
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

  // Initialize database
  if (process.env.DB_ENABLED !== 'false') {
    try {
      await initializeDatabase();
      logger.info('Database initialized');
    } catch (error) {
      logger.warn('Database initialization failed - credential management will be unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

    console.log('📡 API ENDPOINTS BY MODULE:');
    console.log('');

    console.log('🔒 Authentication & Authorization:');
    console.log('   Health Check:              GET  /api/health');
    console.log('   Initialize:                GET  /api/init');

    console.log('');
    console.log('👤 User & Onboarding:');
    console.log('   Get User Status:           GET  /api/user/status');
    console.log('   Complete Onboarding:       POST /api/user/onboarding/complete');
    console.log('   Reset Onboarding:          POST /api/user/onboarding/reset');

    console.log('');
    console.log('🔐 Credential Management:');
    console.log('   Save Credential:           POST /api/credentials/save');
    console.log('   List Credentials:          GET  /api/credentials/list');
    console.log('   Get Credential:            GET  /api/credentials/:credentialId');
    console.log('   Update Credential:         PUT  /api/credentials/:credentialId');
    console.log('   Delete Credential:         DELETE /api/credentials/:credentialId');
    console.log('   Verify Credential:         POST /api/credentials/:credentialId/verify');
    console.log('   Verify Status:             GET  /api/credentials/:credentialId/verify-status');

    console.log('');
    console.log('⚙️  Service Configuration:');
    console.log('   Enable Service:            POST /api/services/:serviceName/enable');
    console.log('   Disable Service:           POST /api/services/:serviceName/disable');
    console.log('   List Services:             GET  /api/services');

    console.log('');
    console.log('🗺️  Sheet Mappings:');
    console.log('   Set Sheet Mapping:         POST /api/sheet-mappings/set');
    console.log('   List Sheet Mappings:       GET  /api/sheet-mappings');

    console.log('');
    console.log('⏰ Automation & Schedules:');
    console.log('   List Schedules:            GET  /api/schedules');
    console.log('   Update Schedule:           PUT  /api/schedules/:service');
    console.log('   Run Manual Sync:           POST /api/schedules/:service/run');

    console.log('');
    console.log('📜 Activity & Audit Logs:');
    console.log('   Get Activity Log:          GET  /api/activity-log');
    console.log('   Get Log Stats:             GET  /api/activity-log/stats');

    console.log('');
    console.log('🔄 Sync Operations (v1):');
    console.log('   Sync All Sources:          POST /api/v1/sync/all');
    console.log('   Sync Meta:                 POST /api/v1/sync/meta');
    console.log('   Sync GA4:                  POST /api/v1/sync/ga4');
    console.log('   Sync Shopify:              POST /api/v1/sync/shopify');
    console.log('   Direct Meta Sync:          POST /api/v1/sync/meta/direct');
    console.log('   Direct GA4 Sync:           POST /api/v1/sync/ga4/direct');
    console.log('   Direct Shopify Sync:       POST /api/v1/sync/shopify/direct');

    console.log('');
    console.log('📋 Job Management:');
    console.log('   Get Job Status:            GET  /api/v1/jobs/:jobId');
    console.log('   Queue Stats:               GET  /api/v1/queue/stats');

    console.log('');
    console.log('⏰ Scheduler (Legacy):');
    console.log('   Scheduler Status:          GET  /api/v1/scheduler/status');
    console.log('   Start Scheduler:           POST /api/v1/scheduler/start');
    console.log('   Stop Scheduler:            POST /api/v1/scheduler/stop');
    console.log('   Trigger Manual Sync:       POST /api/v1/scheduler/trigger');

    console.log('');
    console.log('💬 Notifications:');
    console.log('   Test Notifications:        POST /api/v1/notifications/test');

    console.log('');
    console.log('📊 Google Analytics 4:');
    console.log('   GA4 Sync:                  POST /api/ga4/sync');

    console.log('');
    console.log('📊 Legacy Google Sheets:');
    console.log('   List Spreadsheets:         GET  /api/spreadsheets');
    console.log('   Get Sheet Names:           GET  /api/sheets/:spreadsheetId');
    console.log('   Read Sheet Data:           GET  /api/data/:spreadsheetId/:sheetName');
    console.log('   Read Raw Sheet Values:     GET  /api/data/raw/:spreadsheetId/:sheetName');

    console.log('');
    console.log('🔄 Legacy Sync Operations:');
    console.log('   Legacy Meta Fetch:         POST /api/meta/fetch');
    console.log('   Legacy Shopify Fetch:      POST /api/shopify/fetch');
    console.log('   Legacy GA Fetch:           POST /api/google/fetch (DEPRECATED)');

    console.log('');
    console.log('💡 Note: All authenticated endpoints require Clerk JWT token');
    console.log('💡 Note: Legacy endpoints are deprecated and will be removed');
    console.log('');
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  scheduler.stop();
  await etlWorker.stop();
  await etlQueue.close();
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  scheduler.stop();
  await etlWorker.stop();
  await etlQueue.close();
  await closeDatabase();
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
