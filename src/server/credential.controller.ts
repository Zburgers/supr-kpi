/**
 * Credential API Controller
 * 
 * HTTP endpoints for credential management.
 * Handles request validation, error responses, and audit logging.
 * 
 * CRITICAL: All endpoints must:
 * - Verify user authentication (JWT from Clerk)
 * - Validate user ownership of credentials
 * - Never expose credential data in responses
 * - Return generic error messages
 * - Audit all operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  CredentialResponse,
  CreateCredentialRequest,
  ErrorResponse,
  ServiceType,
  UpdateCredentialRequest,
  UserContext,
  VerifyCredentialResponse,
} from '../types/credential-system';
import { CredentialRepository } from '../services/credential.repository';
import { CredentialService } from '../services/credential.service';
import { AuditService } from '../services/audit.service';
import { Logger } from '../lib/logger';
import { validateCredentialFormat } from '../services/credential.validator';

/**
 * Credential Controller
 */
export class CredentialController {
  private router: Router;
  private logger: Logger;
  private credentialRepo: CredentialRepository;
  private credentialService: CredentialService;
  private auditService: AuditService;

  constructor(
    credentialRepo: CredentialRepository,
    credentialService: CredentialService,
    auditService: AuditService
  ) {
    this.logger = new Logger('CredentialController');
    this.credentialRepo = credentialRepo;
    this.credentialService = credentialService;
    this.auditService = auditService;
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Setup all routes
   */
  private setupRoutes(): void {
    // All routes require authentication and request context middleware
    this.router.use(this.extractUserContext.bind(this));
    this.router.use(this.addRequestContext.bind(this));

    // Routes
    this.router.post('/v1/credentials', this.createCredential.bind(this));
    this.router.get('/v1/credentials', this.listCredentials.bind(this));
    this.router.get(
      '/v1/credentials/:credentialId',
      this.getCredentialMetadata.bind(this)
    );
    this.router.put(
      '/v1/credentials/:credentialId',
      this.updateCredential.bind(this)
    );
    this.router.delete(
      '/v1/credentials/:credentialId',
      this.deleteCredential.bind(this)
    );
    this.router.post(
      '/v1/credentials/:credentialId/verify',
      this.verifyCredential.bind(this)
    );

    // Error handler
    this.router.use(this.errorHandler.bind(this));
  }

  /**
   * Extract and validate user context from JWT
   * 
   * Must be implemented with Clerk authentication
   */
  private async extractUserContext(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Unauthorized',
          error_code: 'AUTH_001',
          request_id: req.id,
        } as ErrorResponse);
        return;
      }

      // TODO: Verify JWT with Clerk
      // const user = await verifyClerkToken(token);
      // req.user = user;

      // PLACEHOLDER: Mock implementation
      req.user = {
        userId: 1,
        clerkId: 'user_123',
        email: 'user@example.com',
        status: 'active',
      } as UserContext;

      next();
    } catch (error) {
      this.logger.error('Authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(401).json({
        error: 'Unauthorized',
        error_code: 'AUTH_001',
        request_id: req.id,
      } as ErrorResponse);
    }
  }

  /**
   * Add request context (ID, IP, user agent)
   */
  private addRequestContext(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    req.id = req.headers['x-request-id'] as string || generateRequestId();
    // req.ip is read-only in Express, we just use it directly
    req.userAgent = req.headers['user-agent'] || 'unknown';
    next();
  }

  /**
   * POST /api/v1/credentials
   * Create a new credential
   */
  private async createCredential(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user as UserContext;
      const payload = req.body as CreateCredentialRequest;

      // Validate payload
      if (!payload.service_type || !payload.credential_name) {
        res.status(400).json({
          error: 'Invalid credential format',
          error_code: 'CRED_001',
          request_id: req.id,
        });
        return;
      }

      // Validate credential data format
      const validation = validateCredentialFormat(
        payload.service_type,
        payload.credential_data
      );
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Invalid credential format',
          error_code: 'CRED_002',
          request_id: req.id,
        });
        return;
      }

      // Create credential
      const credential = await this.credentialRepo.createCredential(
        user,
        payload.service_type,
        payload.credential_name,
        payload.credential_data,
        payload.expires_at ? new Date(payload.expires_at) : undefined
      );

      res.status(201).json(credential);
    } catch (error) {
      // Let error handler manage this
      throw error;
    }
  }

  /**
   * GET /api/v1/credentials
   * List credentials for user
   */
  private async listCredentials(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user as UserContext;
      const serviceType = (req.query.service_type as ServiceType) || undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (page < 1 || limit < 1 || limit > 100) {
        res.status(400).json({
          error: 'Invalid pagination parameters',
          error_code: 'CRED_003',
          request_id: req.id,
        });
        return;
      }

      const result = await this.credentialRepo.listCredentials(
        user,
        serviceType,
        page,
        limit
      );

      res.json(result);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/v1/credentials/:credentialId
   * Get credential metadata (no decryption)
   */
  private async getCredentialMetadata(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user as UserContext;
      const credentialId = parseInt(req.params.credentialId);

      if (!credentialId) {
        res.status(400).json({
          error: 'Invalid credential ID',
          error_code: 'CRED_004',
          request_id: req.id,
        });
        return;
      }

      const credential = await this.credentialRepo.getCredentialMetadata(
        user,
        credentialId
      );

      res.json(credential);
    } catch (error) {
      throw error;
    }
  }

  /**
   * PUT /api/v1/credentials/:credentialId
   * Update credential
   */
  private async updateCredential(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user as UserContext;
      const credentialId = parseInt(req.params.credentialId);
      const payload = req.body as UpdateCredentialRequest;

      if (!credentialId) {
        res.status(400).json({
          error: 'Invalid credential ID',
          error_code: 'CRED_004',
          request_id: req.id,
        });
        return;
      }

      // Validate credential data if provided
      if (payload.credential_data) {
        // Need to get current credential to know service type
        const current = await this.credentialRepo.getCredentialMetadata(
          user,
          credentialId
        );
        const validation = validateCredentialFormat(
          current.service_type as ServiceType,
          payload.credential_data
        );
        if (!validation.isValid) {
          res.status(400).json({
            error: 'Invalid credential format',
            error_code: 'CRED_002',
            request_id: req.id,
          });
          return;
        }
      }

      const updated = await this.credentialRepo.updateCredential(
        user,
        credentialId,
        {
          credentialName: payload.credential_name,
          credentialData: payload.credential_data,
          expiresAt:
            payload.expires_at === null
              ? null
              : payload.expires_at
                ? new Date(payload.expires_at)
                : undefined,
        }
      );

      res.json(updated);
    } catch (error) {
      throw error;
    }
  }

  /**
   * DELETE /api/v1/credentials/:credentialId
   * Delete credential (soft delete)
   */
  private async deleteCredential(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user as UserContext;
      const credentialId = parseInt(req.params.credentialId);

      if (!credentialId) {
        res.status(400).json({
          error: 'Invalid credential ID',
          error_code: 'CRED_004',
          request_id: req.id,
        });
        return;
      }

      await this.credentialRepo.deleteCredential(user, credentialId);

      res.status(204).send();
    } catch (error) {
      throw error;
    }
  }

  /**
   * POST /api/v1/credentials/:credentialId/verify
   * Verify credential (test connection)
   * 
   * Returns 200 even on failure (doesn't leak validity information)
   */
  private async verifyCredential(
    req: Request,
    res: Response
  ): Promise<void> {
    const user = req.user as UserContext;
    const credentialId = parseInt(req.params.credentialId);

    try {
      if (!credentialId) {
        res.status(400).json({
          error: 'Invalid credential ID',
          error_code: 'CRED_004',
          request_id: req.id,
        });
        return;
      }

      // Get credential metadata to find service type
      const metadata = await this.credentialRepo.getCredentialMetadata(
        user,
        credentialId
      );

      // Verify credential (this will try to decrypt and potentially connect)
      const isValid = await this.credentialService.verifyCredential(
        user,
        credentialId,
        metadata.service_type as ServiceType
      );

      const response: VerifyCredentialResponse = {
        credential_id: metadata.id,
        is_valid: isValid,
        verification_status: isValid ? 'valid' : 'invalid',
        last_verified_at: new Date().toISOString(),
        message: isValid
          ? `Successfully verified ${metadata.service_type} credential`
          : 'Credential verification failed',
      };

      // Always return 200 for privacy
      res.json(response);
    } catch (error) {
      // Even on error, return 200 with generic message
      const response: VerifyCredentialResponse = {
        credential_id: credentialId.toString(),
        is_valid: false,
        verification_status: 'invalid',
        last_verified_at: new Date().toISOString(),
        message: 'Credential verification failed',
      };

      res.json(response);
    }
  }

  /**
   * Error handler middleware
   */
  private errorHandler(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const requestId = req.id || generateRequestId();

    // Log the full error internally
    this.logger.error('Request error', {
      requestId,
      path: req.path,
      method: req.method,
      error: error.message,
      stack: error.stack,
    });

    // Determine response based on error type
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An error occurred processing your request';

    if (error.message.includes('Credential not found')) {
      statusCode = 404;
      errorCode = 'CRED_005';
      message = 'Credential not found or access denied';
    } else if (error.message.includes('access denied')) {
      statusCode = 403;
      errorCode = 'CRED_006';
      message = 'Access denied';
    } else if (error.message.includes('User account')) {
      statusCode = 403;
      errorCode = 'USER_001';
      message = 'User account is not active';
    } else if (error.message.includes('duplicate')) {
      statusCode = 409;
      errorCode = 'CRED_007';
      message = error.message;
    }

    res.status(statusCode).json({
      error: message,
      error_code: errorCode,
      request_id: requestId,
    } as ErrorResponse);
  }

  /**
   * Get the router
   */
  getRouter(): Router {
    return this.router;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Express types are augmented in src/types/express.d.ts
