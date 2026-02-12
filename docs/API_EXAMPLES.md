# API Usage Examples

Complete examples for using the Google Sheets KPI Manager API.

## Table of Contents

- [Authentication](#authentication)
- [Working with Spreadsheets](#working-with-spreadsheets)
- [Working with Sheets](#working-with-sheets)
- [Reading Data](#reading-data)
- [Writing Data](#writing-data)
- [JavaScript Examples](#javascript-examples)

---

## Authentication

The API uses service account authentication. No API key in URL needed.

**Server requires**: `n8nworkflows-471200-2d198eaf6e2a.json` in project root

---

## Working with Spreadsheets (New Credential-Based Approach - Recommended)

### List All Accessible Spreadsheets with Stored Credentials

Get all spreadsheets accessible by stored credentials.

**Request**:
```bash
# Using a stored credential ID
CREDENTIAL_ID="123"

curl -X GET "http://localhost:3000/api/sheets/spreadsheets?credential_id=${CREDENTIAL_ID}"
```

### Working with Spreadsheets (Legacy - Deprecated)

The old approach without credential ID is deprecated:

**Request**:
```bash
curl -X GET http://localhost:3000/api/spreadsheets
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9",
      "name": "KPI Dashboard 2025",
      "sheetId": 0
    },
    {
      "id": "2aB3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9s0T",
      "name": "Marketing Analytics",
      "sheetId": 0
    }
  ]
}
```

**Usage in Frontend**:
```javascript
// Automatically populated in spreadsheet dropdown
// See public/app.js > loadSpreadsheets()
```

---

## Working with Sheets (New Credential-Based Approach - Recommended)

### Get Sheet Names from Spreadsheet with Stored Credentials

List all sheets within a spreadsheet using stored credentials.

**Request**:
```bash
SHEET_ID="1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9"
CREDENTIAL_ID="123"

curl -X GET "http://localhost:3000/api/sheets/${SHEET_ID}/sheets?credential_id=${CREDENTIAL_ID}"
```

### Working with Sheets (Legacy - Deprecated)

The old approach without credential ID is deprecated:

**Request**:
```bash
SHEET_ID="1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9"

curl -X GET "http://localhost:3000/api/sheets/${SHEET_ID}"
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9",
      "name": "meta_raw_daily",
      "sheetId": 0
    },
    {
      "id": "1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9",
      "name": "Calculations",
      "sheetId": 123456789
    },
    {
      "id": "1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9",
      "name": "Raw Exports",
      "sheetId": 987654321
    }
  ]
}
```

**Usage in Frontend**:
```javascript
// Automatically loaded when spreadsheet is selected
// See public/app.js > loadSheetNames()
```

---

## Reading Data (New Credential-Based Approach - Recommended)

### Read Raw Data from a Sheet with Stored Credentials

Fetch raw values from a specific sheet using stored credentials.

**Request**:
```bash
SHEET_ID="1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9"
SHEET_NAME="meta_raw_daily"
CREDENTIAL_ID="123"

curl -X GET \
  "http://localhost:3000/api/sheets/${SHEET_ID}/values?credential_id=${CREDENTIAL_ID}&sheetName=${SHEET_NAME}"
```

### Reading Data (Legacy - Deprecated)

The old approach without credential ID is deprecated:

**Request**:
```bash
SHEET_ID="1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9"
SHEET_NAME="meta_raw_daily"

curl -X GET \
  "http://localhost:3000/api/data/${SHEET_ID}/${SHEET_NAME}"
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-12-01",
      "spend": 150.50,
      "reach": 5000,
      "impressions": 12500,
      "clicks": 450,
      "landing_page_views": 380,
      "add_to_cart": 25,
      "initiate_checkout": 12,
      "purchases": 3,
      "revenue": 450
    },
    {
      "date": "2025-12-02",
      "spend": 165.75,
      "reach": 5200,
      "impressions": 13000,
      "clicks": 480,
      "landing_page_views": 400,
      "add_to_cart": 28,
      "initiate_checkout": 14,
      "purchases": 4,
      "revenue": 520
    }
  ]
}
```

**Important Notes**:
- First row of sheet must contain headers
- All data returned as objects with header keys
- Empty cells become `null`
- Reads up to column Z and row 1000

**Usage in Frontend**:
```javascript
// Click "Load Data" button in sidebar
// See public/app.js > loadData()
```

---

## Writing Data

### Write/Overwrite All Data in Sheet

Replace all data in a sheet (including headers).

**Request**:
```bash
SHEET_ID="1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9"
SHEET_NAME="meta_raw_daily"

curl -X POST \
  "http://localhost:3000/api/data/${SHEET_ID}/${SHEET_NAME}" \
  -H "Content-Type: application/json" \
  -d '{
    "values": [
      ["date", "spend", "reach", "impressions", "clicks", "landing_page_views", "add_to_cart", "initiate_checkout", "purchases", "revenue"],
      ["2025-12-01", 150.50, 5000, 12500, 450, 380, 25, 12, 3, 450],
      ["2025-12-02", 165.75, 5200, 13000, 480, 400, 28, 14, 4, 520],
      ["2025-12-03", 155.25, 4900, 12000, 420, 360, 22, 11, 2, 380]
    ]
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Data written successfully"
}
```

**⚠️ WARNING**: This overwrites entire sheet content!

**Usage in Frontend**:
```javascript
// Click "Save All Changes" button
// Confirmation dialog appears first
// See public/app.js > saveToSheet()
```

### Append a Single Row

Add one row to the end of the sheet.

**Request**:
```bash
SHEET_ID="1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9"
SHEET_NAME="meta_raw_daily"

curl -X POST \
  "http://localhost:3000/api/append/${SHEET_ID}/${SHEET_NAME}" \
  -H "Content-Type: application/json" \
  -d '{
    "row": [
      "2025-12-04",
      172.00,
      5400,
      13500,
      510,
      420,
      32,
      16,
      5,
      600
    ]
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Row appended successfully"
}
```

**Best For**: Adding daily metrics without affecting existing data.

### Update a Specific Range

Update cells in a defined range.

**Request**:
```bash
SHEET_ID="1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9"

curl -X PUT \
  "http://localhost:3000/api/range/${SHEET_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "range": "meta_raw_daily!B2:B5",
    "values": [
      [160.00],
      [170.00],
      [165.00]
    ]
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Range updated successfully"
}
```

**Range Format**: `SheetName!A1:Z1000`

---

## JavaScript Examples

### Example 1: Load Data and Log to Console

```javascript
async function loadMyData() {
  const sheetId = "1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9";
  const sheetName = "meta_raw_daily";
  
  try {
    const response = await fetch(
      `/api/data/${sheetId}/${encodeURIComponent(sheetName)}`
    );
    const result = await response.json();
    
    if (result.success) {
      console.log(`Loaded ${result.data.length} rows`);
      console.table(result.data);
    } else {
      console.error("Error:", result.error);
    }
  } catch (error) {
    console.error("Failed to fetch:", error);
  }
}

loadMyData();
```

### Example 2: Calculate and Append Daily Metrics

```javascript
async function appendDailyMetrics() {
  const sheetId = "1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9";
  const sheetName = "meta_raw_daily";
  
  // Calculate metrics (from external source)
  const metrics = {
    date: "2025-12-04",
    spend: 172.00,
    reach: 5400,
    impressions: 13500,
    clicks: 510,
    landing_page_views: 420,
    add_to_cart: 32,
    initiate_checkout: 16,
    purchases: 5,
    revenue: 600
  };
  
  try {
    const response = await fetch(
      `/api/append/${sheetId}/${encodeURIComponent(sheetName)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          row: [
            metrics.date,
            metrics.spend,
            metrics.reach,
            metrics.impressions,
            metrics.clicks,
            metrics.landing_page_views,
            metrics.add_to_cart,
            metrics.initiate_checkout,
            metrics.purchases,
            metrics.revenue
          ]
        })
      }
    );
    
    const result = await response.json();
    if (result.success) {
      console.log("✓ Metrics appended successfully");
    }
  } catch (error) {
    console.error("Failed to append:", error);
  }
}

appendDailyMetrics();
```

### Example 3: Update Specific Cells

```javascript
async function updateRevenue() {
  const sheetId = "1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9";
  
  try {
    const response = await fetch(
      `/api/range/${sheetId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          range: "meta_raw_daily!J2:J5", // Revenue column
          values: [
            [450],
            [520],
            [380],
            [600]
          ]
        })
      }
    );
    
    const result = await response.json();
    console.log(result.message);
  } catch (error) {
    console.error("Failed to update:", error);
  }
}

updateRevenue();
```

### Example 4: Batch Update Multiple Cells (Full Rewrite)

```javascript
async function updateFullSheet(newData) {
  const sheetId = "1mH8x-FjYJ2k3L5m6N8p9Q0r1S2t3U4v5W6x7Y8z9";
  const sheetName = "meta_raw_daily";
  
  // Prepare headers
  const headers = [
    "date",
    "spend",
    "reach",
    "impressions",
    "clicks",
    "landing_page_views",
    "add_to_cart",
    "initiate_checkout",
    "purchases",
    "revenue"
  ];
  
  // Prepare values (convert data objects to arrays)
  const values = [
    headers,
    ...newData.map(row => headers.map(h => row[h] || ""))
  ];
  
  try {
    const response = await fetch(
      `/api/data/${sheetId}/${encodeURIComponent(sheetName)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values })
      }
    );
    
    const result = await response.json();
    if (result.success) {
      console.log("✓ Sheet updated successfully");
    }
  } catch (error) {
    console.error("Failed to update:", error);
  }
}

// Usage
const newData = [
  {
    date: "2025-12-01",
    spend: 150.50,
    reach: 5000,
    impressions: 12500,
    clicks: 450,
    landing_page_views: 380,
    add_to_cart: 25,
    initiate_checkout: 12,
    purchases: 3,
    revenue: 450
  },
  // ... more rows
];

updateFullSheet(newData);
```

---

## Data Format Reference

### Expected Headers (meta_raw_daily)

| Column | Type | Format | Example |
|--------|------|--------|---------|
| date | string | YYYY-MM-DD | 2025-12-01 |
| spend | number | decimal | 150.50 |
| reach | number | integer | 5000 |
| impressions | number | integer | 12500 |
| clicks | number | integer | 450 |
| landing_page_views | number | integer | 380 |
| add_to_cart | number | integer | 25 |
| initiate_checkout | number | integer | 12 |
| purchases | number | integer | 3 |
| revenue | number | decimal | 450.00 |

### Common Error Responses

**Service not initialized**:
```json
{
  "success": false,
  "error": "Sheets not initialized"
}
```

**Invalid sheet name**:
```json
{
  "success": false,
  "error": "Error reading sheet: 404 Not Found"
}
```

**Invalid data format**:
```json
{
  "success": false,
  "error": "Values must be an array"
}
```

---

## Performance Tips

1. **Batch Operations**: Use `/data` POST instead of multiple `/append` calls
2. **Limit Row Count**: Query only needed date ranges
3. **Caching**: Cache data client-side when possible
4. **Rate Limiting**: Respect Google's API quotas (500 requests/100 seconds)

---

## See Also

- [README.md](./README.md) - Main documentation
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development guide
- [`src/server/index.ts`](./src/server/index.ts) - API implementation
- [`public/app.js`](./public/app.js) - Frontend usage examples
