/**
 * Sheets Routes with Credential Support
 *
 * Handles Google Sheets operations using either stored credentials or global service account.
 * These endpoints can accept a credential_id parameter to use specific stored credentials
 * instead of the global environment-based service account.
 *
 * Security:
 * - All endpoints require JWT authentication
 * - All credential access is filtered by user_id
 * - Credentials are decrypted only for the operation
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { executeQuery } from '../lib/database.js';
import { decryptCredential } from '../lib/encryption.js';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { logger } from '../lib/logger.js';
import { SheetMetadata } from '../types/kpi.js';
import { ErrorResponse, ErrorCode } from '../types/api.js';
import { sheetsService } from '../services/sheets.js'; // Import the global sheets service for fallback

const router = Router();

/**
 * Initialize Google Sheets service with specific stored credential
 */
async function initializeSheetServiceWithCredential(credentialId: number, userId: number) {
  // Fetch the encrypted credential
  const result = await executeQuery(
    `
    SELECT encrypted_data, service
    FROM credentials
    WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
    `,
    [credentialId, userId],
    userId
  );

  if (result.rows.length === 0) {
    throw new Error('Credential not found or access denied');
  }

  const credential = result.rows[0];

  // Decrypt the credential
  const decryptedJson = decryptCredential(credential.encrypted_data, String(userId));
  const credentialData = JSON.parse(decryptedJson);

  // Validate it's a Google Sheets credential
  if (credential.service !== 'google_sheets') {
    throw new Error('Credential is not for Google Sheets');
  }

  // Initialize Google Sheets authentication
  const auth = new JWT({
    email: credentialData.client_email,
    key: credentialData.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  // Pass the auth client to google APIs - cast to any to avoid type mismatch
  const sheets = google.sheets({ version: 'v4', auth: auth as any });
  const drive = google.drive({ version: 'v3', auth: auth as any });

  await auth.authorize();

  return { sheets, drive, serviceAccountEmail: credentialData.client_email };
}

// ============================================================================
// GET /api/sheets/spreadsheets
// Get spreadsheets using stored credential (if provided) or global service account
// Query parameter: credential_id (optional)
// ============================================================================

router.get('/spreadsheets', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const { credential_id } = req.query;

    if (credential_id) {
      // Use stored credential
      const credentialId = parseInt(credential_id as string);
      if (isNaN(credentialId)) {
        res.status(400).json({
          error: 'credential_id must be a number',
          code: ErrorCode.INVALID_JSON,
        } as ErrorResponse);
        return;
      }

      // Initialize sheets service with the stored credential
      const { drive } = await initializeSheetServiceWithCredential(credentialId, req.user!.userId);

      // List spreadsheets accessible by this credential
      const driveResponse = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        spaces: 'drive',
        fields: 'files(id, name)',
        pageSize: 100,
      });

      const spreadsheets = (driveResponse.data.files || []).map((file) => ({
        id: file.id || '',
        name: file.name || '',
        sheetId: 0, // This field might not be relevant for top-level spreadsheets
      }));

      res.json({ success: true, data: spreadsheets });
    } else {
      // Use global service account (legacy behavior)
      const spreadsheets = await sheetsService.listSpreadsheets();
      res.json({ success: true, data: spreadsheets });
    }
  } catch (error) {
    logger.error('Failed to list spreadsheets', { error: String(error) });

    // If it's the credential initialization error, return a more specific error
    if (error instanceof Error && error.message.includes('service account credentials not configured')) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

// ============================================================================
// GET /api/sheets/:spreadsheetId/sheets
// Get sheet names within a spreadsheet using stored credential or global service account
// Query parameter: credential_id (optional)
// ============================================================================

router.get('/:spreadsheetId/sheets', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const { spreadsheetId } = req.params;
    const { credential_id } = req.query;

    if (!spreadsheetId) {
      res.status(400).json({
        error: 'spreadsheetId is required',
        code: ErrorCode.MISSING_FIELDS,
      } as ErrorResponse);
      return;
    }

    if (credential_id) {
      // Use stored credential
      const credentialId = parseInt(credential_id as string);
      if (isNaN(credentialId)) {
        res.status(400).json({
          error: 'credential_id must be a number',
          code: ErrorCode.INVALID_JSON,
        } as ErrorResponse);
        return;
      }

      // Initialize sheets service with the stored credential
      const { sheets } = await initializeSheetServiceWithCredential(credentialId, req.user!.userId);

      // Get sheet names within the spreadsheet
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheetsMetadata: SheetMetadata[] = (response.data.sheets || []).map((sheet) => ({
        id: spreadsheetId,
        name: sheet.properties?.title || '',
        sheetId: sheet.properties?.sheetId || 0,
      }));

      res.json({ success: true, data: sheetsMetadata });
    } else {
      // Use global service account (legacy behavior)
      const sheets = await sheetsService.getSheetNames(spreadsheetId);
      res.json({ success: true, data: sheets });
    }
  } catch (error) {
    logger.error('Failed to get sheet names', {
      error: String(error),
      spreadsheetId: req.params.spreadsheetId
    });

    // If it's the credential initialization error, return a more specific error
    if (error instanceof Error && error.message.includes('service account credentials not configured')) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

export default router;