/**
 * META INSIGHTS TO GOOGLE SHEETS AUTOMATION WORKFLOW (DEPRECATED)
 * ===================================================
 *
 * ⚠️  DEPRECATION WARNING: This module is deprecated. Please use the new Meta service
 * located at services/meta.service.ts which follows the same credential management
 * pattern as GA4 and Shopify services.
 *
 * WORKFLOW OVERVIEW:
 * 1. Fetch yesterday's Meta ad insights from Graph API endpoint
 * 2. Parse the complex JSON response structure (actions/action_values arrays)
 * 3. Extract and map specific metrics to predefined sheet columns
 * 4. Append the normalized row to the hardcoded Google Sheet (meta_raw_daily)
 *
 * API ENDPOINT:
 * - https://graph.facebook.com/v24.0/act_1458189648725469/insights
 * - Parameters: time_increment=1, date_preset=yesterday, action_breakdowns=action_type
 * - Fields: date_start, date_stop, spend, reach, impressions, clicks, actions, action_values
 *
 * TARGET SHEET:
 * - Spreadsheet: https://docs.google.com/spreadsheets/d/1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8
 * - Sheet Name: meta_raw_daily
 * - Columns: date, spend, reach, impressions, clicks, landing_page_views,
 *            add_to_cart, initiate_checkout, purchases, revenue
 *
 * DATA MAPPING RULES:
 * DATA MAPPING RULES (DETERMINISTIC - CANONICAL SOURCES ONLY):
 * - Basic fields (date_start, spend, reach, impressions, clicks) → direct mapping
 *
 * - landing_page_views → PICK ONLY: landing_page_view (NOT view_content which counts all visits)
 *                        fallback: omni_landing_page_view
 *
 * - add_to_cart → PICK ONLY (in order): add_to_cart, offsite_conversion.fb_pixel_add_to_cart,
 *                 omni_add_to_cart
 *
 * - initiate_checkout → PICK ONLY (in order): initiate_checkout,
 *                       offsite_conversion.fb_pixel_initiate_checkout, omni_initiated_checkout
 *
 * - purchases → PICK ONLY (in order): purchase, offsite_conversion.fb_pixel_purchase,
 *               omni_purchase, onsite_web_purchase, onsite_web_app_purchase, web_in_store_purchase
 *
 * - revenue → PICK CANONICAL SOURCE ONLY (do NOT sum variants):
 *             Order: purchase → offsite_conversion.fb_pixel_purchase → omni_purchase → ...
 *             WHY: Multiple purchase variants can exist in the data (all identical from Meta).
 *             Summing all 6 variants causes 6x double counting (15K becomes 94K).
 *             Solution: Always pick the first matching canonical source.
 *             Audit trail: metricSources.revenue_source shows which variant was used.
 * - Basic fields (date_start, spend, reach, impressions, clicks) → direct mapping
 * - landing_page_views → pick first match from: landing_page_view, omni_landing_page_view,
 *                         onsite_web_view_content, onsite_web_app_view_content,
 *                         offsite_conversion.fb_pixel_view_content
 * - add_to_cart → pick first match from: add_to_cart, omni_add_to_cart,
 *                 onsite_web_add_to_cart, onsite_web_app_add_to_cart,
 *                 offsite_conversion.fb_pixel_add_to_cart
 * - initiate_checkout → pick first match from: initiate_checkout, omni_initiated_checkout,
 *                       onsite_web_initiate_checkout, offsite_conversion.fb_pixel_initiate_checkout
 * - purchases → pick first match from: purchase, omni_purchase, onsite_web_purchase,
 *               onsite_web_app_purchase, offsite_conversion.fb_pixel_purchase,
 *               web_in_store_purchase
 * - revenue → sum all values from action_values for the same purchase types
 *
 * EXTENSIBILITY:
 * - Additional steps can be added to the runWorkflow() method
 * - New transformations can be added to the parsing logic
 * - Additional API calls can be chained before/after sheet append
 *
 * @module services/meta
 * @deprecated Use services/meta.service.ts instead
 */

import { sheetsService } from "./sheets.js";

export interface AppendResult {
  success: boolean;
  error?: string;
  mode?: "append" | "update" | "skip";
  rowNumber?: number;
  id?: number;
}

export interface ServiceAccountStatus {
  verified: boolean;
  email?: string | null;
  scopes?: string[];
  error?: string;
}

export interface MetaWorkflowResult {
  metrics: MetaInsightRow;
  appendResult: AppendResult;
  serviceAccount: ServiceAccountStatus;
  rawApiSample?: MetaApiResponse["data"][number];
}

// ============================================================================
// TYPES - Matching actual Meta Graph API response structure
// ============================================================================

/**
 * Meta action/action_value entry
 * Both actions and action_values arrays contain objects of this shape
 */
interface MetaAction {
  action_type: string;
  value: string; // Meta returns all values as strings, even numbers
}

/**
 * Raw Meta API response structure
 * Matches actual JSON returned from Graph API insights endpoint
 */
interface MetaApiResponse {
  data: Array<{
    date_start: string; // "2025-12-14"
    date_stop: string; // "2025-12-14"
    spend: string; // "13899.48"
    reach: string; // "20926"
    impressions: string; // "32479"
    clicks: string; // "1293"
    actions?: MetaAction[]; // Array of action_type and count
    action_values?: MetaAction[]; // Array of action_type and value (revenue)
  }>;
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

/**
 * Metric source tracking for audit trail
 * Documents which action_type variant was selected for each metric
 * Prevents regressions and makes data transformations deterministic
 */
interface MetricSources {
  landing_page_views_source: string;
  add_to_cart_source: string;
  initiate_checkout_source: string;
  purchases_source: string;
  revenue_source: string;
}

/**
 * Normalized row structure for meta_raw_daily sheet
 * All fields converted to numbers for calculations
 */
interface MetaInsightRow {
  id?: number;
  date: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  landing_page_views: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchases: number;
  revenue: number;
  metricSources?: MetricSources; // Optional: for audit trail (not stored in sheet)
}

// ============================================================================
// CONFIGURATION - Hardcoded per requirements
// ============================================================================

// IMPORTANT: Token is NOT included here anymore. Must be passed in runWorkflow()
// This prevents accidental token duplication and ensures fresh tokens are used
const META_ENDPOINT =
  "https://graph.facebook.com/v24.0/act_1458189648725469/insights?time_increment=1&date_preset=yesterday&action_breakdowns=action_type&fields=date_start%2Cdate_stop%2Cspend%2Creach%2Cimpressions%2Cclicks%2Cactions%2Caction_values";

export const META_SPREADSHEET_ID =
  "1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8";
export const META_SHEET_NAME = "meta_raw_daily";

export interface MetaRunOptions {
  spreadsheetId?: string;
  sheetName?: string;
}

// ============================================================================
// AUTOMATION WORKFLOW CLASS
// ============================================================================

class MetaInsightsWorkflow {
  // ========================================================================
  // UTILITY METHODS - Data parsing and type conversion
  // ========================================================================

  /**
   * Convert string value to number safely
   * Meta API returns all numeric values as strings
   */
  private toNumber(value?: string | number | null): number {
    if (value === undefined || value === null || value === "") return 0;
    const num = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  }

  /**
   * Pick first matching action and track which one was used
   * Returns both the value AND the source action_type for audit trail
   *
   * @param actions - Array of actions from Meta API response
   * @param types - List of action_type names to search for (in priority order)
   * @returns Object with numeric value and source action_type name
   */
  private pickActionWithSource(
    actions: MetaAction[] | undefined,
    types: string[]
  ): { value: number; source: string } {
    if (!actions) return { value: 0, source: "NOT_FOUND" };
    for (const type of types) {
      const hit = actions.find((a) => a.action_type === type);
      if (hit) return { value: this.toNumber(hit.value), source: type };
    }
    return { value: 0, source: "NOT_FOUND" };
  }

  /**
   * Pick first matching action from actions array
   * Returns the count/value of the first action_type that matches the list
   *
   * @param actions - Array of actions from Meta API response
   * @param types - List of action_type names to search for (in priority order)
   * @returns Numeric value of first match, or 0 if none found
   */
  private pickAction(actions: MetaAction[] | undefined, types: string[]): number {
    if (!actions) return 0;
    for (const type of types) {
      const hit = actions.find((a) => a.action_type === type);
      if (hit) return this.toNumber(hit.value);
    }
    return 0;
  }

  /**
   * DETERMINISTIC REVENUE: Pick canonical purchase action (do NOT sum variants)
   * Revenue must come from exactly ONE purchase action_type per day to prevent
   * double counting and ensure reproducibility.
   *
   * Canonical order (highest priority first):
   * 1. purchase (onsite web purchase via Conversions API)
   * 2. offsite_conversion.fb_pixel_purchase (pixel-tracked purchase)
   * 3. omni_purchase (omnichannel, unspecified channel)
   * 4. onsite_web_purchase (onsite web, older naming)
   * 5. onsite_web_app_purchase (onsite app)
   * 6. web_in_store_purchase (web-attributed store purchase)
   *
   * This approach ensures:
   * - No double counting across channel variants
   * - Deterministic output (same input always yields same revenue)
   * - Auditable: always know which variant was selected
   *
   * @param actionValues - Array of action_values from Meta API response
   * @returns Object with revenue value and source action_type
   */
  private pickRevenue(
    actionValues: MetaAction[] | undefined
  ): { value: number; source: string } {
    const purchaseVariants = [
      "purchase",
      "offsite_conversion.fb_pixel_purchase",
      "omni_purchase",
      "onsite_web_purchase",
      "onsite_web_app_purchase",
      "web_in_store_purchase",
    ];

    if (!actionValues) return { value: 0, source: "NO_DATA" };

    // Find all matching purchase variants with their values
    const foundVariants = purchaseVariants
      .map((variant) => {
        const entry = actionValues.find((av) => av.action_type === variant);
        return {
          type: variant,
          value: entry ? this.toNumber(entry.value) : null,
        };
      })
      .filter((v) => v.value !== null && v.value > 0);

    if (foundVariants.length === 0) {
      return { value: 0, source: "NO_PURCHASE_FOUND" };
    }

    // DUPLICATE DETECTION: If multiple purchase variants exist, log warning
    if (foundVariants.length > 1) {
      const values = foundVariants.map((v) => v.value ?? 0);
      const firstVal = values[0] ?? 0;
      const allEqual = values.every((v) => Math.abs(v - firstVal) < 0.01);

      if (allEqual) {
        console.warn(
          `⚠️ DUPLICATE PURCHASE ACTION_VALUES: Found ${foundVariants.length} purchase variants with nearly identical values (${values.join(", ")}).`
        );
        console.warn(
          `   Using canonical source: ${purchaseVariants[0]} = ${foundVariants[0].value}`
        );
      } else {
        console.error(
          `🔴 CONFLICTING PURCHASE ACTION_VALUES: Found ${foundVariants.length} variants with DIFFERENT values:`
        );
        foundVariants.forEach((v) => {
          console.error(`   - ${v.type}: ${v.value}`);
        });
        console.error(`   This is a data quality issue. Using canonical: ${foundVariants[0].type} = ${foundVariants[0].value}`);
      }
    }

    // Return canonical (first matching) variant
    return {
      value: foundVariants[0].value || 0,
      source: foundVariants[0].type,
    };
  }

  /**
   * Sum all matching action values from action_values array
   * DEPRECATED: Used only for backward compatibility testing
   * New code should use pickAction/pickRevenue for determinism
   *
   * @param actionValues - Array of action_values from Meta API response
   * @param types - List of action_type names to sum
   * @returns Total sum of all matching values
   */
  private sumActionValues(
    actionValues: MetaAction[] | undefined,
    types: string[]
  ): number {
    if (!actionValues) return 0;
    return actionValues.reduce((sum, entry) => {
      if (types.includes(entry.action_type)) {
        return sum + this.toNumber(entry.value);
      }
      return sum;
    }, 0);
  }

  // ========================================================================
  // STEP 1: FETCH DATA FROM META API
  // ========================================================================

  /**
   * Fetch yesterday's Meta insights from Graph API
   * Accepts dynamic access token parameter for flexibility
   *
   * @param accessToken - Meta Graph API access token
   * @returns Raw API response matching MetaApiResponse interface
   * @throws Error if API request fails or returns no data
   */
  private async fetchFromMetaApi(accessToken: string): Promise<MetaApiResponse> {
    console.log("📡 Fetching Meta insights from Graph API...");

    const fullUrl = `${META_ENDPOINT}&access_token=${encodeURIComponent(accessToken)}`;
    console.log(`URL: https://graph.facebook.com/v24.0/act_1458189648725469/insights [with token]`);

    let response: Response;
    try {
      response = await fetch(fullUrl);
    } catch (fetchError) {
      console.error("❌ Fetch error:", fetchError instanceof Error ? fetchError.message : fetchError);
      throw new Error(`Failed to reach Meta API: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`);
    }

    console.log(`✓ Got response - Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorBody = "";
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorJson = await response.json();
          errorBody = JSON.stringify(errorJson, null, 2);
        } else {
          errorBody = await response.text();
        }
      } catch (e) {
        errorBody = "(Could not parse error response)";
      }

      console.error(`❌ Meta API error response (${response.status}):`);
      console.error(errorBody);
      throw new Error(`Meta API error: HTTP ${response.status}\n${errorBody}`);
    }

    let json: MetaApiResponse;
    try {
      json = await response.json();
    } catch (parseError) {
      console.error("❌ Failed to parse JSON response:", parseError instanceof Error ? parseError.message : parseError);
      throw new Error(`Failed to parse Meta API response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`);
    }

    if (!json.data || json.data.length === 0) {
      console.error("❌ Meta API returned no data");
      console.log("Raw response:", JSON.stringify(json, null, 2));
      throw new Error("Meta API returned no data for yesterday");
    }

    console.log(`✓ Received ${json.data.length} row(s) from Meta API`);
    console.log(`📅 Date: ${json.data[0].date_start}`);
    console.log(`💰 Spend: ${json.data[0].spend}`);
    return json;
  }

  // ========================================================================
  // STEP 2: PARSE AND NORMALIZE DATA
  // ========================================================================

  /**
   * Parse Meta API response and extract metrics for sheet
   * Applies all data mapping rules to normalize the complex JSON structure
   *
   * DETERMINISTIC: Uses pickAction() and pickRevenue() to ensure:
   * - No double counting across action variants
   * - Same input → same output (reproducible)
   * - Clear audit trail of which variant was selected
   *
   * @param apiResponse - Raw response from Meta API
   * @returns Normalized row ready for sheet insertion (with source tracking)
   */
  private parseMetrics(apiResponse: MetaApiResponse): MetaInsightRow {
    console.log("🔄 Parsing and normalizing Meta API response...");

    const first = apiResponse.data[0];
    const actions: MetaAction[] = first.actions || [];
    const actionValues: MetaAction[] = first.action_values || [];

    console.log(`  Actions array: ${actions.length} items`);
    console.log(`  Action values array: ${actionValues.length} items`);

    // DETERMINISTIC METRIC EXTRACTION
    // Each metric picks ONE canonical source (no summing variants)

    // Landing Page Views: canonical is landing_page_view, fallback to omni
    // (NOT view_content / onsite_web_view_content / offsite_conversion.fb_pixel_view_content
    //  because those are different events)
    const lpvResult = this.pickActionWithSource(actions, [
      "landing_page_view",
      "omni_landing_page_view",
    ]);

    // Add to Cart: canonical, pixel, omni (in priority order)
    const atcResult = this.pickActionWithSource(actions, [
      "add_to_cart",
      "offsite_conversion.fb_pixel_add_to_cart",
      "omni_add_to_cart",
    ]);

    // Initiate Checkout: canonical, pixel, omni
    const icResult = this.pickActionWithSource(actions, [
      "initiate_checkout",
      "offsite_conversion.fb_pixel_initiate_checkout",
      "omni_initiated_checkout",
    ]);

    // Purchases (counts): canonical, pixel, omni
    const purchaseCountResult = this.pickActionWithSource(actions, [
      "purchase",
      "offsite_conversion.fb_pixel_purchase",
      "omni_purchase",
      "onsite_web_purchase",
      "onsite_web_app_purchase",
      "web_in_store_purchase",
    ]);

    // REVENUE (dollars): PICK ONE canonical source (NO SUMMING)
    const revenueResult = this.pickRevenue(actionValues);

    const normalized: MetaInsightRow = {
      date: first.date_start,
      spend: this.toNumber(first.spend),
      reach: this.toNumber(first.reach),
      impressions: this.toNumber(first.impressions),
      clicks: this.toNumber(first.clicks),
      landing_page_views: lpvResult.value,
      add_to_cart: atcResult.value,
      initiate_checkout: icResult.value,
      purchases: purchaseCountResult.value,
      revenue: revenueResult.value,
      metricSources: {
        landing_page_views_source: lpvResult.source,
        add_to_cart_source: atcResult.source,
        initiate_checkout_source: icResult.source,
        purchases_source: purchaseCountResult.source,
        revenue_source: revenueResult.source,
      },
    };

    console.log(`✓ Parsed metrics for ${normalized.date}:`);
    console.log(`  ├─ spend: ${normalized.spend}`);
    console.log(`  ├─ reach: ${normalized.reach}`);
    console.log(`  ├─ impressions: ${normalized.impressions}`);
    console.log(`  ├─ clicks: ${normalized.clicks}`);
    console.log(`  ├─ landing_page_views: ${normalized.landing_page_views} (${normalized.metricSources?.landing_page_views_source})`);
    console.log(`  ├─ add_to_cart: ${normalized.add_to_cart} (${normalized.metricSources?.add_to_cart_source})`);
    console.log(`  ├─ initiate_checkout: ${normalized.initiate_checkout} (${normalized.metricSources?.initiate_checkout_source})`);
    console.log(`  ├─ purchases: ${normalized.purchases} (${normalized.metricSources?.purchases_source})`);
    console.log(`  └─ revenue: ${normalized.revenue} (${normalized.metricSources?.revenue_source})`);

    return normalized;
  }

  // ========================================================================
  // STEP 3: FORMAT FOR SHEET
  // ========================================================================

  /**
   * Convert normalized metrics to sheet row array
   * Column order matches meta_raw_daily sheet structure
   *
   * @param metrics - Normalized metrics object
   * @returns Array of values in correct column order
   */
  private toSheetRow(metrics: MetaInsightRow): (string | number)[] {
    const row = [
      metrics.id ?? "",
      metrics.date,
      metrics.spend,
      metrics.reach,
      metrics.impressions,
      metrics.clicks,
      metrics.landing_page_views,
      metrics.add_to_cart,
      metrics.initiate_checkout,
      metrics.purchases,
      metrics.revenue,
    ];

    console.log(`📋 Sheet row prepared (${row.length} columns):`);
    console.log(`  ${JSON.stringify(row)}`);
    return row;
  }

  private columnLetterFromIndex(index: number): string {
    const safeIndex = index < 0 ? 0 : index;
    let n = safeIndex + 1;
    let letters = "";
    while (n > 0) {
      const remainder = (n - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  }

  // ========================================================================
  // STEP 4: APPEND TO GOOGLE SHEET
  // ========================================================================

  /**
   * Append normalized row to meta_raw_daily sheet
   * Uses service account authentication via sheetsService
   *
   * @param metrics - Normalized metrics to append
   * @param credentialJson - Optional credential JSON from database
   * @returns Success status
   */
  private async appendToSheet(
    metrics: MetaInsightRow,
    spreadsheetId: string,
    sheetName: string,
    credentialJson?: string
  ): Promise<boolean> {
    console.log("📝 Appending to Google Sheet...");
    console.log(`  Spreadsheet ID: ${spreadsheetId}`);
    console.log(`  Sheet Name: ${sheetName}`);

    try {
      if (!credentialJson) {
        throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
      }

      await sheetsService.initializeWithCredentials(credentialJson);
      console.log("  ✓ Sheets service initialized");

      const row = this.toSheetRow(metrics);
      const success = await sheetsService.appendRow(
        spreadsheetId,
        sheetName,
        row
      );

      if (success) {
        console.log(`✓ Successfully appended to ${sheetName}`);
      } else {
        console.error(`✗ Failed to append to ${sheetName}`);
      }

      return success;
    } catch (error) {
      console.error("❌ Error appending to sheet:");
      console.error(error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Upsert normalized row into meta_raw_daily sheet by date
   * - If date already exists in column B, replace that row (preserves existing id)
   * - Otherwise append a new row with next available id
   */
  private async upsertToSheet(
    metrics: MetaInsightRow,
    spreadsheetId: string,
    sheetName: string,
    credentialJson?: string
  ): Promise<AppendResult> {
    console.log("📝 Upserting into Google Sheet (by date)...");
    console.log(`  Spreadsheet ID: ${spreadsheetId}`);
    console.log(`  Sheet Name: ${sheetName}`);

    try {
      if (!credentialJson) {
        throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
      }

      await sheetsService.initializeWithCredentials(credentialJson);
      console.log("  ✓ Sheets service initialized");

      const headerValues = await sheetsService.getValues(
        spreadsheetId,
        sheetName,
        "A1:Z1"
      );
      const headerRow = (headerValues[0] || []) as (string | number | null)[];
      const normalizedHeader = headerRow.map((h) =>
        typeof h === "string" ? h.trim().toLowerCase() : ""
      );

      const dateHeaderIndex = normalizedHeader.findIndex((h) => h === "date");
      const idHeaderIndex = normalizedHeader.findIndex((h) => h === "id");

      const dateColIndex = dateHeaderIndex >= 0 ? dateHeaderIndex : 1;
      const idColIndex = idHeaderIndex >= 0 ? idHeaderIndex : 0;

      const dateColLetter = this.columnLetterFromIndex(dateColIndex);
      const idColLetter = this.columnLetterFromIndex(idColIndex);

      const dateRange = `${dateColLetter}2:${dateColLetter}`;
      const dateValues = await sheetsService.getValues(
        spreadsheetId,
        sheetName,
        dateRange
      );

      let existingRowNumber: number | null = null;
      for (let i = 0; i < dateValues.length; i++) {
        const dateCell = dateValues[i]?.[0];
        if (dateCell === metrics.date) {
          existingRowNumber = i + 2; // header row offset
          break;
        }
      }

      const idRange = `${idColLetter}2:${idColLetter}`;
      const idValues = await sheetsService.getValues(
        spreadsheetId,
        sheetName,
        idRange
      );

      const existingIdCell =
        existingRowNumber != null
          ? idValues[existingRowNumber - 2]?.[0]
          : undefined;
      const existingId = Number.isFinite(Number(existingIdCell))
        ? Number(existingIdCell)
        : null;

      const parsedIds = idValues
        .map((r) => Number(r?.[0]))
        .filter((n) => Number.isFinite(n)) as number[];
      const nextId = parsedIds.length > 0 ? Math.max(...parsedIds) + 1 : 1;

      const resolvedId = existingId ?? nextId;
      const row = this.toSheetRow({ ...metrics, id: resolvedId });

      if (existingRowNumber) {
        const range = sheetsService.formatRange(
          sheetName,
          `A${existingRowNumber}:K${existingRowNumber}`
        );
        await sheetsService.updateRange(
          spreadsheetId,
          range,
          [row],
          sheetName
        );
        console.log(
          `✓ Updated existing row for ${metrics.date} at ${range} (id=${resolvedId})`
        );
        return {
          success: true,
          mode: "update",
          rowNumber: existingRowNumber,
          id: resolvedId,
        };
      }

      const appendSuccess = await sheetsService.appendRow(
        spreadsheetId,
        sheetName,
        row
      );

      if (appendSuccess) {
        const appendedRowNumber = Math.max(dateValues.length, idValues.length) + 2;
        console.log(
          `✓ Appended new row for ${metrics.date} at ${sheetName}!A${appendedRowNumber} (id=${resolvedId})`
        );
        return {
          success: true,
          mode: "append",
          rowNumber: appendedRowNumber,
          id: resolvedId,
        };
      }

      console.error(`✗ Failed to append to ${sheetName}`);
      return { success: false, error: "Append returned false" };
    } catch (error) {
      console.error("❌ Error upserting to sheet:");
      console.error(error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown upsert error",
      };
    }
  }

  // ========================================================================
  // MAIN WORKFLOW ORCHESTRATOR
  // ========================================================================

  /**
   * Execute complete Meta insights workflow
   * Steps:
   * 1. Fetch data from Meta Graph API
   * 2. Parse and normalize the response
   * 3. Format for sheet structure
   * 4. Append to Google Sheet
   *
   * Additional steps can be added here for extended workflows
   *
   * @param accessToken - Meta Graph API access token
   * @param options - Optional workflow options
   * @param credentialJson - Optional credential JSON from database
   * @returns Normalized metrics that were appended
   * @throws Error if any step fails
   *
   * @deprecated Use the new MetaService from services/meta.service.ts instead
   */
  async runWorkflow(
    accessToken: string,
    options?: MetaRunOptions,
    credentialJson?: string
  ): Promise<MetaWorkflowResult> {
    console.warn(
      "⚠️  DEPRECATION WARNING: This Meta service is deprecated. " +
      "Please use the new MetaService from services/meta.service.ts which follows " +
      "the same credential management pattern as GA4 and Shopify services."
    );
    console.log("=".repeat(70));
    console.log("🚀 Starting Meta insights workflow...");
    console.log("=".repeat(70));

    if (!accessToken) {
      throw new Error("Access token is required to run Meta insights workflow");
    }

    try {
      // STEP 1: Fetch raw data from Meta API
      console.log("\n[STEP 1] Fetching from Meta API");
      console.log("-".repeat(70));
      const apiResponse = await this.fetchFromMetaApi(accessToken);

      // STEP 2: Parse and normalize the data
      console.log("\n[STEP 2] Parsing and normalizing data");
      console.log("-".repeat(70));
      const metrics = this.parseMetrics(apiResponse);

      // STEP 2.5: Verify service account so we can report status even if append fails
      let serviceAccount;
      if (credentialJson) {
        await sheetsService.initializeWithCredentials(credentialJson);
        serviceAccount = await sheetsService.verifyServiceAccount(credentialJson);
      } else {
        throw new Error("Google Sheets credentials are required. Please provide credentials via the credential management system.");
      }

      // STEP 3 & 4: Format and append to sheet
      console.log("\n[STEP 3] Formatting for sheet");
      console.log("-".repeat(70));
      this.toSheetRow(metrics); // This logs the formatted row

      console.log("\n[STEP 4] Appending to Google Sheet");
      console.log("-".repeat(70));
      const targetSpreadsheetId = options?.spreadsheetId || META_SPREADSHEET_ID;
      const targetSheetName = options?.sheetName || META_SHEET_NAME;
      const appendResult = await this.upsertToSheet(
        metrics,
        targetSpreadsheetId,
        targetSheetName,
        credentialJson
      );
      if (appendResult.id !== undefined) {
        metrics.id = appendResult.id;
      }

      console.log("\n" + "=".repeat(70));
      console.log("✅ Meta insights workflow completed");
      console.log("=".repeat(70));

      // EXTENSIBILITY POINT: Additional workflow steps can be added here
      // Examples:
      // - await this.notifySlack(metrics);
      // - await this.updateDashboard(metrics);
      // - await this.triggerDownstreamJobs(metrics);

      return {
        metrics,
        appendResult,
        serviceAccount,
        rawApiSample: apiResponse.data?.[0],
      };
    } catch (error) {
      console.log("\n" + "=".repeat(70));
      console.error("❌ Workflow failed");
      console.error("=".repeat(70));
      console.error(error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const metaInsightsWorkflow = new MetaInsightsWorkflow();
