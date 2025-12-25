/**
 * TSOA Authentication Module
 * 
 * Integrates Clerk JWT verification with TSOA security decorators.
 * Used by TSOA-generated routes to authenticate requests.
 */

import { Request } from 'express';
import { verifyToken } from '@clerk/clerk-sdk-node';
import { getUserByClerkId, getOrCreateUser } from './lib/database.js';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { logger } from './lib/logger.js';

export interface AuthenticatedUser {
  userId: number;
  clerkId: string;
  email: string;
  status: string;
}

/**
 * TSOA Authentication function
 * Called by TSOA when @Security decorator is used
 * 
 * @param request - Express request object
 * @param securityName - Name of the security scheme (e.g., 'jwt')
 * @param scopes - Optional scopes required for the endpoint
 * @returns Promise resolving to authenticated user or rejecting with error
 */
export async function expressAuthentication(
  request: Request,
  securityName: string,
  scopes?: string[]
): Promise<AuthenticatedUser> {
  if (securityName === 'jwt') {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing authorization token');
    }

    const token = authHeader.substring(7);

    try {
      const session = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        issuer: process.env.CLERK_ISSUER || undefined
      } as any);

      if (!session || !session.sub) {
        throw new Error('Invalid token - missing user ID');
      }

      // Get or create user in database
      let user = await getUserByClerkId(session.sub);

      if (!user) {
        const clerkUser = await clerkClient.users.getUser(session.sub);
        const email = clerkUser.emailAddresses[0]?.emailAddress || `${session.sub}@clerk.internal`;
        const name = clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : undefined;
        user = await getOrCreateUser(session.sub, email, name);
      }

      // Check scopes if provided
      if (scopes && scopes.length > 0) {
        // For now, we don't implement scope checking
        // This can be extended to check user roles/permissions
        logger.debug('Scope check requested', { scopes, userId: user.id });
      }

      return {
        userId: user.id,
        clerkId: user.clerk_id,
        email: user.email,
        status: user.status || 'active',
      };
    } catch (error) {
      logger.debug('JWT verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Invalid token');
    }
  }

  throw new Error(`Unknown security scheme: ${securityName}`);
}
