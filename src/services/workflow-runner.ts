/**
 * Analytics Workflow Runner
 * 
 * Unified service that runs analytics data collection workflows for all services.
 * Integrates with schema manager for proper schema validation and data insertion.
 * 
 * Flow:
 * 1. Get user credentials from database
 * 2. Validate/create sheet schema
 * 3. Check if data for target date exists
 * 4. If not, fetch from analytics API and insert
 * 
 * @module services/workflow-runner
 */

import { schemaManager, SCHEMAS, type ServiceSchemaType } from './schema-manager.js';
import { metaInsightsWorkflow } from './meta.js';
import { googleAnalyticsWorkflow } from './google.js';
import { shopifyWorkflow } from './shopify.js';
import { sheetsService } from './sheets.js';
import { decryptCredential } from '../lib/encryption.js';
import { executeQuery } from '../lib/database.js';
import { logAudit } from '../lib/audit-log.js';
import { logger } from '../lib/logger.js';

export interface WorkflowRunOptions {
  userId: number;
  service: ServiceSchemaType;
  spreadsheetId: string;
  sheetName: string;
  credentialId: string;
  force?: boolean; // Force run even if data exists
}

export interface WorkflowRunResult {
  success: boolean;
  service: ServiceSchemaType;
  date: string;
  schemaCreated: boolean;
  dataInserted: boolean;
  skipped: boolean;
  metrics?: Record<string, any>;
  error?: string;
  duration: number;
}

interface CredentialData {
  service: string;
  encrypted_data: string;
}

class AnalyticsWorkflowRunner {
  /**
   * Get yesterday's date in YYYY-MM-DD format
   */
  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  /**
   * Get decrypted credentials for a user
   */
  private async getDecryptedCredentials(
    userId: number,
    credentialId: string
  ): Promise<{ service: string; data: Record<string, any> } | null> {
    try {
      const result = await executeQuery(
        `SELECT service, encrypted_data FROM credentials 
         WHERE id = $1 AND deleted_at IS NULL`,
        [credentialId],
        userId
      );

      if (result.rows.length === 0) {
        return null;
      }

      const credential = result.rows[0] as CredentialData;
      const decrypted = decryptCredential(credential.encrypted_data, String(userId));
      const data = JSON.parse(decrypted);

      return { service: credential.service, data };
    } catch (error) {
      logger.error('Failed to decrypt credential', { credentialId, error: String(error) });
      return null;
    }
  }

  /**
   * Get sheet mapping for user and service
   */
  private async getSheetMapping(
    userId: number,
    service: string
  ): Promise<{ spreadsheetId: string; sheetName: string } | null> {
    try {
      const result = await executeQuery(
        `SELECT spreadsheet_id, sheet_name FROM sheet_mappings 
         WHERE service = $1 
         ORDER BY updated_at DESC 
         LIMIT 1`,
        [service],
        userId
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        spreadsheetId: result.rows[0].spreadsheet_id,
        sheetName: result.rows[0].sheet_name,
      };
    } catch (error) {
      logger.error('Failed to get sheet mapping', { service, error: String(error) });
      return null;
    }
  }

  /**
   * Run Meta analytics workflow
   */
  private async runMetaWorkflow(
    credentials: Record<string, any>,
    spreadsheetId: string,
    sheetName: string
  ): Promise<{ metrics: Record<string, any>; success: boolean; error?: string }> {
    const { access_token, account_id } = credentials;

    if (!access_token) {
      return { metrics: {}, success: false, error: 'Missing access_token in credentials' };
    }

    try {
      const result = await metaInsightsWorkflow.runWorkflow(access_token, {
        spreadsheetId,
        sheetName,
      });

      return {
        metrics: result.metrics,
        success: result.appendResult.success,
        error: result.appendResult.error,
      };
    } catch (error) {
      return {
        metrics: {},
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run GA4 analytics workflow
   */
  private async runGA4Workflow(
    credentials: Record<string, any>,
    spreadsheetId: string,
    sheetName: string
  ): Promise<{ metrics: Record<string, any>; success: boolean; error?: string }> {
    const { refresh_token, client_id, client_secret, property_id } = credentials;

    if (!property_id) {
      return { metrics: {}, success: false, error: 'Missing property_id in credentials' };
    }

    // For OAuth credentials, we need to exchange refresh token for access token
    let accessToken: string;

    if (refresh_token && client_id && client_secret) {
      // OAuth flow - get access token from refresh token
      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id,
            client_secret,
            refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          return { metrics: {}, success: false, error: `OAuth token refresh failed: ${errorText}` };
        }

        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;
      } catch (error) {
        return {
          metrics: {},
          success: false,
          error: `Token refresh error: ${error instanceof Error ? error.message : 'Unknown'}`,
        };
      }
    } else if (credentials.private_key && credentials.client_email) {
      // Service account flow - use the service account credentials
      // The sheetsService should handle this via initialize()
      return {
        metrics: {},
        success: false,
        error: 'Service account authentication for GA4 not yet implemented in this workflow',
      };
    } else {
      return { metrics: {}, success: false, error: 'Invalid credential format for GA4' };
    }

    try {
      const result = await googleAnalyticsWorkflow.runWorkflow(accessToken, property_id, {
        spreadsheetId,
        sheetName,
      });

      return {
        metrics: result.metrics,
        success: result.appendResult.success,
        error: result.appendResult.error,
      };
    } catch (error) {
      return {
        metrics: {},
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run Shopify analytics workflow
   */
  private async runShopifyWorkflow(
    credentials: Record<string, any>,
    spreadsheetId: string,
    sheetName: string
  ): Promise<{ metrics: Record<string, any>; success: boolean; error?: string }> {
    const { shop_url, access_token } = credentials;

    if (!shop_url || !access_token) {
      return { metrics: {}, success: false, error: 'Missing shop_url or access_token in credentials' };
    }

    try {
      const result = await shopifyWorkflow.runWorkflow(shop_url, access_token, {
        spreadsheetId,
        sheetName,
      });

      return {
        metrics: result.metrics,
        success: result.appendResult.success,
        error: result.appendResult.error,
      };
    } catch (error) {
      return {
        metrics: {},
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Main entry point - run a complete analytics workflow for a service
   */
  async runWorkflow(options: WorkflowRunOptions): Promise<WorkflowRunResult> {
    const startTime = Date.now();
    const targetDate = this.getYesterdayDate();

    logger.info(`Starting ${options.service} workflow for user ${options.userId}`, {
      service: options.service,
      spreadsheetId: options.spreadsheetId,
      sheetName: options.sheetName,
    });

    try {
      // Step 1: Decrypt user credentials
      const credentials = await this.getDecryptedCredentials(
        options.userId,
        options.credentialId
      );

      if (!credentials) {
        return {
          success: false,
          service: options.service,
          date: targetDate,
          schemaCreated: false,
          dataInserted: false,
          skipped: false,
          error: 'Credentials not found or could not be decrypted',
          duration: Date.now() - startTime,
        };
      }

      // Step 2: Prepare schema and check for existing data
      const schemaResult = await schemaManager.prepareForDataInsertion(
        options.spreadsheetId,
        options.sheetName,
        options.service
      );

      if (schemaResult.error) {
        return {
          success: false,
          service: options.service,
          date: targetDate,
          schemaCreated: schemaResult.schemaCreated,
          dataInserted: false,
          skipped: false,
          error: schemaResult.error,
          duration: Date.now() - startTime,
        };
      }

      // Step 3: Check if we should skip (data exists and not forced)
      if (schemaResult.dateExists && !options.force) {
        logger.info(`Data for ${targetDate} already exists, skipping`, {
          service: options.service,
          lastDate: schemaResult.lastDate,
        });

        return {
          success: true,
          service: options.service,
          date: targetDate,
          schemaCreated: schemaResult.schemaCreated,
          dataInserted: false,
          skipped: true,
          duration: Date.now() - startTime,
        };
      }

      // Step 4: Run the appropriate workflow
      let workflowResult: { metrics: Record<string, any>; success: boolean; error?: string };

      switch (options.service) {
        case 'meta':
          workflowResult = await this.runMetaWorkflow(
            credentials.data,
            options.spreadsheetId,
            options.sheetName
          );
          break;

        case 'ga4':
          workflowResult = await this.runGA4Workflow(
            credentials.data,
            options.spreadsheetId,
            options.sheetName
          );
          break;

        case 'shopify':
          workflowResult = await this.runShopifyWorkflow(
            credentials.data,
            options.spreadsheetId,
            options.sheetName
          );
          break;

        default:
          return {
            success: false,
            service: options.service,
            date: targetDate,
            schemaCreated: schemaResult.schemaCreated,
            dataInserted: false,
            skipped: false,
            error: `Unknown service: ${options.service}`,
            duration: Date.now() - startTime,
          };
      }

      // Step 5: Log result
      const duration = Date.now() - startTime;

      await logAudit(
        options.userId,
        'workflow_run',
        options.service,
        workflowResult.success ? 'success' : 'failure',
        workflowResult.error,
        {
          date: targetDate,
          duration,
          schemaCreated: schemaResult.schemaCreated,
        }
      );

      logger.info(`Workflow ${workflowResult.success ? 'completed' : 'failed'} for ${options.service}`, {
        service: options.service,
        success: workflowResult.success,
        duration,
        error: workflowResult.error,
      });

      return {
        success: workflowResult.success,
        service: options.service,
        date: targetDate,
        schemaCreated: schemaResult.schemaCreated,
        dataInserted: workflowResult.success,
        skipped: false,
        metrics: workflowResult.metrics,
        error: workflowResult.error,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Workflow failed for ${options.service}`, {
        service: options.service,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        service: options.service,
        date: targetDate,
        schemaCreated: false,
        dataInserted: false,
        skipped: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Run workflows for all configured services for a user
   */
  async runAllWorkflows(userId: number): Promise<WorkflowRunResult[]> {
    const results: WorkflowRunResult[] = [];
    const services: ServiceSchemaType[] = ['meta', 'ga4', 'shopify'];

    for (const service of services) {
      // Get credential for this service
      const credResult = await executeQuery(
        `SELECT id FROM credentials WHERE service = $1 AND verified = true AND deleted_at IS NULL LIMIT 1`,
        [service],
        userId
      );

      if (credResult.rows.length === 0) {
        logger.info(`No verified credential for ${service}, skipping`);
        continue;
      }

      // Get sheet mapping
      const mapping = await this.getSheetMapping(userId, service);

      if (!mapping) {
        logger.info(`No sheet mapping for ${service}, skipping`);
        continue;
      }

      const result = await this.runWorkflow({
        userId,
        service,
        spreadsheetId: mapping.spreadsheetId,
        sheetName: mapping.sheetName,
        credentialId: credResult.rows[0].id,
      });

      results.push(result);
    }

    return results;
  }
}

export const workflowRunner = new AnalyticsWorkflowRunner();
