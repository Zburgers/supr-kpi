/**
 * Service Configuration Routes
 * 
 * Handles:
 * - Enabling/disabling services
 * - Linking credentials to services
 * - Listing service configurations
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
  EnableServiceRequest,
  EnableServiceResponse,
  DisableServiceResponse,
  ListServicesResponse,
  ErrorResponse,
  ErrorCode,
} from '../types/api.js';

const router = Router();

const VALID_SERVICES = ['google_sheets', 'meta', 'ga4', 'shopify'];

// ============================================================================
// POST /api/services/:serviceName/enable
// ============================================================================

router.post(
  '/:serviceName/enable',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    try {
      const { serviceName } = req.params;
      const { credentialId } = req.body as EnableServiceRequest;

      // Validate service
      if (!VALID_SERVICES.includes(serviceName)) {
        res.status(400).json({
          error: `Invalid service: ${serviceName}`,
          code: ErrorCode.INVALID_SERVICE,
        } as ErrorResponse);
        return;
      }

      // Validate credential ID provided
      if (!credentialId) {
        res.status(400).json({
          error: 'credentialId is required',
          code: ErrorCode.MISSING_FIELDS,
        } as ErrorResponse);
        return;
      }

      // Verify credential exists and belongs to user
      const credResult = await executeQuery(
        `SELECT id FROM credentials WHERE id = $1 AND deleted_at IS NULL;`,
        [credentialId],
        req.user!.userId
      );

      if (credResult.rows.length === 0) {
        res.status(404).json({
          error: 'Credential not found',
          code: ErrorCode.CREDENTIAL_NOT_FOUND,
        } as ErrorResponse);
        return;
      }

      // Insert or update service config
      const result = await executeQuery(
        `
        INSERT INTO service_configs (user_id, service, credential_id, enabled)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (user_id, service) DO UPDATE
        SET credential_id = $3, enabled = true, updated_at = CURRENT_TIMESTAMP
        RETURNING service, enabled, credential_id;
        `,
        [req.user!.userId, serviceName, credentialId],
        req.user!.userId
      );

      if (result.rows.length === 0) {
        res.status(500).json({
          error: 'Failed to enable service',
          code: ErrorCode.DATABASE_ERROR,
        } as ErrorResponse);
        return;
      }

      const config = result.rows[0];

      // Log audit
      await logAudit(req.user!.userId, 'service_enabled', serviceName, 'success', undefined, {
        credentialId: config.credential_id,
      });

      const response: EnableServiceResponse = {
        service: config.service,
        enabled: config.enabled,
        credentialId: config.credential_id,
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to enable service', { error: String(error) });
      await logAudit(
        req.user!.userId,
        'service_enabled',
        req.params.serviceName,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );

      res.status(500).json({
        error: 'Failed to enable service',
        code: ErrorCode.SERVICE_ERROR,
      } as ErrorResponse);
    }
  }
);

// ============================================================================
// POST /api/services/:serviceName/disable
// ============================================================================

router.post(
  '/:serviceName/disable',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!requireAuth(req, res)) return;

    try {
      const { serviceName } = req.params;

      // Validate service
      if (!VALID_SERVICES.includes(serviceName)) {
        res.status(400).json({
          error: `Invalid service: ${serviceName}`,
          code: ErrorCode.INVALID_SERVICE,
        } as ErrorResponse);
        return;
      }

      // Disable service
      const result = await executeQuery(
        `
        UPDATE service_configs
        SET enabled = false, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND service = $2
        RETURNING service, enabled;
        `,
        [req.user!.userId, serviceName],
        req.user!.userId
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Service not configured',
          code: ErrorCode.SERVICE_NOT_FOUND,
        } as ErrorResponse);
        return;
      }

      const config = result.rows[0];

      // Log audit
      await logAudit(req.user!.userId, 'service_disabled', serviceName, 'success');

      const response: DisableServiceResponse = {
        service: config.service,
        enabled: config.enabled,
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to disable service', { error: String(error) });
      await logAudit(
        req.user!.userId,
        'service_disabled',
        req.params.serviceName,
        'failure',
        error instanceof Error ? error.message : 'Unknown error'
      );

      res.status(500).json({
        error: 'Failed to disable service',
        code: ErrorCode.SERVICE_ERROR,
      } as ErrorResponse);
    }
  }
);

// ============================================================================
// GET /api/services
// ============================================================================

router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  try {
    const result = await executeQuery(
      `
      SELECT 
        sc.service,
        sc.enabled,
        sc.credential_id,
        c.name,
        c.verified
      FROM service_configs sc
      LEFT JOIN credentials c ON sc.credential_id = c.id
      WHERE sc.user_id = $1
      ORDER BY sc.service;
      `,
      [req.user!.userId],
      req.user!.userId
    );

    const services = result.rows.map(row => ({
      name: row.service,
      enabled: row.enabled,
      credential: row.credential_id
        ? {
            id: row.credential_id,
            name: row.name,
            verified: row.verified,
          }
        : undefined,
    }));

    // Add unconfigured services
    const configuredServices = services.map(s => s.name);
    for (const service of VALID_SERVICES) {
      if (!configuredServices.includes(service)) {
        services.push({
          name: service,
          enabled: false,
          credential: undefined,
        });
      }
    }

    // Sort by name
    services.sort((a, b) => a.name.localeCompare(b.name));

    const response: ListServicesResponse = { services };
    res.json(response);
  } catch (error) {
    logger.error('Failed to list services', { error: String(error) });

    res.status(500).json({
      error: 'Failed to list services',
      code: ErrorCode.DATABASE_ERROR,
    } as ErrorResponse);
  }
});

export default router;
