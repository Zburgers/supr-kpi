# Google Sheets KPI Data Manager

A minimalistic TypeScript web application for managing Google Sheets data with a lightweight frontend. Designed for KPI tracking with support for the `meta_raw_daily` sheet structure.

## 📋 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Frontend Guide](#frontend-guide)
- [Data Types](#data-types)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **Google Sheets Integration**: Connect via service account authentication
- **Sheet Selection**: Dropdown to browse all accessible sheets
- **Data Loading**: Fetch and display sheet data with virtual scrolling
- **In-place Editing**: Click to edit cells with visual feedback
- **Lazy Loading**: Optimized performance with progressive row loading
- **Resizable Columns**: Auto-fit column widths (CSS-based)
- **Confirmation Dialog**: Confirm before saving changes to prevent accidents
- **Real-time Validation**: Check cell changes before commit
- **Bulk Operations**: Save all changes at once

## 📁 Project Structure

```
.
├── public/                          # Frontend files (served as static)
│   ├── index.html                   # Main HTML template
│   ├── app.js                       # Main app logic
│   ├── utils.js                     # Utility functions
│   └── styles.css                   # Styling
├── src/
│   ├── server/
│   │   └── index.ts                 # Express server & API routes
│   ├── services/
│   │   └── sheets.ts                # Google Sheets API wrapper
│   └── types/
│       └── kpi.ts                   # TypeScript type definitions
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── n8nworkflows-*.json              # Service account (DO NOT COMMIT)
└── README.md                        # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Start Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 4. Open Browser

Navigate to `http://localhost:3000`

## 📡 API Documentation

All endpoints return JSON with `{ success: boolean, data?: any, error?: string }`

### Authentication

All endpoints require the service account file: `n8nworkflows-471200-2d198eaf6e2a.json`

### Endpoints

#### `GET /api/health`
Health check endpoint.

```bash
curl http://localhost:3000/api/health
```

#### `GET /api/init`
Initialize sheets service with authentication.

```bash
curl http://localhost:3000/api/init
```

---

#### `GET /api/spreadsheets`
List all accessible spreadsheets from Google Drive.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "1A2B3C", "name": "KPI Dashboard", "sheetId": 0 }
  ]
}
```

---

#### `GET /api/sheets/:spreadsheetId`
Get all sheet names in a spreadsheet.

**Example:**
```bash
curl "http://localhost:3000/api/sheets/1A2B3C"
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "1A2B3C", "name": "meta_raw_daily", "sheetId": 0 },
    { "id": "1A2B3C", "name": "Calculations", "sheetId": 1 }
  ]
}
```

---

#### `GET /api/data/:spreadsheetId/:sheetName`
Read all data from a sheet.

**Example:**
```bash
curl "http://localhost:3000/api/data/1A2B3C/meta_raw_daily"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-12-01",
      "spend": 150.50,
      "reach": 5000,
      "impressions": 12500,
      ...
    }
  ]
}
```

---

#### `POST /api/data/:spreadsheetId/:sheetName`
Write/overwrite data in a sheet.

**Example:**
```bash
curl -X POST "http://localhost:3000/api/data/1A2B3C/meta_raw_daily" \
  -H "Content-Type: application/json" \
  -d '{
    "values": [
      ["date", "spend", "reach", "impressions"],
      ["2025-12-01", 150.50, 5000, 12500]
    ]
  }'
```

---

#### `PUT /api/range/:spreadsheetId`
Update a specific range in the sheet.

**Example:**
```bash
curl -X PUT "http://localhost:3000/api/data/1A2B3C" \
  -H "Content-Type: application/json" \
  -d '{
    "range": "meta_raw_daily!A2:C2",
    "values": [["2025-12-01", 150.50, 5000]]
  }'
```

---

#### `POST /api/append/:spreadsheetId/:sheetName`
Append a single row to the end of a sheet.

**Example:**
```bash
curl -X POST "http://localhost:3000/api/append/1A2B3C/meta_raw_daily" \
  -H "Content-Type: application/json" \
  -d '{
    "row": ["2025-12-02", 160.75, 5200, 12800, 450, 380, 25, 12, 3, 450]
  }'
```

## 🎨 Frontend Guide

### Workflow

1. **Load Spreadsheet**: Select from dropdown or paste Sheet ID/URL
2. **Select Sheet**: Choose target sheet (e.g., "meta_raw_daily")
3. **Load Data**: Click "Load Data" button
4. **Edit Cells**: Click any cell to edit
5. **Save Changes**: Click "Save All Changes" to commit to Google Sheets

### UI Components

#### Spreadsheet Selection
- **Dropdown**: Auto-populated from Google Drive
- **Manual Input**: Paste Sheet URL or ID directly
- Supports full URLs: `https://docs.google.com/spreadsheets/d/SHEET_ID/...`

#### Data Table
- **Virtual Scrolling**: Loads 20 rows initially, adds more on scroll
- **Resizable Columns**: Click header dividers to resize
- **Cell Selection**: Click to select, shows in right sidebar
- **Visual Feedback**:
  - Blue highlight: Currently selected
  - Yellow background: Locally edited (not saved)

#### Editor Panel (Right Sidebar)
- **Cell Reference**: Shows selected cell location
- **Edit Input**: Change value here
- **Save Cell**: Save individual cell
- **Keyboard Shortcut**: Press Enter to save

#### Status Messages
- **Green**: Success messages (auto-dismiss after 3s)
- **Red**: Error messages (persistent)
- **Blue**: Info messages (auto-dismiss)

### Confirmation Dialog

Before saving all changes to the sheet, a confirmation dialog appears:

```
Confirm Update

Save 5 changes to "meta_raw_daily"? This will overwrite the original data.

[✓ Confirm] [✕ Cancel]
```

This prevents accidental overwrites.

## 📊 Data Types

### DailyMetrics Interface

```typescript
interface DailyMetrics {
  date: string;              // YYYY-MM-DD format
  spend: number;             // Ad spend amount
  reach: number;             // People reached
  impressions: number;       // Total impressions
  clicks: number;            // Number of clicks
  landing_page_views: number;  // LPV count
  add_to_cart: number;       // Add to cart events
  initiate_checkout: number; // Checkout initiated
  purchases: number;         // Purchase count
  revenue: number;           // Revenue (if available)
}
```

### SheetRow Interface

Generic row object from any sheet:

```typescript
interface SheetRow {
  [key: string]: string | number | boolean | null | undefined;
}
```

### API Response

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

## ⚙️ Configuration

### Environment Variables

Create `.env` file (optional):

```env
PORT=3000
NODE_ENV=development
```

### Service Account Setup

1. Place `n8nworkflows-471200-2d198eaf6e2a.json` in project root
2. Ensure service account has these scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.readonly`

### TypeScript Configuration

See `tsconfig.json` for compiler options:
- Target: ES2020
- Module: CommonJS
- Strict mode: enabled
- Source maps: enabled

## 🔧 Troubleshooting

### "Service account file not found"

**Solution**: Ensure `n8nworkflows-471200-2d198eaf6e2a.json` exists in project root.

```bash
ls n8nworkflows-*.json
```

### "Sheets not initialized"

**Solution**: Call `GET /api/init` before other operations. Frontend does this automatically on page load.

### "Failed to load spreadsheets"

**Possible causes**:
- Service account has no Sheets access
- Google Drive API not enabled in project
- Invalid credentials

**Solution**: Verify service account email has access to the sheet.

### "Blank data loads"

**Causes**:
- Empty sheet
- Wrong sheet name
- Data starts after column A

**Solution**: Verify sheet URL and manually check data in Google Sheets.

### CORS errors

**Solution**: CORS is enabled in server (`app.use(cors())`). If issues persist:

1. Check network tab in DevTools
2. Verify API endpoints are correct
3. Check server logs for errors

## 📚 Backlinks for Development

### Key Files

- **Types** → [`src/types/kpi.ts`](#data-types)
- **API Routes** → [`src/server/index.ts`](#api-documentation)
- **Google Sheets Service** → [`src/services/sheets.ts`](./src/services/sheets.ts)
- **Frontend App** → [`public/app.js`](./public/app.js)
- **Utilities** → [`public/utils.js`](./public/utils.js)

### External References

- [Google Sheets API](https://developers.google.com/sheets/api)
- [Service Account Auth](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Express.js Documentation](https://expressjs.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

## 🔐 Security Notes

- **Service Account**: Never commit `n8nworkflows-*.json` to git
- **Data Validation**: Implement input validation before sending to API
- **Rate Limiting**: Add rate limits for production deployments
- **Audit Logging**: Log all sheet modifications

## 📦 Dependencies

### Production

- `express`: Web server
- `googleapis`: Google API client
- `google-auth-library`: Authentication
- `cors`: Cross-origin requests
- `dotenv`: Environment variables

### Development

- `typescript`: Type checking
- `@types/node`: Node types
- `@types/express`: Express types
- `concurrently`: Run multiple commands

## 📝 License

ISC

## 🤖 Discord Notifications

The system includes a Discord notification system to alert administrators of critical events and failures:

### Configuration
- The Discord webhook URL is hardcoded in the system (for now)
- Notifications are sent for critical failures including:
  - Scheduler errors
  - Worker errors
  - Database connection issues
  - Sync failures
  - Queue job failures

### API Endpoints
- `POST /api/discord/send` - Send a custom notification to Discord
- `POST /api/discord/test` - Test the Discord notification system

### Notification Types
- Sync failures with error details
- Critical system errors
- Token expiry alerts
- Rate limit warnings

---

**Last Updated**: December 26, 2025

**Author**: Development Team

**Maintenance Notes**:
- Check Google API quota limits monthly
- Update dependencies quarterly
- Review error logs weekly
