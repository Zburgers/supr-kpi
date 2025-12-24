/**
 * Meta API Routes
 * 
 * Implements the same credential management pattern as GA4 and Shopify routes.
 * Uses stored encrypted credentials instead of passing raw credentials.
 * 
 * @module routes/meta
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { metaService } from '../services/meta.service.js';
import { logger } from '../lib/logger.js';
import { 
  SyncRequest,
  SyncResponse,
  ErrorResponse,
  ErrorCode
} from '../types/api.js';

const router = Router();

/**
 * POST /api/meta/sync
 * 
 * Sync Meta data using stored credentials
 * Requires authentication and valid credentialId
 */
router.post('/sync', authenticate, async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const userId = req.user!.userId;
    const { credentialId } = req.body as { credentialId: string | number };
    const options = req.body.options || {};
    const spreadsheetId = options.spreadsheetId;
    const sheetName = options.sheetName;

    logger.info('Meta sync requested', { userId, credentialId });

    if (!credentialId) {
      const errorResponse: ErrorResponse = {
        error: 'credentialId is required',
        code: ErrorCode.VALIDATION_ERROR
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Convert credentialId to number if it's a string
    const credentialIdNum = typeof credentialId === 'string' ? parseInt(credentialId, 10) : Number(credentialId);
    if (!Number.isFinite(credentialIdNum)) {
      res.status(400).json({
        error: 'credentialId must be a number',
        code: ErrorCode.VALIDATION_ERROR,
      });
      return;
    }

    // Run the Meta workflow using stored credentials
    const result = await metaService.runWorkflow(credentialIdNum, userId, {
      spreadsheetId,
      sheetName
    });

    const response: SyncResponse = {
      success: true,
      data: {
        service: 'meta',
        date: result.metrics.date,
        id: result.metrics.id || '', // UUID
        spreadsheetId: result.spreadsheetId,
        sheetName: result.sheetName,
        metrics: result.metrics,
        appendResult: result.appendResult.success
          ? {
              mode: result.appendResult.mode || 'append',
              success: true,
              rowNumber: result.appendResult.rowNumber || 0,
              id: result.appendResult.id || '',
            }
          : {
              mode: result.appendResult.mode || 'append',
              success: false,
              error: result.appendResult.error || 'Unknown error',
            }
      },
      message: result.appendResult.success
        ? `Meta insights for ${result.metrics.date} synced successfully`
        : `Meta sync completed but sheet write failed`
    };

    logger.info('Meta sync completed', { 
      userId, 
      credentialId, 
      success: response.success,
      date: result.metrics.date,
      id: result.metrics.id // UUID
    });

    res.json(response);
  } catch (error) {
    logger.error('Meta sync failed', { 
      userId: req.user?.userId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: ErrorCode.SERVICE_ERROR
    };

    res.status(500).json(errorResponse);
  }
});

export default router;