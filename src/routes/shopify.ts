/**
 * Shopify Analytics Routes
 *
 * Handles Shopify data fetching and appending to Google Sheets
 * These endpoints use stored credentials for authentication
 *
 * Security:
 * - All endpoints require JWT authentication
 * - All credential access is filtered by user_id
 * - Credentials are decrypted only for the operation
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { shopifyService } from '../services/shopify.service.js';
import { logger } from '../lib/logger.js';
import {
  ErrorResponse,
  ErrorCode,
  ShopifySyncResponse,
  ShopifySyncRequest
} from '../types/api.js';
import type { AppendResult } from '../services/meta.js';

function normalizeAppendResult(appendResult: AppendResult): {
  mode: 'append' | 'skip';
  success: true; rowNumber: number; id: number;
} | { mode: 'append' | 'skip'; success: false; error: string } {
  const mode: 'append' | 'skip' = appendResult.mode === 'skip' ? 'skip' : 'append';

  if (appendResult.success) {
    return {
      mode,
      success: true,
      rowNumber: appendResult.rowNumber ?? 0,
      id: appendResult.id ?? 0,
    };
  }

  return {
    mode,
    success: false,
    error: appendResult.error ?? 'Unknown append error',
  };
}

const router = Router();

// ============================================================================
// POST /api/shopify/sync
// Fetch Shopify data and append to Google Sheet
// Body: { credentialId: number, options?: { spreadsheetId?: string, sheetName?: string } }
// ============================================================================

router.post('/sync', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const { credentialId, options }: ShopifySyncRequest = req.body;

    // Validate required fields
    if (!credentialId) {
      res.status(400).json({
        error: 'credentialId is required',
        code: ErrorCode.MISSING_FIELDS,
      } as ErrorResponse);
      return;
    }

    // Validate credentialId is a number
    const credentialIdNum = Number(credentialId);
    if (!Number.isFinite(credentialIdNum)) {
      res.status(400).json({
        error: 'credentialId must be a number',
        code: ErrorCode.VALIDATION_ERROR,
      } as ErrorResponse);
      return;
    }

    logger.info('Shopify sync requested', {
      userId: req.user!.userId,
      credentialId: credentialIdNum,
      options
    });

    // Run Shopify workflow
    const result = await shopifyService.runWorkflow(credentialIdNum, req.user!.userId, options);

    const response: ShopifySyncResponse = {
      success: true,
      data: {
        metrics: result.metrics,
        appendResult: normalizeAppendResult(result.appendResult),
        spreadsheetId: result.spreadsheetId,
        sheetName: result.sheetName,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Shopify sync failed', {
      userId: req.user?.userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during Shopify sync',
      code: ErrorCode.SERVICE_ERROR,
    } as ErrorResponse);
  }
});

// ============================================================================
// POST /api/shopify/sync/yesterday
// Fetch yesterday's Shopify data and append to Google Sheet
// Body: { credentialId: number, options?: { spreadsheetId?: string, sheetName?: string } }
// ============================================================================

router.post('/sync/yesterday', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const { credentialId, options }: ShopifySyncRequest = req.body;

    // Validate required fields
    if (!credentialId) {
      res.status(400).json({
        error: 'credentialId is required',
        code: ErrorCode.MISSING_FIELDS,
      } as ErrorResponse);
      return;
    }

    // Validate credentialId is a number
    const credentialIdNum = Number(credentialId);
    if (!Number.isFinite(credentialIdNum)) {
      res.status(400).json({
        error: 'credentialId must be a number',
        code: ErrorCode.VALIDATION_ERROR,
      } as ErrorResponse);
      return;
    }

    logger.info('Shopify sync yesterday requested', {
      userId: req.user!.userId,
      credentialId: credentialIdNum,
      options
    });

    // Run Shopify workflow
    const result = await shopifyService.runWorkflow(credentialIdNum, req.user!.userId, options);

    const response: ShopifySyncResponse = {
      success: true,
      data: {
        metrics: result.metrics,
        appendResult: normalizeAppendResult(result.appendResult),
        spreadsheetId: result.spreadsheetId,
        sheetName: result.sheetName,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Shopify sync yesterday failed', {
      userId: req.user?.userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during Shopify sync',
      code: ErrorCode.SERVICE_ERROR,
    } as ErrorResponse);
  }
});

export default router;