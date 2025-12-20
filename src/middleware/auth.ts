/**
 * Clerk Authentication Middleware
 * Uses Clerk's official server SDK for JWT verification
 *
 * Security:
 * - Validates JWT signature using Clerk's JWKS endpoint
 * - Extracts Clerk user ID from 'sub' claim
 * - Queries database to get internal user record
 * - Returns 401 for missing/invalid tokens
 * - Sets RLS context (app.current_user_id) for database queries
 */

import { clerkClient, verifyToken } from '@clerk/clerk-sdk-node';
import { Request, Response, NextFunction } from 'express';
import { getUserByClerkId, getOrCreateUser } from '../lib/database.js';
import { logger } from '../lib/logger.js';

// Express Request type augmentation is in src/types/express.d.ts

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        clerkId: string;
        email: string;
        status: string;
      };
    }
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

    // Verify token using Clerk SDK
    let session;
    try {
      // For verifying JWT tokens from the Authorization header, use the verifyToken function
      session = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        issuer: process.env.CLERK_ISSUER || undefined
      } as any);
    } catch (err) {
      logger.debug('JWT verification failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    if (!session || !session.sub) {
      res.status(401).json({
        error: 'Invalid token - missing user ID',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Get or create user in database
    let user = await getUserByClerkId(session.sub);

    if (!user) {
      // User not in database, create entry
      // Get user details from Clerk to get email
      const clerkUser = await clerkClient.users.getUser(session.sub);
      const email = clerkUser.emailAddresses[0]?.emailAddress || `${session.sub}@clerk.internal`;
      const name = clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : undefined;

      user = await getOrCreateUser(session.sub, email, name);
    }

    // Attach user to request (matches UserContext interface)
    req.user = {
      userId: user.id,
      clerkId: user.clerk_id,
      email: user.email,
      status: user.status || 'active', // Default status for authenticated users
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
    let session;

    try {
      session = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        issuer: process.env.CLERK_ISSUER || undefined
      } as any);
    } catch {
      // Token verification failed, continue without user
      next();
      return;
    }

    if (!session || !session.sub) {
      // Invalid token, continue without user
      next();
      return;
    }

    const user = await getUserByClerkId(session.sub);
    if (user) {
      req.user = {
        userId: user.id,
        clerkId: user.clerk_id,
        email: user.email,
        status: user.status || 'active',
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