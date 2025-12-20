/**
 * Express Request Extensions
 * 
 * Single source of truth for Express Request augmentation.
 * Both middleware/auth.ts and credential.controller.ts use this.
 */

import { UserContext } from './credential-system';

declare global {
  namespace Express {
    interface Request {
      /**
       * User context from JWT authentication
       * Contains internal user ID, Clerk ID, email, and status
       */
      user?: UserContext;
      
      /**
       * Unique request identifier for tracing
       */
      id?: string;
      
      /**
       * User agent from request headers
       */
      userAgent?: string;
    }
  }
}

// Required for module augmentation
export {};
