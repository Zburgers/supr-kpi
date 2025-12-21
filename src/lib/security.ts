/**
 * Security Middleware
 * Production-ready security headers and rate limiting
 *
 * @module lib/security
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from './logger.js';

// ============================================================================
// TYPES
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface SecurityConfig {
  /** Enable rate limiting */
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  /** Enable request size limits */
  requestSizeLimit: string;
  /** Trusted proxy hops */
  trustProxy: boolean;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const defaultConfig: SecurityConfig = {
  rateLimit: {
    enabled: process.env.NODE_ENV === 'production',
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  requestSizeLimit: '50mb',
  trustProxy: process.env.TRUST_PROXY === 'true',
};

// ============================================================================
// IN-MEMORY RATE LIMITER
// ============================================================================

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  // Trust X-Forwarded-For header if behind proxy
  if (defaultConfig.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Rate limiter middleware
 */
export function rateLimiter(
  windowMs = defaultConfig.rateLimit.windowMs,
  maxRequests = defaultConfig.rateLimit.maxRequests
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!defaultConfig.rateLimit.enabled) {
      return next();
    }

    const clientIp = getClientIp(req);
    const now = Date.now();
    const key = `${clientIp}:${req.path}`;

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime < now) {
      entry = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(key, entry);
    } else {
      entry.count++;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());

    if (entry.count > maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: clientIp,
        path: req.path,
        count: entry.count,
      });

      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Security headers middleware
 * Sets important security headers for production
 */
export function securityHeaders(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy (adjust as needed)
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
          "https://*.clerk.accounts.dev https://cdn.jsdelivr.net/npm/@clerk/ " +
          "https://clerk.pegasus.nakshatraneuratech.dev https://challenges.cloudflare.com " +
          "https://static.cloudflareinsights.com; " +
        "style-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://cdn.jsdelivr.net/npm/@clerk/ https://clerk.pegasus.nakshatraneuratech.dev; " +
        "img-src 'self' data: https: https://img.clerk.com https://static.cloudflareinsights.com; " +
        "font-src 'self' data:; " +
        "connect-src 'self' https://*.clerk.accounts.dev https://clerk-telemetry.com " +
          "https://analyticsdata.googleapis.com https://sheets.googleapis.com https://graph.facebook.com " +
          "https://*.myshopify.com https://clerk.pegasus.nakshatraneuratech.dev https://static.cloudflareinsights.com; " +
        "worker-src 'self' blob:; " +
        "child-src 'self' blob:; " +
        "frame-src 'self' https://challenges.cloudflare.com;"
    );

    // Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()'
    );

    // Remove server header
    res.removeHeader('X-Powered-By');

    next();
  };
}

/**
 * Request sanitization middleware
 * Validates and sanitizes incoming requests
 */
export function sanitizeRequest(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check for suspicious patterns in query/body
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /\$\{/,
      /__proto__/i,
      /constructor\s*\(/i,
    ];

    const checkValue = (value: unknown): boolean => {
      if (typeof value === 'string') {
        return suspiciousPatterns.some((pattern) => pattern.test(value));
      }
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(checkValue);
      }
      return false;
    };

    // Check request body
    if (req.body && checkValue(req.body)) {
      logger.warn('Suspicious request body detected', {
        ip: getClientIp(req),
        path: req.path,
      });
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
      });
      return;
    }

    // Check query parameters
    if (req.query && checkValue(req.query)) {
      logger.warn('Suspicious query parameters detected', {
        ip: getClientIp(req),
        path: req.path,
      });
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
      });
      return;
    }

    next();
  };
}

/**
 * API key authentication middleware (optional)
 * Enable by setting API_KEY environment variable
 */
export function apiKeyAuth(excludePaths: string[] = ['/api/health']): RequestHandler {
  const apiKey = process.env.API_KEY;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if no API key configured or path is excluded
    if (!apiKey || excludePaths.some((p) => req.path.startsWith(p))) {
      return next();
    }

    const providedKey = req.headers['x-api-key'] || req.query.api_key;

    if (providedKey !== apiKey) {
      logger.warn('Invalid API key', {
        ip: getClientIp(req),
        path: req.path,
      });
      res.status(401).json({
        success: false,
        error: 'Invalid or missing API key',
      });
      return;
    }

    next();
  };
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs = 30000): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.setTimeout(timeoutMs, () => {
      logger.warn('Request timeout', {
        ip: getClientIp(req),
        path: req.path,
        method: req.method,
      });
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
        });
      }
    });
    next();
  };
}

/**
 * CORS configuration for production
 */
export function corsConfig(): { origin: string | string[]; credentials: boolean; methods: string[] } {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3001', 'http://localhost:5173'];

  return {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  };
}

/**
 * Apply all security middleware
 */
export function applySecurityMiddleware(app: any): void {
  // Trust proxy if behind reverse proxy
  if (defaultConfig.trustProxy) {
    app.set('trust proxy', 1);
  }

  // Security headers
  app.use(securityHeaders());

  // Rate limiting
  app.use(rateLimiter());

  // Request sanitization
  app.use(sanitizeRequest());

  // Request timeout (30 seconds)
  app.use(requestTimeout(30000));

  // API key auth (optional)
  app.use(apiKeyAuth(['/api/health', '/']));

  logger.info('Security middleware applied');
}
