/**
 * DEPRECATED: Legacy Google Analytics 4 Service
 *
 * ⚠️  ADVISORY: This module is deprecated and has been replaced by the new GA4 service.
 *
 * The new implementation provides:
 * - Service account authentication support
 * - Better security with encrypted credential storage
 * - Integration with the credential management system
 * - Proper user isolation via RLS
 * - Improved error handling and logging
 *
 * New service location: src/services/ga4.service.ts
 * New API endpoint: POST /api/ga4/sync
 *
 * This file is maintained only for reference and backward compatibility testing.
 * It should not be used in production.
 */

export interface GoogleAnalyticsRow {
  id?: number;
  date: string;
  sessions: number;
  users: number;
  add_to_cart: number;
  purchases: number;
  revenue: number;
  bounce_rate: number;
}

// Placeholder implementation that throws an error when used
class GoogleAnalyticsWorkflow {
  async runWorkflow() {
    throw new Error(
      "This legacy Google Analytics service is deprecated. " +
      "Please use the new GA4 service at POST /api/ga4/sync instead."
    );
  }
}

export const googleAnalyticsWorkflow = new GoogleAnalyticsWorkflow();
