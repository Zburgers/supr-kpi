/**
 * Google Sheets integration service
 * Handles authentication and sheet operations
 *
 * @module services/sheets
 * @see {@link https://developers.google.com/sheets/api/quickstart/nodejs} - Google Sheets API Setup
 * @see {@link https://developers.google.com/identity/protocols/oauth2/service-account} - Service Account Auth
 */

import { google } from "googleapis";
import { JWT } from "google-auth-library";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  DailyMetrics,
  SheetMetadata,
  SheetsListResponse,
  SheetRow,
} from "../types/kpi";
import { getJson, setJson, delKeys, withLock } from "../lib/redis.js";

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SheetsService class
 * Manages all Google Sheets API interactions
 *
 * @class SheetsService
 */
export class SheetNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetNotFoundError";
  }
}

class SheetsService {
  private auth: JWT | null = null;
  private sheets: ReturnType<typeof google.sheets> | null = null;
  private drive: ReturnType<typeof google.drive> | null = null;
  private initialized = false;
  private serviceAccountEmail: string | null = null;
  private sheetDataInFlight = new Map<string, Promise<SheetRow[]>>();
  private sheetRawInFlight = new Map<
    string,
    Promise<(string | number | null)[][]>
  >();
  private readonly sheetTitleCacheTtlSec = 10 * 60; // 10 minutes
  private readonly sheetDataCacheTtlSec = Number(
    process.env.SHEETS_CACHE_TTL_SECONDS || 300
  );

  private titleCacheKey(spreadsheetId: string): string {
    return `sheets:${spreadsheetId}:titles`;
  }

  private dataCacheKey(
    spreadsheetId: string,
    sheetName: string,
    kind: "objects" | "raw"
  ): string {
    return `sheets:${spreadsheetId}:data:${kind}:${this.normalizeSheetName(
      sheetName
    )}`;
  }

  private async invalidateCachedRows(
    spreadsheetId: string,
    sheetName: string
  ): Promise<void> {
    const objectKey = this.dataCacheKey(spreadsheetId, sheetName, "objects");
    const rawKey = this.dataCacheKey(spreadsheetId, sheetName, "raw");
    await delKeys([objectKey, rawKey]);
    this.sheetDataInFlight.delete(objectKey);
    this.sheetRawInFlight.delete(rawKey);
  }

  private normalizeSheetName(sheetName: string): string {
    // remove accidental surrounding quotes and trim
    const trimmed = sheetName.trim().replace(/^'+|'+$/g, "");
    // escape internal single quotes for A1 notation
    const escaped = trimmed.replace(/'/g, "''");
    return escaped;
  }

  private a1(sheetName: string, rangeA1: string): string {
    const safe = this.normalizeSheetName(sheetName);
    return `'${safe}'!${rangeA1}`;
  }

  public formatRange(sheetName: string, rangeA1: string): string {
    return this.a1(sheetName, rangeA1);
  }

  private logRange(
    context: string,
    spreadsheetId: string,
    originalSheetName: string,
    normalizedSheetName: string,
    range: string
  ) {
    console.log(
      `[Sheets] ${context} | spreadsheetId=${spreadsheetId} | originalSheetName="${originalSheetName}" | normalizedSheetName="${normalizedSheetName}" | range=${range}`
    );
  }

  private warnIfUnquotedRange(range: string, context: string) {
    if (range.includes("!") && !range.startsWith("'")) {
      console.warn(
        `[Sheets] ${context}: range is not quoted; ensure it is built with formatRange()/a1() to avoid interpolation bugs.`
      );
    }
  }

  private async ensureSheetExists(
    spreadsheetId: string,
    sheetName: string
  ): Promise<string> {
    const normalized = this.normalizeSheetName(sheetName);
    const titleKey = this.titleCacheKey(spreadsheetId);
    const cachedTitles = await getJson<string[]>(titleKey);
    if (cachedTitles && cachedTitles.includes(normalized)) {
      return normalized;
    }

    const sheets = await this.getSheetNames(spreadsheetId);
    const titles = sheets.map((s) => this.normalizeSheetName(s.name));
    await setJson(titleKey, titles, this.sheetTitleCacheTtlSec);

    if (!titles.includes(normalized)) {
      throw new SheetNotFoundError(
        `Sheet not found: "${sheetName}" in spreadsheet ${spreadsheetId}`
      );
    }

    return normalized;
  }

  /**
   * Initialize authentication with service account
   * Must be called before any sheet operations
   *
   * @returns {Promise<void>}
   * @throws {Error} If service account file not found or invalid
   */
  async initialize(): Promise<void> {
    try {
      if (this.initialized && this.auth && this.sheets && this.drive) {
        return;
      }

      const serviceAccountPath = path.join(
        __dirname,
        "../../n8nworkflows-471200-2d198eaf6e2a.json"
      );

      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(
          `Service account file not found at ${serviceAccountPath}`
        );
      }

      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, "utf-8")
      );

      this.serviceAccountEmail = serviceAccount.client_email;

      this.auth = new JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      });

      // Type cast to any to avoid auth type mismatch (known googleapis issue)
      this.sheets = google.sheets({ version: "v4", auth: this.auth as any });
      this.drive = google.drive({ version: "v3", auth: this.auth as any });

      await this.auth.authorize();
      this.initialized = true;
      console.log(
        `✓ Google Sheets authentication initialized for ${this.serviceAccountEmail}`
      );
    } catch (error) {
      console.error("Failed to initialize Google Sheets:", error);
      throw error;
    }
  }

  /**
   * Verify that the service account credentials are usable
   * Returns metadata so the caller can show verification state to the user
   */
  async verifyServiceAccount(): Promise<{
    verified: boolean;
    email?: string | null;
    scopes?: string[];
    error?: string;
  }> {
    try {
      await this.initialize();

      if (!this.auth) {
        throw new Error("Auth not initialized");
      }

      await this.auth.authorize();

      return {
        verified: true,
        email: this.serviceAccountEmail,
        scopes: (this.auth as unknown as { scopes?: string[] }).scopes || [],
      };
    } catch (error) {
      console.error("Service account verification failed:", error);
      return {
        verified: false,
        email: this.serviceAccountEmail,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get all spreadsheets accessible by service account
   * Used to populate dropdown in frontend
   *
   * @returns {Promise<SheetMetadata[]>} Array of available sheets
   */
  async listSpreadsheets(): Promise<SheetMetadata[]> {
    await this.initialize();

    if (!this.drive) throw new Error("Drive not initialized");

    try {
      const res = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        spaces: "drive",
        fields: "files(id, name)",
        pageSize: 100,
      });

      return (
        res.data.files?.map((file) => ({
          id: file.id || "",
          name: file.name || "",
          sheetId: 0,
        })) || []
      );
    } catch (error) {
      console.error("Error listing spreadsheets:", error);
      throw error;
    }
  }

  /**
   * Get all sheet names in a spreadsheet
   *
   * @param {string} spreadsheetId - Google Sheets ID
   * @returns {Promise<SheetMetadata[]>} Array of sheet metadata
   */
  async getSheetNames(spreadsheetId: string): Promise<SheetMetadata[]> {
    await this.initialize();

    if (!this.sheets) throw new Error("Sheets not initialized");

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
      });

      return (
        response.data.sheets?.map((sheet) => ({
          id: spreadsheetId,
          name: sheet.properties?.title || "",
          sheetId: sheet.properties?.sheetId || 0,
        })) || []
      );
    } catch (error) {
      console.error("Error getting sheet names:", error);
      throw error;
    }
  }

  /**
   * Read data from a specific sheet
   *
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} sheetName - Name of the sheet (e.g., "meta_raw_daily")
   * @returns {Promise<SheetRow[]>} Array of rows with data
   */
  async readSheet(
    spreadsheetId: string,
    sheetName: string
  ): Promise<SheetRow[]> {
    await this.initialize();

    if (!this.sheets) throw new Error("Sheets not initialized");

    const cacheKey = this.dataCacheKey(spreadsheetId, sheetName, "objects");

    try {
      const cached = await getJson<SheetRow[]>(cacheKey);
      if (cached) return cached;

      const inFlight = this.sheetDataInFlight.get(cacheKey);
      if (inFlight) return inFlight;

      const fetchPromise = (async () => {
        const normalizedSheetName = await this.ensureSheetExists(
          spreadsheetId,
          sheetName
        );
        const range = this.a1(sheetName, "A1:Z");
        this.logRange(
          "readSheet",
          spreadsheetId,
          sheetName,
          normalizedSheetName,
          range
        );
        const response = await this.sheets!.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const rows: SheetRow[] = [];
        const values = response.data.values || [];

        if (values.length === 0) return rows;

        const headers = values[0];
        for (let i = 1; i < values.length; i++) {
          const row: SheetRow = {};
          for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = values[i][j] || null;
          }
          rows.push(row);
        }

        await setJson(cacheKey, rows, this.sheetDataCacheTtlSec);
        return rows;
      })();

      this.sheetDataInFlight.set(cacheKey, fetchPromise);
      const rows = await fetchPromise;
      return rows;
    } catch (error) {
      console.error("Error reading sheet:", error);
      throw error;
    } finally {
      this.sheetDataInFlight.delete(cacheKey);
    }
  }

  /**
   * Fetch raw values for a sheet (including header row)
   * Useful for custom processing like upserts.
   */
  async getRawValues(
    spreadsheetId: string,
    sheetName: string
  ): Promise<(string | number | null)[][]> {
    await this.initialize();

    if (!this.sheets) throw new Error("Sheets not initialized");

    const cacheKey = this.dataCacheKey(spreadsheetId, sheetName, "raw");

    try {
      const cached = await getJson<(string | number | null)[][]>(cacheKey);
      if (cached) return cached;

      const inFlight = this.sheetRawInFlight.get(cacheKey);
      if (inFlight) return inFlight;

      const fetchPromise = (async () => {
        const normalizedSheetName = await this.ensureSheetExists(
          spreadsheetId,
          sheetName
        );
        const range = this.a1(sheetName, "A1:Z");
        this.logRange(
          "getRawValues",
          spreadsheetId,
          sheetName,
          normalizedSheetName,
          range
        );
        const response = await this.sheets!.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const raw = (response.data.values as (string | number | null)[][]) || [];
        await setJson(cacheKey, raw, this.sheetDataCacheTtlSec);
        return raw;
      })();

      this.sheetRawInFlight.set(cacheKey, fetchPromise);
      return await fetchPromise;
    } catch (error) {
      console.error("Error reading raw sheet values:", error);
      throw error;
    } finally {
      this.sheetRawInFlight.delete(cacheKey);
    }
  }

  /**
   * Fetch values for an arbitrary A1 range using safe sheet handling
   */
  async getValues(
    spreadsheetId: string,
    sheetName: string,
    rangeA1: string
  ): Promise<(string | number | null)[][]> {
    await this.initialize();

    if (!this.sheets) throw new Error("Sheets not initialized");

    try {
      const normalizedSheetName = await this.ensureSheetExists(
        spreadsheetId,
        sheetName
      );
      const range = this.a1(sheetName, rangeA1);
      this.logRange(
        "getValues",
        spreadsheetId,
        sheetName,
        normalizedSheetName,
        range
      );
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return (response.data.values as (string | number | null)[][]) || [];
    } catch (error) {
      console.error("Error reading values:", error);
      throw error;
    }
  }

  /**
   * Write data to a specific sheet
   * Overwrites existing data in the range
   *
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} sheetName - Name of the sheet
   * @param {(string | number)[][]} values - 2D array of values to write
   * @returns {Promise<boolean>} Success status
   */
  async writeSheet(
    spreadsheetId: string,
    sheetName: string,
    values: (string | number | null)[][]
  ): Promise<boolean> {
    await this.initialize();

    if (!this.sheets) throw new Error("Sheets not initialized");

    try {
      const normalizedSheetName = await this.ensureSheetExists(
        spreadsheetId,
        sheetName
      );
      const range = this.a1(sheetName, "A1");
      this.logRange(
        "writeSheet",
        spreadsheetId,
        sheetName,
        normalizedSheetName,
        range
      );

      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values,
        },
      });

      this.invalidateCachedRows(spreadsheetId, sheetName);
      return true;
    } catch (error) {
      console.error("Error writing to sheet:", error);
      throw error;
    }
  }

  /**
   * Append a single row to the end of a sheet
   * Useful for adding daily metrics
   *
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} sheetName - Name of the sheet
   * @param {(string | number)[]} row - Values to append
   * @returns {Promise<boolean>} Success status
   */
  async appendRow(
    spreadsheetId: string,
    sheetName: string,
    row: (string | number | null)[]
  ): Promise<boolean> {
    await this.initialize();

    if (!this.sheets) throw new Error("Sheets not initialized");

    try {
      // Use sheet name only (API will find the next empty row)
      // Format: SheetName (not SheetName!A:Z which causes "Unable to parse range" error)
      const normalizedSheetName = await this.ensureSheetExists(
        spreadsheetId,
        sheetName
      );
      const range = `'${normalizedSheetName}'`;
      this.logRange(
        "appendRow",
        spreadsheetId,
        sheetName,
        normalizedSheetName,
        range
      );

      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values: [row],
        },
      });

      this.invalidateCachedRows(spreadsheetId, sheetName);
      return true;
    } catch (error) {
      console.error("Error appending row:", error);
      throw error;
    }
  }

  /**
   * Update a specific range in the sheet
   *
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} range - Range to update (e.g., "Sheet1!A1:B2")
   * @param {(string | number)[][]} values - Values to update
   * @returns {Promise<boolean>} Success status
   */
  async updateRange(
    spreadsheetId: string,
    range: string,
    values: (string | number | null)[][],
    sheetNameForLog?: string
  ): Promise<boolean> {
    await this.initialize();

    if (!this.sheets) throw new Error("Sheets not initialized");

    try {
      if (sheetNameForLog) {
        await this.ensureSheetExists(spreadsheetId, sheetNameForLog);
      }
      const originalSheetName = sheetNameForLog || "(unknown)";
      const normalizedSheetName =
        sheetNameForLog && this.normalizeSheetName(sheetNameForLog);
      this.warnIfUnquotedRange(range, "updateRange");
      this.logRange(
        "updateRange",
        spreadsheetId,
        originalSheetName,
        normalizedSheetName || "(unknown)",
        range
      );
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values,
        },
      });

      if (sheetNameForLog) {
        this.invalidateCachedRows(spreadsheetId, sheetNameForLog);
      }
      return true;
    } catch (error) {
      console.error("Error updating range:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const sheetsService = new SheetsService();
