/**
 * Service Controller
 * 
 * Handles service configuration operations:
 * - Enable/disable services
 * - Link credentials to services
 * - List service configurations
 */

import {
  Controller,
  Get,
  Post,
  Route,
  Path,
  Body,
  Tags,
  Security,
  Response,
  Request,
} from 'tsoa';
import * as express from 'express';
import { executeQuery } from '../lib/database.js';
import { logAudit } from '../lib/audit-log.js';
import { logger } from '../lib/logger.js';
import { AuthenticatedUser } from '../authentication.js';
import {
  ErrorResponse,
  EnableServiceRequest,
  EnableServiceResponse,
  DisableServiceResponse,
  ServiceItem,
  ListServicesResponse,
} from './models.js';

const VALID_SERVICES = ['google_sheets', 'meta', 'ga4', 'shopify'];

@Route('api/services')
@Tags('Services')
@Security('jwt')
export class ServiceController extends Controller {
  /**
   * List all services and their configurations
   */
  @Get()
  @Response<ErrorResponse>(500, 'Internal error')
  public async listServices(
    @Request() request: express.Request
  ): Promise<ListServicesResponse> {
    const user = request.user as AuthenticatedUser;

    // Auto-enable services for credentials that don't have service_configs
    await executeQuery(
      `INSERT INTO service_configs (user_id, service, credential_id, enabled)
       SELECT c.user_id, c.service, c.id, true
       FROM credentials c
       WHERE c.user_id = $1 
         AND c.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM service_configs sc 
           WHERE sc.user_id = c.user_id AND sc.service = c.service
         )
       ON CONFLICT (user_id, service) DO NOTHING;`,
      [user.userId],
      user.userId
    );

    const result = await executeQuery(
      `SELECT 
         sc.service,
         sc.enabled,
         sc.credential_id,
         c.name,
         c.verified
       FROM service_configs sc
       LEFT JOIN credentials c ON sc.credential_id = c.id
       WHERE sc.user_id = $1
       ORDER BY sc.service;`,
      [user.userId],
      user.userId
    );

    const services: ServiceItem[] = result.rows.map((row) => ({
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
    const configuredServices = services.map((s) => s.name);
    for (const service of VALID_SERVICES) {
      if (!configuredServices.includes(service)) {
        services.push({ name: service, enabled: false, credential: undefined });
      }
    }

    services.sort((a, b) => a.name.localeCompare(b.name));

    return { services };
  }

  /**
   * Enable a service with a credential
   */
  @Post('{serviceName}/enable')
  @Response<ErrorResponse>(400, 'Invalid request')
  @Response<ErrorResponse>(404, 'Not found')
  public async enableService(
    @Path() serviceName: string,
    @Body() body: EnableServiceRequest,
    @Request() request: express.Request
  ): Promise<EnableServiceResponse> {
    const user = request.user as AuthenticatedUser;
    const { credentialId } = body;

    if (!VALID_SERVICES.includes(serviceName)) {
      this.setStatus(400);
      throw new Error(`Invalid service: ${serviceName}`);
    }

    if (!credentialId) {
      this.setStatus(400);
      throw new Error('credentialId is required');
    }

    // Verify credential exists
    const credResult = await executeQuery(
      `SELECT id FROM credentials WHERE id = $1 AND deleted_at IS NULL;`,
      [credentialId],
      user.userId
    );

    if (credResult.rows.length === 0) {
      this.setStatus(404);
      throw new Error('Credential not found');
    }

    const result = await executeQuery(
      `INSERT INTO service_configs (user_id, service, credential_id, enabled)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (user_id, service) DO UPDATE
       SET credential_id = $3, enabled = true, updated_at = CURRENT_TIMESTAMP
       RETURNING service, enabled, credential_id;`,
      [user.userId, serviceName, credentialId],
      user.userId
    );

    if (result.rows.length === 0) {
      this.setStatus(500);
      throw new Error('Failed to enable service');
    }

    const config = result.rows[0];

    await logAudit(user.userId, 'service_enabled', serviceName, 'success', undefined, {
      credentialId: config.credential_id,
    });

    return {
      service: config.service,
      enabled: config.enabled,
      credentialId: config.credential_id,
    };
  }

  /**
   * Disable a service
   */
  @Post('{serviceName}/disable')
  @Response<ErrorResponse>(400, 'Invalid request')
  @Response<ErrorResponse>(404, 'Not found')
  public async disableService(
    @Path() serviceName: string,
    @Request() request: express.Request
  ): Promise<DisableServiceResponse> {
    const user = request.user as AuthenticatedUser;

    if (!VALID_SERVICES.includes(serviceName)) {
      this.setStatus(400);
      throw new Error(`Invalid service: ${serviceName}`);
    }

    const result = await executeQuery(
      `UPDATE service_configs
       SET enabled = false, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND service = $2
       RETURNING service, enabled;`,
      [user.userId, serviceName],
      user.userId
    );

    if (result.rows.length === 0) {
      this.setStatus(404);
      throw new Error('Service not configured');
    }

    const config = result.rows[0];

    await logAudit(user.userId, 'service_disabled', serviceName, 'success');

    return {
      service: config.service,
      enabled: config.enabled,
    };
  }
}
