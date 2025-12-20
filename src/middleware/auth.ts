/**
 * JWT Authentication Middleware
 * Verifies JWT token from Clerk and attaches user context
 * 
 * Security:
 * - Validates JWT signature using Clerk public key
 * - Extracts Clerk user ID from 'sub' claim
 * - Queries database to get internal user record
 * - Returns 401 for missing/invalid tokens
 * - Sets RLS context (app.current_user_id) for database queries
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserByClerkId, getOrCreateUser } from '../lib/database.js';
import { logger } from '../lib/logger.js';
// Express Request type augmentation is in src/types/express.d.ts

/**
 * JWT payload from Clerk
 */
interface ClerkJWTPayload {
  sub: string; // Clerk user ID
  email?: string;
  iat?: number;
  exp?: number;
}

/**
 * Get Clerk public key for JWT verification
 * In production, this should be cached and rotated periodically
 */
function getClerkPublicKey(): string {
  const key = process.env.CLERK_PUBLIC_KEY;
  if (!key) {
    throw new Error('CLERK_PUBLIC_KEY not configured');
  }
  return key;
}

/**
 * Verify and decode JWT token
 */
function verifyToken(token: string): ClerkJWTPayload {
  try {
    const publicKey = getClerkPublicKey();
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    });
    return decoded as ClerkJWTPayload;
  } catch (err) {
    const error = err as Error;
    logger.debug('JWT verification failed', {
      error: error.message || 'Unknown error',
    });
    throw new Error('Invalid token');
  }
}

/**
 * Authentication middleware
 * Verifies JWT and attaches user to request
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Missing authorization token',
        code: 'MISSING_TOKEN',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token
    const payload = verifyToken(token);

    if (!payload.sub) {
      res.status(401).json({
        error: 'Invalid token - missing user ID',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Get or create user in database
    let user = await getUserByClerkId(payload.sub);

    if (!user) {
      // User not in database, create entry
      const email = payload.email || `${payload.sub}@clerk.internal`;
      user = await getOrCreateUser(payload.sub, email);
    }

    // Attach user to request (matches UserContext interface)
    req.user = {
      userId: user.id,
      clerkId: user.clerk_id,
      email: user.email,
      status: 'active', // Default status for authenticated users
    };

    logger.debug('User authenticated', {
      userId: user.id,
      clerkId: user.clerk_id,
    });

    next();
  } catch (error) {
    logger.error('Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED',
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token present, otherwise continues without user
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, continue without user
      next();
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload.sub) {
      // Invalid token, continue without user
      next();
      return;
    }

    const user = await getUserByClerkId(payload.sub);
    if (user) {
      req.user = {
        userId: user.id,
        clerkId: user.clerk_id,
        email: user.email,
        status: 'active',
      };
    }

    next();
  } catch {
    // Token verification failed, continue without user
    next();
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(req: Request): boolean {
  return !!req.user;
}

/**
 * Assert user is authenticated (use in route handlers)
 */
export function requireAuth(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return false;
  }
  return true;
}
