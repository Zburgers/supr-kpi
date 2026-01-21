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
import swaggerUi from 'swagger-ui-express';

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

// TSOA generated routes
import { RegisterRoutes } from '../generated/routes.js';

// Legacy credential management routes (for backward compatibility)
import credentialRoutes from '../routes/credentials.js';
import serviceRoutes from '../routes/services.js';
import sheetRoutes from '../routes/sheets.js';
import sheetExternalRoutes from '../routes/sheets-external.js';
import ga4Routes from '../routes/ga4.js';
import shopifyRoutes from '../routes/shopify.js';
import metaRoutes from '../routes/meta.js';
import userRoutes from '../routes/user.js';
import scheduleRoutes from '../routes/schedules.js';
import activityLogRoutes from '../routes/activity-log.js';
import discordNotificationRoutes from '../routes/discord-notifications.js';

// Queue system
import { etlQueue } from '../lib/queue.js';
import { etlWorker } from '../lib/worker.js';
import { scheduler } from '../lib/scheduler.js';
import { notifier } from '../lib/notifier.js';

// Adapters
import { metaAdapter } from '../adapters/meta.adapter.js';
import { ga4Adapter } from '../adapters/ga4.adapter.js';
import { shopifyAdapter } from '../adapters/shopify.adapter.js';

// Services
import { sheetsService } from '../services/sheets.js';
import { metaService, META_SPREADSHEET_ID, META_SHEET_NAME } from '../services/meta.service.js';
import { shopifyService, SHOPIFY_SPREADSHEET_ID, SHOPIFY_SHEET_NAME } from '../services/shopify.service.js';
import { ga4Service } from '../services/ga4.service.js';

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
    query: req.query, // Logger will now redact sensitive query params
  });
  next();
});

// ============================================================================
// TSOA AUTO-GENERATED ROUTES & SWAGGER DOCS
// ============================================================================

// Register TSOA auto-generated routes (new documentation approach)
RegisterRoutes(app);

// Serve Swagger UI for TSOA-generated OpenAPI spec
app.use('/api/docs', swaggerUi.serve, async (_req: Request, res: Response) => {
  try {
    // Use fs to read the swagger.json file
    const fs = await import('fs/promises');
    const swaggerPath = path.join(__dirname, '../../dist/swagger.json');
    const swaggerContent = await fs.readFile(swaggerPath, 'utf-8');
    const swaggerDocument = JSON.parse(swaggerContent);
    return res.send(swaggerUi.generateHTML(swaggerDocument));
  } catch (error) {
    // Fallback: serve basic HTML if import fails
    return res.send(`
      <html>
        <head><title>API Docs</title></head>
        <body>
          <h1>OpenAPI Documentation</h1>
          <p>Swagger JSON available at <a href="/api/docs.json">/api/docs.json</a></p>
          <p>Error loading Swagger UI: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </body>
      </html>
    `);
  }
});

// Serve raw OpenAPI JSON spec
app.get('/api/docs.json', async (_req: Request, res: Response) => {
  try {
    const fs = await import('fs/promises');
    const swaggerPath = path.join(__dirname, '../../dist/swagger.json');
    const swaggerContent = await fs.readFile(swaggerPath, 'utf-8');
    const swaggerDocument = JSON.parse(swaggerContent);
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerDocument);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load OpenAPI spec' });
  }
});

// ============================================================================
// LEGACY ROUTES (for backward compatibility - will be migrated to TSOA)
// ============================================================================
// Routes for managing encrypted credentials and services

// Note: These legacy routes are kept for backward compatibility
// TSOA controllers now handle: /api/credentials, /api/services, /api/user
// The following use legacy routers until fully migrated:
app.use('/api/sheet-mappings', authenticate, sheetRoutes);
app.use('/api/sheets', authenticate, sheetExternalRoutes);
app.use('/api/ga4', authenticate, ga4Routes);
app.use('/api/shopify', authenticate, shopifyRoutes);
app.use('/api/meta', authenticate, metaRoutes);
app.use('/api/schedules', authenticate, scheduleRoutes);
app.use('/api/activity-log', authenticate, activityLogRoutes);
app.use('/api/discord', authenticate, discordNotificationRoutes);

// ============================================================================
// LEGACY ENDPOINTS - NOT YET MIGRATED TO TSOA
// ============================================================================
// Note: The following endpoints are handled by TSOA controllers and removed from here:
// - /api/health (HealthController)
// - /api/v1/queue/stats (HealthController)
// - /api/v1/jobs/:jobId (SyncController)
// - /api/v1/sync/* (SyncController)
// - /api/credentials/* (CredentialController)
// - /api/services/* (ServiceController)
// - /api/user/* (UserController)
// - /api/v1/scheduler/* (SchedulerController)
// - /api/v1/notifications/* (NotificationController)

// ============================================================================
// DIRECT SYNC ENDPOINTS (bypass queue - for testing/debugging)
// These will be migrated to TSOA in a future update
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
  const sunset = '2025-02-01T00:00:00Z';
  const migrationUrl = 'https://pegasus.nakshatraneuratech.dev/docs/ga4-migration';

  logger.warn('Deprecated endpoint called: /api/v1/sync/ga4/direct', {
    userId: req.user?.userId,
    path: req.path,
  });

  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', sunset);
  res.setHeader('Link', `<${migrationUrl}>; rel="deprecation"`);

  res.status(410).json({
    success: false,
    error: 'This endpoint is deprecated and will be removed after the sunset date.',
    message: 'Use POST /api/ga4/sync with stored credentials instead of /api/v1/sync/ga4/direct.',
    sunset,
    docs: migrationUrl,
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

// ============================================================================
// SCHEDULER CONTROL ENDPOINTS - NOW HANDLED BY TSOA SchedulerController
// These legacy endpoints are removed - use TSOA-generated routes instead
// ============================================================================

// ============================================================================
// NOTIFICATION TEST ENDPOINTS - NOW HANDLED BY TSOA NotificationController
// These legacy endpoints are removed - use TSOA-generated routes instead
// ============================================================================

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
      await scheduler.start();
      logger.info('⏰ Enhanced scheduler started successfully');
      console.log('⏰ Enhanced scheduler started successfully');
      console.log('   📅 User-specific schedules will run automatically based on individual configurations');
      console.log('   🔄 Manual syncs can be triggered via /api/schedules/:service/run');
    } catch (error) {
      logger.error('❌ Scheduler start failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      console.error('❌ Scheduler start failed:', error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log('⏰ Scheduler is disabled (ENABLE_SCHEDULER=false)');
    console.log('   📅 User-specific schedules will NOT run automatically');
    console.log('   🔄 Manual syncs can still be triggered via /api/schedules/:service/run');
  }

  // Start HTTP server
  app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📊 Open http://localhost:${PORT} in browser`);
    console.log('='.repeat(60) + '\n');

    console.log('📡 ACTIVE API ENDPOINTS BY MODULE:');
    console.log('');

    console.log('🔒 Authentication & System:');
    console.log('   Health Check:              GET  /api/health');

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
    console.log('📊 Google Sheets Operations:');
    console.log('   List Spreadsheets:         GET  /api/sheets/spreadsheets');
    console.log('   Get Sheet Names:           GET  /api/sheets/:spreadsheetId/sheets');

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
    console.log('🔄 Data Sync Operations:');
    console.log('   Sync All Sources:          POST /api/v1/sync/all');
    console.log('   Sync Meta:                 POST /api/v1/sync/meta');
    console.log('   Sync GA4:                  POST /api/v1/sync/ga4');
    console.log('   Sync Shopify:              POST /api/v1/sync/shopify');
    console.log('   Direct Meta Sync:          POST /api/v1/sync/meta/direct');
    console.log('   Direct Shopify Sync:       POST /api/v1/sync/shopify/direct');

    console.log('');
    console.log('📋 Job & Queue Management:');
    console.log('   Get Job Status:            GET  /api/v1/jobs/:jobId');
    console.log('   Queue Stats:               GET  /api/v1/queue/stats');

    console.log('');
    console.log('📊 Service-Specific Sync Endpoints:');
    console.log('   Meta Sync:                 POST /api/meta/sync');
    console.log('   GA4 Sync:                  POST /api/ga4/sync');
    console.log('   GA4 Yesterday Sync:        POST /api/ga4/sync/yesterday');
    console.log('   Shopify Sync:              POST /api/shopify/sync');
    console.log('   Shopify Yesterday Sync:    POST /api/shopify/sync/yesterday');

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
