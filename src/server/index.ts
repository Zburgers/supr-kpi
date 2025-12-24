/**
 * Express server for Google Sheets manager
 * API endpoints for sheet operations
 *
 * @module server
 * @see {@link http://localhost:3000} - Frontend
 * @see {@link http://localhost:3000/api} - API docs
 */

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import cron from "node-cron";
import { fileURLToPath } from "url";
import { sheetsService } from "../services/sheets.js";
import {
  META_SHEET_NAME,
  META_SPREADSHEET_ID,
  metaInsightsWorkflow,
} from "../services/meta.js";
import type { MetaWorkflowResult } from "../services/meta.js";
import {
  SHOPIFY_SHEET_NAME,
  SHOPIFY_SPREADSHEET_ID,
  shopifyWorkflow,
} from "../services/shopify.js";
import {
  GA_SHEET_NAME,
  GA_SPREADSHEET_ID,
  googleAnalyticsWorkflow,
} from "../services/google.js";
import { ApiResponse, SheetRow } from "../types/kpi.js";

// Setup for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
// Serve static files from public folder (from project root, not dist)
app.use(express.static(path.join(__dirname, "../../public")));

// ==================== SCHEDULER SETUP ====================
let schedulerActive = false;
let cronJob: cron.ScheduledTask | null = null;

// Cron schedule: Run between 2:00 AM and 2:30 AM IST daily
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 2 * * *"; // 2:00 AM daily
const TIMEZONE = process.env.TZ || "Asia/Kolkata";

/**
 * Run the daily sync job
 * Fetches yesterday's data from Meta, GA4, and Shopify
 */
async function runDailySync() {
  console.log("\n⏰ [SCHEDULER] Daily sync job started at", new Date().toISOString());
  
  const results: { platform: string; success: boolean; error?: string }[] = [];

  // Get credentials from environment
  const metaToken = process.env.META_ACCESS_TOKEN;
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const ga4Token = process.env.GOOGLE_ACCESS_TOKEN;
  const ga4PropertyId = process.env.GA4_PROPERTY_ID;

  // Meta sync
  if (metaToken) {
    try {
      console.log("📘 [SCHEDULER] Syncing Meta data...");
      const result = await metaInsightsWorkflow.runWorkflow(metaToken, {});
      results.push({ 
        platform: "Meta", 
        success: result.appendResult.success,
        error: result.appendResult.success ? undefined : result.appendResult.error
      });
      console.log("✅ [SCHEDULER] Meta sync completed");
    } catch (error) {
      results.push({ 
        platform: "Meta", 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      console.error("❌ [SCHEDULER] Meta sync failed:", error);
    }
  } else {
    console.log("⚠️ [SCHEDULER] Meta token not configured, skipping");
  }

  // Shopify sync
  if (shopifyDomain && shopifyToken) {
    try {
      console.log("🏪 [SCHEDULER] Syncing Shopify data...");
      const result = await shopifyWorkflow.runWorkflow(shopifyDomain, shopifyToken, {});
      results.push({ 
        platform: "Shopify", 
        success: result.appendResult.success,
        error: result.appendResult.success ? undefined : result.appendResult.error
      });
      console.log("✅ [SCHEDULER] Shopify sync completed");
    } catch (error) {
      results.push({ 
        platform: "Shopify", 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      console.error("❌ [SCHEDULER] Shopify sync failed:", error);
    }
  } else {
    console.log("⚠️ [SCHEDULER] Shopify credentials not configured, skipping");
  }

  // GA4 sync
  if (ga4Token && ga4PropertyId) {
    try {
      console.log("📊 [SCHEDULER] Syncing GA4 data...");
      const result = await googleAnalyticsWorkflow.runWorkflow(ga4Token, ga4PropertyId, {});
      results.push({ 
        platform: "GA4", 
        success: result.appendResult.success || result.appendResult.mode === "skip",
        error: result.appendResult.success || result.appendResult.mode === "skip" ? undefined : result.appendResult.error
      });
      console.log("✅ [SCHEDULER] GA4 sync completed");
    } catch (error) {
      results.push({ 
        platform: "GA4", 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      console.error("❌ [SCHEDULER] GA4 sync failed:", error);
    }
  } else {
    console.log("⚠️ [SCHEDULER] GA4 credentials not configured, skipping");
  }

  console.log("\n📋 [SCHEDULER] Daily sync job completed. Results:");
  results.forEach(r => {
    console.log(`  ${r.success ? "✅" : "❌"} ${r.platform}: ${r.success ? "Success" : r.error}`);
  });

  return results;
}

/**
 * Start the scheduler
 */
function startScheduler() {
  if (schedulerActive && cronJob) {
    console.log("⚠️ [SCHEDULER] Already running");
    return;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error("❌ [SCHEDULER] Invalid cron schedule:", CRON_SCHEDULE);
    return;
  }

  cronJob = cron.schedule(
    CRON_SCHEDULE,
    async () => {
      await runDailySync();
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  schedulerActive = true;
  console.log(`✅ [SCHEDULER] Started with schedule "${CRON_SCHEDULE}" in timezone ${TIMEZONE}`);
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  schedulerActive = false;
  console.log("🛑 [SCHEDULER] Stopped");
}

/**
 * Get next scheduled run time
 */
function getNextScheduledRun(): Date | null {
  if (!schedulerActive) return null;

  const parts = CRON_SCHEDULE.split(" ");
  if (parts.length !== 5) return null;

  const [minute, hour] = parts;
  const now = new Date();
  const next = new Date(now);

  next.setHours(parseInt(hour, 10) || 0);
  next.setMinutes(parseInt(minute, 10) || 0);
  next.setSeconds(0);
  next.setMilliseconds(0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Health check endpoint
 */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "Server is running" });
});

/**
 * Initialize sheets service - DEPRECATED
 * This endpoint is deprecated and will be removed in future versions.
 * Sheets authentication should now be handled with user-specific credentials.
 */
app.get("/api/init", async (_req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: "This endpoint is deprecated. Sheets authentication should now be handled with user-specific credentials via the credential management system."
  });
});

/**
 * List all accessible spreadsheets
 * Frontend uses this to populate dropdown
 *
 * @route GET /api/spreadsheets
 * @returns {ApiResponse<Array>} List of spreadsheets
 */
app.get("/api/spreadsheets", async (_req: Request, res: Response) => {
  try {
    const spreadsheets = await sheetsService.listSpreadsheets();
    res.json({ success: true, data: spreadsheets });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Get sheet names from a spreadsheet
 *
 * @route GET /api/sheets/:spreadsheetId
 * @param {string} spreadsheetId - Google Sheets ID
 * @returns {ApiResponse<Array>} List of sheets
 */
app.get("/api/sheets/:spreadsheetId", async (req: Request, res: Response) => {
  try {
    const { spreadsheetId } = req.params;
    const sheets = await sheetsService.getSheetNames(spreadsheetId);
    res.json({ success: true, data: sheets });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Read data from a sheet
 *
 * @route GET /api/data/:spreadsheetId/:sheetName
 * @param {string} spreadsheetId - Google Sheets ID
 * @param {string} sheetName - Name of the sheet
 * @returns {ApiResponse<Array>} Sheet data as rows
 */
app.get(
  "/api/data/:spreadsheetId/:sheetName",
  async (req: Request, res: Response) => {
    try {
      const { spreadsheetId, sheetName } = req.params;
      const data = await sheetsService.readSheet(spreadsheetId, sheetName);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Write data to a sheet (overwrites)
 *
 * @route POST /api/data/:spreadsheetId/:sheetName
 * @body {Array<Array>} values - 2D array of values
 * @returns {ApiResponse<boolean>} Success status
 */
app.post(
  "/api/data/:spreadsheetId/:sheetName",
  async (req: Request, res: Response) => {
    try {
      const { spreadsheetId, sheetName } = req.params;
      const { values } = req.body;

      if (!Array.isArray(values)) {
        res.status(400).json({
          success: false,
          error: "Values must be an array",
        });
        return;
      }

      const success = await sheetsService.writeSheet(
        spreadsheetId,
        sheetName,
        values
      );

      res.json({
        success,
        message: success ? "Data written successfully" : "Failed to write data",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Update a specific range
 *
 * @route PUT /api/range/:spreadsheetId
 * @body {string} range - Range to update (e.g., "Sheet1!A1:B2")
 * @body {Array<Array>} values - 2D array of values
 * @returns {ApiResponse<boolean>} Success status
 */
app.put(
  "/api/range/:spreadsheetId",
  async (req: Request, res: Response) => {
    try {
      const { spreadsheetId } = req.params;
      const { range, values } = req.body;

      if (!range || !Array.isArray(values)) {
        res.status(400).json({
          success: false,
          error: "Range and values are required",
        });
        return;
      }

      const success = await sheetsService.updateRange(
        spreadsheetId,
        range,
        values
      );

      res.json({
        success,
        message: success ? "Range updated successfully" : "Failed to update",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Append a row to a sheet
 *
 * @route POST /api/append/:spreadsheetId/:sheetName
 * @body {Array} row - Values to append
 * @returns {ApiResponse<boolean>} Success status
 */
app.post(
  "/api/append/:spreadsheetId/:sheetName",
  async (req: Request, res: Response) => {
    try {
      const { spreadsheetId, sheetName } = req.params;
      const { row } = req.body;

      if (!Array.isArray(row)) {
        res.status(400).json({
          success: false,
          error: "Row must be an array",
        });
        return;
      }

      const success = await sheetsService.appendRow(
        spreadsheetId,
        sheetName,
        row
      );

      res.json({
        success,
        message: success ? "Row appended successfully" : "Failed to append",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Fetch Meta daily insights (yesterday) and append to meta_raw_daily sheet
 * Triggers the complete automation workflow defined in meta.ts
 * Accepts access token in request body to support temporary/rotating tokens
 */
app.post("/api/meta/fetch", async (req: Request, res: Response) => {
  try {
    console.log("\n🔵 [API] POST /api/meta/fetch - Request received");

    const { accessToken, spreadsheetId, sheetName } = req.body || {};

    if (!accessToken) {
      console.error("❌ [API] Missing accessToken in request body");
      return res.status(400).json({
        success: false,
        error: "Access token is required. Please provide accessToken in request body.",
      });
    }

    console.log("✓ [API] Access token received, starting workflow...");
    const result: MetaWorkflowResult = await metaInsightsWorkflow.runWorkflow(
      accessToken,
      {
        spreadsheetId: typeof spreadsheetId === "string" && spreadsheetId.trim() ? spreadsheetId.trim() : undefined,
        sheetName: typeof sheetName === "string" && sheetName.trim() ? sheetName.trim() : undefined,
      }
    );

    const usedSheetName = req.body?.sheetName || META_SHEET_NAME;
    const appendMessage = result.appendResult.success
      ? `Meta insights for ${result.metrics.date} appended to ${usedSheetName}`
      : `Meta insights for ${result.metrics.date} fetched but NOT appended to sheet (${result.appendResult.error || "no error message"})`;

    console.log("\n🟢 [API] Sending success response");
    return res.json({
      success: true,
      data: {
        metrics: result.metrics,
        appendResult: result.appendResult,
        serviceAccount: result.serviceAccount,
        rawApi: result.rawApiSample,
        spreadsheetId: req.body?.spreadsheetId || META_SPREADSHEET_ID,
        sheetName: usedSheetName,
      },
      message: appendMessage,
    });
  } catch (error) {
    console.log("\n🔴 [API] Sending error response");
    console.error("[API] Error details:", error instanceof Error ? error.message : error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Fetch Shopify daily metrics (yesterday) via ShopifyQL and append to sheet
 * Requires store domain and private app access token
 */
app.post("/api/shopify/fetch", async (req: Request, res: Response) => {
  try {
    console.log("\n🔵 [API] POST /api/shopify/fetch - Request received");

    const { storeDomain, accessToken, spreadsheetId, sheetName } = req.body || {};

    if (!storeDomain || !accessToken) {
      return res.status(400).json({
        success: false,
        error:
          "storeDomain and accessToken are required. Please provide both in request body.",
      });
    }

    const result = await shopifyWorkflow.runWorkflow(storeDomain, accessToken, {
      spreadsheetId:
        typeof spreadsheetId === "string" && spreadsheetId.trim()
          ? spreadsheetId.trim()
          : undefined,
      sheetName:
        typeof sheetName === "string" && sheetName.trim() ? sheetName.trim() : undefined,
    });

    const message = result.appendResult.success
      ? `Shopify metrics for ${result.metrics.date} appended to ${result.sheetName}`
      : `Shopify metrics for ${result.metrics.date} fetched but NOT appended (${result.appendResult.error || "no error message"})`;

    console.log("\n🟢 [API] Sending Shopify success response");
    return res.json({
      success: true,
      data: result,
      message,
    });
  } catch (error) {
    console.log("\n🔴 [API] Sending Shopify error response");
    console.error("[API] Shopify error details:", error instanceof Error ? error.message : error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Fetch GA4 daily metrics (yesterday) and append to sheet if missing
 * Requires OAuth access token and GA4 property ID
 */
app.post("/api/google/fetch", async (req: Request, res: Response) => {
  try {
    console.log("\n🔵 [API] POST /api/google/fetch - Request received");

    const { accessToken, propertyId, spreadsheetId, sheetName } = req.body || {};

    if (!accessToken || !propertyId) {
      return res.status(400).json({
        success: false,
        error: "accessToken and propertyId are required.",
      });
    }

    const result = await googleAnalyticsWorkflow.runWorkflow(accessToken, propertyId, {
      spreadsheetId:
        typeof spreadsheetId === "string" && spreadsheetId.trim()
          ? spreadsheetId.trim()
          : undefined,
      sheetName:
        typeof sheetName === "string" && sheetName.trim() ? sheetName.trim() : undefined,
    });

    const message = result.appendResult.mode === "skip"
      ? `GA4 metrics for ${result.metrics.date} already present in ${result.sheetName}; append skipped`
      : result.appendResult.success
        ? `GA4 metrics for ${result.metrics.date} appended to ${result.sheetName}`
        : `GA4 metrics for ${result.metrics.date} fetched but NOT appended (${result.appendResult.error || "no error message"})`;

    console.log("\n🟢 [API] Sending Google success response");
    return res.json({
      success: true,
      data: result,
      message,
    });
  } catch (error) {
    console.log("\n🔴 [API] Sending Google error response");
    console.error("[API] Google error details:", error instanceof Error ? error.message : error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ==================== RAW DATA ENDPOINT ====================

/**
 * Get raw sheet data (all values including headers)
 * Used for the Sheet Viewer component
 */
app.get(
  "/api/data/raw/:spreadsheetId/:sheetName",
  async (req: Request, res: Response) => {
    try {
      const { spreadsheetId, sheetName } = req.params;
      const data = await sheetsService.getRawValues(spreadsheetId, sheetName);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// ==================== SCHEDULER API ENDPOINTS ====================

/**
 * Get scheduler status
 */
app.get("/api/v1/scheduler/status", (_req: Request, res: Response) => {
  const nextRun = getNextScheduledRun();
  res.json({
    success: true,
    data: {
      isActive: schedulerActive,
      schedule: CRON_SCHEDULE,
      timezone: TIMEZONE,
      nextRun: nextRun ? nextRun.toISOString() : null,
    },
  });
});

/**
 * Start the scheduler
 */
app.post("/api/v1/scheduler/start", (_req: Request, res: Response) => {
  startScheduler();
  res.json({
    success: true,
    message: "Scheduler started",
  });
});

/**
 * Stop the scheduler
 */
app.post("/api/v1/scheduler/stop", (_req: Request, res: Response) => {
  stopScheduler();
  res.json({
    success: true,
    message: "Scheduler stopped",
  });
});

/**
 * Manually trigger a sync
 */
app.post("/api/v1/scheduler/trigger", async (_req: Request, res: Response) => {
  try {
    console.log("\n🔵 [API] Manual sync trigger requested");
    const results = await runDailySync();
    res.json({
      success: true,
      data: { results },
      message: "Manual sync completed",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ==================== SYNC ALL ENDPOINT ====================

/**
 * Sync all platforms at once
 */
app.post("/api/v1/sync/all", async (req: Request, res: Response) => {
  try {
    console.log("\n🔵 [API] Sync all platforms requested");
    const results = await runDailySync();
    res.json({
      success: true,
      data: { results },
      message: "Sync completed for all configured platforms",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ==================== DIRECT SYNC ENDPOINTS ====================

/**
 * Direct Meta sync with credentials from request
 */
app.post("/api/v1/sync/meta/direct", async (req: Request, res: Response) => {
  try {
    const { accessToken, spreadsheetId, sheetName, targetDate } = req.body || {};

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: "accessToken is required",
      });
    }

    const result = await metaInsightsWorkflow.runWorkflow(accessToken, {
      spreadsheetId: spreadsheetId || undefined,
      sheetName: sheetName || undefined,
    });

    return res.json({
      success: true,
      data: {
        metrics: result.metrics,
        appendResult: result.appendResult,
      },
      message: result.appendResult.success
        ? `Meta data appended successfully`
        : `Meta data fetched but not appended: ${result.appendResult.error}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Direct GA4 sync with credentials from request
 */
app.post("/api/v1/sync/ga4/direct", async (req: Request, res: Response) => {
  try {
    const { accessToken, propertyId, spreadsheetId, sheetName, targetDate } = req.body || {};

    if (!accessToken || !propertyId) {
      return res.status(400).json({
        success: false,
        error: "accessToken and propertyId are required",
      });
    }

    const result = await googleAnalyticsWorkflow.runWorkflow(accessToken, propertyId, {
      spreadsheetId: spreadsheetId || undefined,
      sheetName: sheetName || undefined,
    });

    return res.json({
      success: true,
      data: {
        metrics: result.metrics,
        appendResult: result.appendResult,
      },
      message: result.appendResult.mode === "skip"
        ? `GA4 data already exists for this date`
        : result.appendResult.success
          ? `GA4 data appended successfully`
          : `GA4 data fetched but not appended: ${result.appendResult.error}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Direct Shopify sync with credentials from request
 */
app.post("/api/v1/sync/shopify/direct", async (req: Request, res: Response) => {
  try {
    const { storeDomain, accessToken, spreadsheetId, sheetName, targetDate } = req.body || {};

    if (!storeDomain || !accessToken) {
      return res.status(400).json({
        success: false,
        error: "storeDomain and accessToken are required",
      });
    }

    const result = await shopifyWorkflow.runWorkflow(storeDomain, accessToken, {
      spreadsheetId: spreadsheetId || undefined,
      sheetName: sheetName || undefined,
    });

    return res.json({
      success: true,
      data: {
        metrics: result.metrics,
        appendResult: result.appendResult,
      },
      message: result.appendResult.success
        ? `Shopify data appended successfully`
        : `Shopify data fetched but not appended: ${result.appendResult.error}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Fallback route - serve the SPA
app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../public/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Open http://localhost:${PORT} in browser`);
  
  // Auto-start the scheduler in production
  if (process.env.NODE_ENV === "production" || process.env.AUTO_START_SCHEDULER === "true") {
    console.log("\n🕐 Auto-starting scheduler...");
    startScheduler();
  } else {
    console.log("\n💡 Scheduler is not auto-started. Use /api/v1/scheduler/start to enable.");
  }
});
