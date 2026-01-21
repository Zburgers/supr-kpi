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
import { fileURLToPath } from "url";
import { sheetsService } from "../services/sheets.js";
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



// Fallback route - serve the SPA
app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../public/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Open http://localhost:${PORT} in browser`);
});
