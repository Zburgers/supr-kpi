/**
 * Schema Management Service
 * 
 * Handles schema validation and creation for each analytics service:
 * - Meta: id, date, spend, reach, impressions, clicks, landing_page_views, add_to_cart, initiate_checkout, purchases, revenue
 * - GA4: id, date, sessions, users, add_to_cart, purchases, revenue, bounce_rate
 * - Shopify: id, date, total_orders, total_revenue, net_revenue, total_returns, new_customers, repeat_customers
 * 
 * Flow:
 * 1. Check if sheet has required schema
 * 2. If not, create the schema (header row)
 * 3. Check if yesterday's data exists
 * 4. If exists, skip; otherwise, fetch and insert
 * 
 * @module services/schema-manager
 */

import { sheetsService } from "./sheets.js";

// Schema definitions for each service
export const SCHEMAS = {
  meta: {
    columns: ['id', 'date', 'spend', 'reach', 'impressions', 'clicks', 'landing_page_views', 'add_to_cart', 'initiate_checkout', 'purchases', 'revenue'],
    defaultSheetName: 'meta_raw_daily',
  },
  ga4: {
    columns: ['id', 'date', 'sessions', 'users', 'add_to_cart', 'purchases', 'revenue', 'bounce_rate'],
    defaultSheetName: 'ga4_raw_daily',
  },
  shopify: {
    columns: ['id', 'date', 'total_orders', 'total_revenue', 'net_revenue', 'total_returns', 'new_customers', 'repeat_customers'],
    defaultSheetName: 'shopify_raw_daily',
  },
} as const;

export type ServiceSchemaType = keyof typeof SCHEMAS;

export interface SchemaValidationResult {
  valid: boolean;
  hasHeaders: boolean;
  matchesSchema: boolean;
  missingColumns: string[];
  extraColumns: string[];
  existingHeaders: string[];
}

export interface SchemaCheckResult {
  schemaValid: boolean;
  schemaCreated: boolean;
  dateExists: boolean;
  nextId: number;
  rowCount: number;
  lastDate?: string;
  error?: string;
}

class SchemaManager {
  /**
   * Get yesterday's date in YYYY-MM-DD format
   */
  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  /**
   * Parse a date string or number into YYYY-MM-DD format
   * Handles formats like: 2025-12-21, 20251221, 12/21/2025
   */
  private normalizeDate(dateValue: string | number | null | undefined): string | null {
    if (!dateValue) return null;
    
    const str = String(dateValue).trim();
    
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    
    // YYYYMMDD format
    if (/^\d{8}$/.test(str)) {
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
    
    // Try Date parsing
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  }

  /**
   * Validate if a sheet has the correct schema for a service
   */
  async validateSchema(
    spreadsheetId: string,
    sheetName: string,
    service: ServiceSchemaType,
    credentialJson?: string
  ): Promise<SchemaValidationResult> {
    const schema = SCHEMAS[service];

    try {
      if (!credentialJson) {
        throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
      }

      await sheetsService.initializeWithCredentials(credentialJson);

      // Get the header row
      const headerValues = await sheetsService.getValues(
        spreadsheetId,
        sheetName,
        'A1:Z1'
      );
      
      if (!headerValues || headerValues.length === 0 || !headerValues[0]) {
        return {
          valid: false,
          hasHeaders: false,
          matchesSchema: false,
          missingColumns: [...schema.columns],
          extraColumns: [],
          existingHeaders: [],
        };
      }
      
      const existingHeaders = (headerValues[0] as (string | number | null)[])
        .map(h => (typeof h === 'string' ? h.trim().toLowerCase() : ''))
        .filter(h => h !== '');
      
      const expectedHeaders = schema.columns.map(c => c.toLowerCase());
      
      const missingColumns = expectedHeaders.filter(h => !existingHeaders.includes(h));
      const extraColumns = existingHeaders.filter(h => !expectedHeaders.includes(h));
      
      const matchesSchema = missingColumns.length === 0;
      
      return {
        valid: matchesSchema,
        hasHeaders: true,
        matchesSchema,
        missingColumns,
        extraColumns,
        existingHeaders,
      };
    } catch (error) {
      console.error(`Schema validation error for ${service}:`, error);
      return {
        valid: false,
        hasHeaders: false,
        matchesSchema: false,
        missingColumns: [...schema.columns],
        extraColumns: [],
        existingHeaders: [],
      };
    }
  }

  /**
   * Create the header schema for a service
   */
  async createSchema(
    spreadsheetId: string,
    sheetName: string,
    service: ServiceSchemaType,
    credentialJson?: string
  ): Promise<boolean> {
    const schema = SCHEMAS[service];

    try {
      if (!credentialJson) {
        throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
      }

      await sheetsService.initializeWithCredentials(credentialJson);
      
      // Update the first row with headers
      const range = sheetsService.formatRange(sheetName, `A1:${this.columnLetter(schema.columns.length - 1)}1`);
      
      await sheetsService.updateRange(
        spreadsheetId,
        range,
        [[...schema.columns]],
        sheetName
      );
      
      console.log(`✓ Created schema for ${service} in ${sheetName}`);
      return true;
    } catch (error) {
      console.error(`Failed to create schema for ${service}:`, error);
      return false;
    }
  }

  /**
   * Convert column index to letter (0 = A, 1 = B, etc.)
   */
  private columnLetter(index: number): string {
    let n = index + 1;
    let letters = '';
    while (n > 0) {
      const remainder = (n - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  }

  /**
   * Check if data for a specific date already exists
   */
  async checkDateExists(
    spreadsheetId: string,
    sheetName: string,
    targetDate: string,
    credentialJson?: string,
    dateColumnIndex: number = 1 // Assuming 'date' is column B (index 1)
  ): Promise<{ exists: boolean; rowNumber?: number }> {
    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    try {
      await sheetsService.initializeWithCredentials(credentialJson);

      const dateColLetter = this.columnLetter(dateColumnIndex);
      const dateValues = await sheetsService.getValues(
        spreadsheetId,
        sheetName,
        `${dateColLetter}2:${dateColLetter}`
      );
      
      for (let i = 0; i < dateValues.length; i++) {
        const cellValue = dateValues[i]?.[0];
        const normalizedDate = this.normalizeDate(cellValue);
        
        if (normalizedDate === targetDate) {
          return { exists: true, rowNumber: i + 2 }; // +2 for header row and 0-index
        }
      }
      
      return { exists: false };
    } catch (error) {
      console.error('Error checking date existence:', error);
      return { exists: false };
    }
  }

  /**
   * Get the next ID for auto-increment
   */
  async getNextId(
    spreadsheetId: string,
    sheetName: string,
    credentialJson?: string,
    idColumnIndex: number = 0 // Assuming 'id' is column A (index 0)
  ): Promise<number> {
    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    try {
      await sheetsService.initializeWithCredentials(credentialJson);
      
      const idColLetter = this.columnLetter(idColumnIndex);
      const idValues = await sheetsService.getValues(
        spreadsheetId,
        sheetName,
        `${idColLetter}2:${idColLetter}`
      );
      
      const parsedIds = idValues
        .map(r => {
          const val = r?.[0];
          if (val === '' || val === null || val === undefined) return NaN;
          return Number(val);
        })
        .filter(n => Number.isFinite(n) && n >= 0);
      
      if (parsedIds.length === 0) {
        return 1; // Start from 1 if no existing data
      }
      
      return Math.max(...parsedIds) + 1;
    } catch (error) {
      console.error('Error getting next ID:', error);
      return 1;
    }
  }

  /**
   * Get the last date entry in the sheet
   */
  async getLastDate(
    spreadsheetId: string,
    sheetName: string,
    credentialJson?: string,
    dateColumnIndex: number = 1
  ): Promise<string | null> {
    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    try {
      await sheetsService.initializeWithCredentials(credentialJson);
      
      const dateColLetter = this.columnLetter(dateColumnIndex);
      const dateValues = await sheetsService.getValues(
        spreadsheetId,
        sheetName,
        `${dateColLetter}2:${dateColLetter}`
      );
      
      const validDates = dateValues
        .map(r => this.normalizeDate(r?.[0]))
        .filter((d): d is string => d !== null)
        .sort((a, b) => b.localeCompare(a)); // Sort descending
      
      return validDates.length > 0 ? validDates[0] : null;
    } catch (error) {
      console.error('Error getting last date:', error);
      return null;
    }
  }

  /**
   * Complete schema check and preparation for data insertion
   * This is the main entry point for the workflow
   */
  async prepareForDataInsertion(
    spreadsheetId: string,
    sheetName: string,
    service: ServiceSchemaType,
    credentialJson?: string
  ): Promise<SchemaCheckResult> {
    const targetDate = this.getYesterdayDate();

    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    try {
      await sheetsService.initializeWithCredentials(credentialJson);
      
      // Step 1: Validate schema
      let validation = await this.validateSchema(spreadsheetId, sheetName, service);
      
      let schemaCreated = false;
      
      // Step 2: Create schema if needed
      if (!validation.hasHeaders || !validation.matchesSchema) {
        console.log(`📋 Schema needs creation/update for ${service}`);
        
        if (!validation.hasHeaders) {
          // Empty sheet - create full schema
          schemaCreated = await this.createSchema(spreadsheetId, sheetName, service);
        } else {
          // Has some headers but doesn't match - this is an error case
          // We don't want to overwrite existing data structures
          return {
            schemaValid: false,
            schemaCreated: false,
            dateExists: false,
            nextId: 1,
            rowCount: 0,
            error: `Sheet has existing headers that don't match ${service} schema. Missing: ${validation.missingColumns.join(', ')}`,
          };
        }
        
        // Re-validate after creation
        validation = await this.validateSchema(spreadsheetId, sheetName, service);
        
        if (!validation.valid) {
          return {
            schemaValid: false,
            schemaCreated,
            dateExists: false,
            nextId: 1,
            rowCount: 0,
            error: 'Failed to create schema',
          };
        }
      }
      
      // Step 3: Check if yesterday's date already exists
      const dateCheck = await this.checkDateExists(spreadsheetId, sheetName, targetDate);
      
      if (dateCheck.exists) {
        console.log(`⏭️  Data for ${targetDate} already exists, skipping`);
        const nextId = await this.getNextId(spreadsheetId, sheetName);
        const lastDate = await this.getLastDate(spreadsheetId, sheetName);
        
        return {
          schemaValid: true,
          schemaCreated,
          dateExists: true,
          nextId,
          rowCount: dateCheck.rowNumber! - 1, // Approximate row count
          lastDate: lastDate ?? undefined,
        };
      }
      
      // Step 4: Get next ID and row count
      const nextId = await this.getNextId(spreadsheetId, sheetName);
      const lastDate = await this.getLastDate(spreadsheetId, sheetName);
      
      console.log(`✓ Sheet ready for ${service} data insertion (nextId: ${nextId})`);
      
      return {
        schemaValid: true,
        schemaCreated,
        dateExists: false,
        nextId,
        rowCount: nextId - 1, // Approximate
        lastDate: lastDate ?? undefined,
      };
    } catch (error) {
      console.error(`Schema preparation error for ${service}:`, error);
      return {
        schemaValid: false,
        schemaCreated: false,
        dateExists: false,
        nextId: 1,
        rowCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Append a row of data to the sheet
   * Automatically handles ID assignment
   */
  async appendDataRow(
    spreadsheetId: string,
    sheetName: string,
    service: ServiceSchemaType,
    data: Record<string, string | number>,
    credentialJson?: string
  ): Promise<{ success: boolean; rowNumber?: number; id?: number; error?: string }> {
    const schema = SCHEMAS[service];

    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    try {
      await sheetsService.initializeWithCredentials(credentialJson);

      // Get next ID
      const nextId = await this.getNextId(spreadsheetId, sheetName, credentialJson);
      
      // Build row in schema order
      const row: (string | number)[] = schema.columns.map(col => {
        if (col === 'id') return nextId;
        return data[col] ?? '';
      });
      
      // Append to sheet
      const success = await sheetsService.appendRow(spreadsheetId, sheetName, row);
      
      if (success) {
        console.log(`✓ Appended ${service} data row with id=${nextId}`);
        return { success: true, id: nextId };
      }
      
      return { success: false, error: 'Append operation failed' };
    } catch (error) {
      console.error(`Failed to append ${service} data:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update an existing row by date
   */
  async updateDataRow(
    spreadsheetId: string,
    sheetName: string,
    service: ServiceSchemaType,
    targetDate: string,
    data: Record<string, string | number>,
    credentialJson?: string
  ): Promise<{ success: boolean; rowNumber?: number; error?: string }> {
    const schema = SCHEMAS[service];

    if (!credentialJson) {
      throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
    }

    try {
      await sheetsService.initializeWithCredentials(credentialJson);
      
      // Find the row with the target date
      const dateCheck = await this.checkDateExists(spreadsheetId, sheetName, targetDate);
      
      if (!dateCheck.exists || !dateCheck.rowNumber) {
        return { success: false, error: `No data found for date ${targetDate}` };
      }
      
      // Get existing ID
      const idValues = await sheetsService.getValues(
        spreadsheetId,
        sheetName,
        `A${dateCheck.rowNumber}:A${dateCheck.rowNumber}`
      );
      const existingId = Number(idValues[0]?.[0]) || 0;
      
      // Build row in schema order
      const row: (string | number)[] = schema.columns.map(col => {
        if (col === 'id') return existingId;
        return data[col] ?? '';
      });
      
      // Update the row
      const range = sheetsService.formatRange(
        sheetName,
        `A${dateCheck.rowNumber}:${this.columnLetter(schema.columns.length - 1)}${dateCheck.rowNumber}`
      );
      
      await sheetsService.updateRange(spreadsheetId, range, [row], sheetName);
      
      console.log(`✓ Updated ${service} data row at row ${dateCheck.rowNumber}`);
      return { success: true, rowNumber: dateCheck.rowNumber };
    } catch (error) {
      console.error(`Failed to update ${service} data:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const schemaManager = new SchemaManager();
