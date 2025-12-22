/**
 * Sheet Mapping Routes
 *
 * Handles:
 * - Setting Google Sheets spreadsheet mappings
 * - Listing sheet mappings
 *
 * These mappings allow users to specify which spreadsheet and sheet
 * each service's data should be written to.
 *
 * Security:
 * - All endpoints require JWT authentication
 * - All queries filtered by user_id (RLS)
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { executeQuery } from '../lib/database.js';
import { logAudit } from '../lib/audit-log.js';
import { logger } from '../lib/logger.js';
import {
  SetSheetMappingRequest,
  SetSheetMappingResponse,
  ListSheetMappingsResponse,
  ErrorResponse,
  ErrorCode,
} from '../types/api.js';

const router = Router();

// ============================================================================
// POST /api/sheet-mappings/set
// ============================================================================

router.post('/set', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const { service, spreadsheetId, sheetName } = req.body as SetSheetMappingRequest;

    // Validate request
    if (!service || !spreadsheetId || !sheetName) {
      res.status(400).json({
        error: 'Missing required fields: service, spreadsheetId, sheetName',
        code: ErrorCode.MISSING_FIELDS,
      } as ErrorResponse);
      return;
    }

    // Validate service
    const validServices = ['google_sheets', 'meta', 'ga4', 'shopify'];
    if (!validServices.includes(service)) {
      res.status(400).json({
        error: `Invalid service: ${service}`,
        code: ErrorCode.INVALID_SERVICE,
      } as ErrorResponse);
      return;
    }

    // Keep a single mapping per service: delete then insert.
    await executeQuery(
      `
      DELETE FROM sheet_mappings
      WHERE user_id = $1 AND service = $2;
      `,
      [req.user!.userId, service],
      req.user!.userId
    );

    const result = await executeQuery(
      `
      INSERT INTO sheet_mappings (user_id, service, spreadsheet_id, sheet_name, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, service, spreadsheet_id, sheet_name, created_at, updated_at;
      `,
      [req.user!.userId, service, spreadsheetId, sheetName],
      req.user!.userId
    );

    if (result.rows.length === 0) {
      res.status(500).json({
        error: 'Failed to set sheet mapping',
        code: ErrorCode.DATABASE_ERROR,
      } as ErrorResponse);
      return;
    }

    const mapping = result.rows[0];

    // Log audit
    await logAudit(req.user!.userId, 'sheet_mapping_set', service, 'success', undefined, {
      spreadsheetId,
      sheetName,
    });

    const response: SetSheetMappingResponse = {
      id: mapping.id,
      service: mapping.service,
      spreadsheetId: mapping.spreadsheet_id,
      sheetName: mapping.sheet_name,
      createdAt: mapping.created_at,
      updatedAt: mapping.updated_at,
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Failed to set sheet mapping', { error: String(error) });
    await logAudit(
      req.user!.userId,
      'sheet_mapping_set',
      (req.body as any)?.service,
      'failure',
      error instanceof Error ? error.message : 'Unknown error'
    );

    res.status(500).json({
      error: 'Failed to set sheet mapping',
      code: ErrorCode.SERVICE_ERROR,
    } as ErrorResponse);
  }
});

// ============================================================================
// GET /api/sheet-mappings
// ============================================================================

router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const result = await executeQuery(
      `
      SELECT id, service, spreadsheet_id, sheet_name, created_at, updated_at
      FROM sheet_mappings
      WHERE user_id = $1
      ORDER BY service, spreadsheet_id;
      `,
      [req.user!.userId],
      req.user!.userId
    );

    const mappings = result.rows.map(row => ({
      id: row.id,
      service: row.service,
      spreadsheetId: row.spreadsheet_id,
      sheetName: row.sheet_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const response: ListSheetMappingsResponse = { mappings };
    res.json(response);
  } catch (error) {
    logger.error('Failed to list sheet mappings', { error: String(error) });

    res.status(500).json({
      error: 'Failed to list sheet mappings',
      code: ErrorCode.DATABASE_ERROR,
    } as ErrorResponse);
  }
});

export default router;
