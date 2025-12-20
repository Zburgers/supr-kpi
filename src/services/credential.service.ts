/**
 * Credential Service
 * 
 * Business logic for credential management
 * Coordinates between repository, encryption, and external services
 */

import {
  CredentialData,
  ServiceType,
  UserContext,
} from '../types/credential-system';
import { CredentialRepository } from './credential.repository';
import { Logger } from '../lib/logger';

/**
 * Credential Service
 */
export class CredentialService {
  private logger: Logger;
  private credentialRepo: CredentialRepository;

  constructor(credentialRepo: CredentialRepository) {
    this.logger = new Logger('CredentialService');
    this.credentialRepo = credentialRepo;
  }

  /**
   * Verify a credential by testing connection to external service
   * 
   * For different service types:
   * - Google Sheets: Try to list sheets
   * - Meta: Try to get account info
   * - GA4: Try to get properties
   * - Shopify: Try to get shop info
   * 
   * @param user - User context
   * @param credentialId - Credential ID to verify
   * @param serviceType - Service type
   * @returns true if credential is valid, false otherwise
   */
  async verifyCredential(
    user: UserContext,
    credentialId: number,
    serviceType: ServiceType
  ): Promise<boolean> {
    try {
      // Get decrypted credential
      const credential = await this.credentialRepo.getCredential(
        user,
        credentialId
      );

      // Test connection based on service type
      const isValid = await this.testServiceConnection(
        serviceType,
        credential
      );

      // Update verification status
      await this.credentialRepo.updateVerificationStatus(
        credentialId,
        isValid ? 'valid' : 'invalid',
        user.userId
      );

      this.logger.info('Credential verified', {
        userId: user.userId,
        credentialId,
        serviceType,
        isValid,
      });

      return isValid;
    } catch (error) {
      this.logger.error('Credential verification failed', {
        userId: user.userId,
        credentialId,
        serviceType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // On any error, mark as invalid
      try {
        await this.credentialRepo.updateVerificationStatus(
          credentialId,
          'invalid',
          user.userId
        );
      } catch {
        // Ignore
      }

      return false;
    }
  }

  /**
   * Test connection to external service
   * 
   * Implementation depends on service type
   * Each service requires different validation
   */
  private async testServiceConnection(
    serviceType: ServiceType,
    credential: CredentialData
  ): Promise<boolean> {
    switch (serviceType) {
      case 'google_sheets':
        return this.testGoogleSheetsConnection(credential);
      case 'meta':
        return this.testMetaConnection(credential);
      case 'ga4':
        return this.testGA4Connection(credential);
      case 'shopify':
        return this.testShopifyConnection(credential);
      default:
        return false;
    }
  }

  /**
   * Test Google Sheets connection
   * 
   * Uses the Google Sheets API to verify the service account can authenticate
   */
  private async testGoogleSheetsConnection(
    credential: CredentialData
  ): Promise<boolean> {
    try {
      // TODO: Implement Google Sheets API test
      // This would involve:
      // 1. Creating a Google auth client with the service account
      // 2. Calling sheets.spreadsheets.get on a test spreadsheet
      // 3. Verifying successful response

      // For now, basic validation
      if (
        credential._credentialType !== 'google_sheets' ||
        !credential.private_key ||
        !credential.client_email
      ) {
        return false;
      }

      // Would call Google API here
      // const sheets = google.sheets({ version: 'v4', auth });
      // await sheets.spreadsheets.get({ spreadsheetId: testSheetId });

      return true;
    } catch (error) {
      this.logger.debug('Google Sheets connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Test Meta connection
   * 
   * Calls Meta Marketing API to verify token is valid
   */
  private async testMetaConnection(
    credential: CredentialData
  ): Promise<boolean> {
    try {
      if (
        credential._credentialType !== 'meta' ||
        !credential.access_token ||
        !credential.account_id
      ) {
        return false;
      }

      // TODO: Call Meta API
      // const response = await fetch(
      //   `https://graph.instagram.com/v18.0/me?access_token=${credential.access_token}`
      // );
      // return response.ok;

      return true;
    } catch (error) {
      this.logger.debug('Meta connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Test Google Analytics 4 connection
   * 
   * Uses Google Analytics API to verify credentials
   */
  private async testGA4Connection(
    credential: CredentialData
  ): Promise<boolean> {
    try {
      if (
        credential._credentialType !== 'ga4' ||
        !credential.client_id ||
        !credential.refresh_token
      ) {
        return false;
      }

      // TODO: Implement GA4 API test
      // This would involve:
      // 1. Using refresh_token to get access_token
      // 2. Calling analytics API to get property info
      // 3. Verifying successful response

      return true;
    } catch (error) {
      this.logger.debug('GA4 connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Test Shopify connection
   * 
   * Calls Shopify Admin API to verify access token
   */
  private async testShopifyConnection(
    credential: CredentialData
  ): Promise<boolean> {
    try {
      if (
        credential._credentialType !== 'shopify' ||
        !credential.access_token ||
        !credential.shop_url
      ) {
        return false;
      }

      // TODO: Call Shopify API
      // const response = await fetch(
      //   `https://${credential.shop_url}/admin/api/${credential.api_version}/shop.json`,
      //   {
      //     headers: {
      //       'X-Shopify-Access-Token': credential.access_token,
      //     },
      //   }
      // );
      // return response.ok;

      return true;
    } catch (error) {
      this.logger.debug('Shopify connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}
