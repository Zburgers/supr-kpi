# 📊 Architecture & Flow Diagrams

## 1️⃣ System Architecture - Token Management

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER / FRONTEND                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ HTML: Meta Insights Section                         │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ • Title: "Meta Insights"                            │   │
│  │ • Input: #meta-token-input (password field)         │   │
│  │ • Button: #meta-sync-btn ("🚀 Fetch & Append")     │   │
│  │ • Status: #meta-status (result/error messages)      │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↕                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ JavaScript: Token Management (app.js)               │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ • appState.metaToken (memory storage)               │   │
│  │ • updateMetaToken() (capture & validate)            │   │
│  │ • runMetaSync() (send to API)                       │   │
│  │ • showMetaStatus() (display feedback)               │   │
│  │ • Event listeners (change, blur)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                    HTTP POST with                            │
│              { accessToken: "..." }                          │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXPRESS.JS API SERVER                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Endpoint: POST /api/meta/fetch (index.ts)           │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ 1. Extract token from request.body                  │   │
│  │ 2. Validate: token present? (400 if missing)        │   │
│  │ 3. Log: "Access token received"                     │   │
│  │ 4. Call: metaInsightsWorkflow.runWorkflow(token)   │   │
│  │ 5. Return: { success, data, message }              │   │
│  │ 6. Error handling: 500 with error message           │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                   Pass token to workflow                     │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              TYPESCRIPT SERVICE LAYER                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ MetaInsightsWorkflow.runWorkflow(accessToken)       │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │ STEP 1: fetchFromMetaApi(accessToken)              │   │
│  │ ├─ Append token to Meta API endpoint               │   │
│  │ ├─ Fetch: https://graph.facebook.com/v24.0/...    │   │
│  │ ├─ Parse JSON response                            │   │
│  │ └─ Return: MetaApiResponse                         │   │
│  │      │                                              │   │
│  │ STEP 2: parseMetrics(apiResponse)                  │   │
│  │ ├─ Extract fields from complex JSON               │   │
│  │ ├─ Normalize: landing_page_views, revenue, etc.   │   │
│  │ └─ Return: MetaInsightRow                          │   │
│  │      │                                              │   │
│  │ STEP 3: toSheetRow(metrics)                        │   │
│  │ ├─ Format to 10-column array                       │   │
│  │ └─ Return: [date, spend, reach, impressions, ...]  │   │
│  │      │                                              │   │
│  │ STEP 4: appendToSheet(metrics)                     │   │
│  │ ├─ Call: sheetsService.appendRow(...)             │   │
│  │ ├─ Target: meta_raw_daily spreadsheet             │   │
│  │ └─ Return: success boolean                         │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│              Return metrics to backend                       │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            GOOGLE SHEETS & EXTERNAL APIs                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐ │
│  │ Meta Graph API           │  │ Google Sheets API        │ │
│  ├──────────────────────────┤  ├──────────────────────────┤ │
│  │ GET /act_XXX/insights    │  │ sheets.spreadsheets      │ │
│  │ Params: date_preset,     │  │ .values.append()         │ │
│  │         action_breakdowns │  │ Appends row to sheet     │ │
│  │ Returns: JSON with data  │  │ Returns: success/error   │ │
│  │ Uses: accessToken        │  │ Uses: Service account    │ │
│  └──────────────────────────┘  └──────────────────────────┘ │
│                │                         │                   │
│                │         Data row        │                   │
│                └────────────────────────►│                   │
│                                          │                   │
│                              meta_raw_daily sheet updated ✓  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2️⃣ Data Flow - Complete Journey

```
USER INPUT LAYER
═══════════════════════════════════════════════════════════════

  1. User opens browser → http://localhost:3000
     ↓
  2. Sees "Meta Insights" section with empty token field
     ↓
  3. Gets token from Meta Dashboard
     ↓
  4. Pastes token into #meta-token-input field
     ↓

FRONTEND VALIDATION LAYER
═══════════════════════════════════════════════════════════════

  5. blur event triggered on token input
     ↓
  6. updateMetaToken() executes
     ├─ const token = input.value.trim()
     ├─ if (!token) show error → STOP
     ├─ appState.metaToken = token ✓
     └─ showMetaStatus("✓ Access token stored")
     ↓

FRONTEND SENDING LAYER
═══════════════════════════════════════════════════════════════

  7. User clicks "🚀 Fetch & Append" button
     ↓
  8. runMetaSync() executes
     ├─ if (!appState.metaToken) show error → STOP
     ├─ showMetaStatus("Fetching Meta insights...")
     ├─ POST /api/meta/fetch
     │  Body: { accessToken: appState.metaToken }
     └─ await response
     ↓

BACKEND VALIDATION LAYER
═══════════════════════════════════════════════════════════════

  9. Express receives: POST /api/meta/fetch
     ↓
  10. Extract token: const { accessToken } = req.body
     ↓
  11. Validate token
      ├─ if (!accessToken)
      │  └─ return 400 { error: "Access token required" }
      └─ if (accessToken) ✓
         └─ log: "✓ Access token received"
     ↓

SERVICE LAYER - STEP 1
═══════════════════════════════════════════════════════════════

  12. metaInsightsWorkflow.runWorkflow(accessToken)
     ├─ if (!accessToken) throw error → STOP
     └─ Proceed...
     ↓
  13. fetchFromMetaApi(accessToken)
     ├─ const fullUrl = META_ENDPOINT + accessToken
     ├─ fetch(fullUrl) → Meta Graph API
     ├─ Parse response JSON
     └─ Return: MetaApiResponse
        { data: [{
          date_start: "2025-12-14",
          spend: "13899.48",
          actions: [{action_type: "landing_page_view", value: "123"}],
          action_values: [{action_type: "purchase", value: "4500.00"}],
          ...
        }]}
     ↓

SERVICE LAYER - STEP 2
═══════════════════════════════════════════════════════════════

  14. parseMetrics(apiResponse)
     ├─ Extract date from date_start
     ├─ Parse spend, reach, impressions, clicks (strings → numbers)
     ├─ Extract actions:
     │  ├─ landing_page_views: pick first match from actions array
     │  ├─ add_to_cart: pick first match from actions array
     │  ├─ initiate_checkout: pick first match from actions array
     │  └─ purchases: pick first match from actions array
     ├─ Extract revenue: sum action_values for purchases
     └─ Return: MetaInsightRow
        {
          date: "2025-12-14",
          spend: 13899.48,
          reach: 20926,
          impressions: 32479,
          clicks: 1293,
          landing_page_views: 123,
          add_to_cart: 45,
          initiate_checkout: 12,
          purchases: 8,
          revenue: 4500.00
        }
     ↓

SERVICE LAYER - STEP 3
═══════════════════════════════════════════════════════════════

  15. toSheetRow(metrics)
     ├─ Format to array: [date, spend, reach, impressions, clicks, 
     │                    landing_page_views, add_to_cart, 
     │                    initiate_checkout, purchases, revenue]
     ├─ Result: ["2025-12-14", 13899.48, 20926, 32479, 1293,
     │           123, 45, 12, 8, 4500.00]
     └─ Return: SheetRow
     ↓

SERVICE LAYER - STEP 4
═══════════════════════════════════════════════════════════════

  16. appendToSheet(metrics)
     ├─ Call: sheetsService.appendRow({
     │   spreadsheetId: META_SPREADSHEET_ID,
     │   sheetName: META_SHEET_NAME,
     │   values: SheetRow
     │ })
     ├─ Google Sheets API appends row
     ├─ meta_raw_daily sheet updated ✓
     └─ Return: success boolean
     ↓

RESPONSE FLOW
═══════════════════════════════════════════════════════════════

  17. Backend receives success from service
     ├─ res.json({
     │   success: true,
     │   data: { metrics, spreadsheetId, sheetName },
     │   message: "Meta insights for 2025-12-14 appended..."
     │ })
     └─ return response
     ↓

FRONTEND DISPLAY
═══════════════════════════════════════════════════════════════

  18. Frontend receives response
     ├─ if (response.success)
     │  └─ showMetaStatus("✅ Appended Meta data for 2025-12-14 
     │                     to meta_raw_daily", "success")
     └─ console.log("Metrics:", metrics)
     ↓
  19. User sees success message ✓
     ↓
  20. New data row visible in meta_raw_daily sheet ✓

END OF FLOW
═══════════════════════════════════════════════════════════════
```

---

## 3️⃣ Component Interaction Diagram

```
┌─────────────────────┐
│    USER/BROWSER     │
└──────────┬──────────┘
           │
           │ Paste token + Click button
           ▼
┌─────────────────────────────────────┐
│  Frontend (public/app.js)           │
├─────────────────────────────────────┤
│ updateMetaToken()                   │
│  ├─ input.value → appState.metaToken
│  └─ Validate & show status          │
│                                     │
│ runMetaSync()                       │
│  ├─ Check appState.metaToken        │
│  ├─ POST /api/meta/fetch            │
│  │  { accessToken: metaToken }     │
│  └─ Handle response                 │
└─────────────┬───────────────────────┘
              │
              │ HTTP POST with token
              ▼
┌─────────────────────────────────────┐
│  Backend (src/server/index.ts)      │
├─────────────────────────────────────┤
│ POST /api/meta/fetch handler        │
│  ├─ req.body.accessToken extraction │
│  ├─ Validate token present          │
│  ├─ metaInsightsWorkflow.runWorkflow│
│  │  (accessToken)                   │
│  └─ res.json(result)                │
└─────────────┬───────────────────────┘
              │
              │ Pass token to workflow
              ▼
┌──────────────────────────────────────┐
│  Service (src/services/meta.service.ts)      │
├──────────────────────────────────────┤
│ runWorkflow(accessToken)             │
│  ├─ fetchFromMetaApi(token)          │
│  │  └─ fetch() with dynamic token    │
│  ├─ parseMetrics()                   │
│  │  └─ Extract fields from JSON      │
│  ├─ toSheetRow()                     │
│  │  └─ Format to array               │
│  ├─ appendToSheet()                  │
│  │  └─ Write to Google Sheets        │
│  └─ return metrics                   │
└──────────────┬───────────────────────┘
               │
               │ Return metrics
               ▼
        Google Sheets API
        & Meta API
               │
               │ Responses
               ▼
┌──────────────────────────────────────┐
│  Response Flow (reverse)             │
├──────────────────────────────────────┤
│ Service → Backend → Frontend         │
│   metrics    response    status msg  │
│             + new data visible ✓     │
└──────────────────────────────────────┘
```

---

## 4️⃣ Token Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│ TOKEN LIFECYCLE - FROM INPUT TO USAGE                        │
└──────────────────────────────────────────────────────────────┘

STAGE 1: GENERATION (External)
═══════════════════════════════════════════════════════════════
  Meta Developer Dashboard
        ↓
  User selects app
        ↓
  Tools → Access Token Tool
        ↓
  Token generated: eyJhbGciOiJIUzI1NiIsInR...
        ↓
  User copies to clipboard


STAGE 2: INPUT (Frontend)
═══════════════════════════════════════════════════════════════
  User opens http://localhost:3000
        ↓
  Sees "Meta Insights" section
        ↓
  Pastes token: ••••••••••••••••••••••••••
  (displayed as password field)
        ↓
  Browser memory (NOT localStorage)


STAGE 3: STORAGE (Frontend Memory)
═══════════════════════════════════════════════════════════════
  updateMetaToken() called
        ↓
  appState.metaToken = "eyJhbGciOiJIUzI1NiIsIn..."
        ↓
  Status: "✓ Access token stored"
        ↓
  Available in JavaScript memory only
  (cleared on page reload or close)


STAGE 4: TRANSMISSION (Network)
═══════════════════════════════════════════════════════════════
  runMetaSync() called
        ↓
  POST /api/meta/fetch
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn..."
  }
        ↓
  HTTPS (encrypted in production)
        ↓
  Server receives


STAGE 5: BACKEND VALIDATION (Server)
═══════════════════════════════════════════════════════════════
  Express endpoint checks
        ├─ if (!accessToken) → 400 error
        └─ if (accessToken) → Pass to workflow
        ↓
  Token never stored on server
  (only in request/response cycle)


STAGE 6: SERVICE USAGE (Workflow)
═══════════════════════════════════════════════════════════════
  metaInsightsWorkflow.runWorkflow(token)
        ↓
  Append to Meta API URL:
  https://graph.facebook.com/v24.0/...
  &access_token=eyJhbGciOiJIUzI1NiIsIn...
        ↓
  Meta validates token
        ├─ Valid → Return data
        └─ Invalid → Return 401
        ↓
  Workflow continues with data


STAGE 7: COMPLETION (Frontend Response)
═══════════════════════════════════════════════════════════════
  Backend returns response
  {
    "success": true,
    "data": { metrics },
    "message": "✅ Appended Meta data..."
  }
        ↓
  Frontend displays success message
        ↓
  New data visible in Google Sheet ✓
        ↓
  appState.metaToken still in memory


STAGE 8: SESSION END
═══════════════════════════════════════════════════════════════
  User closes browser tab
        OR
  User refreshes page (F5)
        ↓
  appState.metaToken = null (cleared)
        ↓
  Token input field empty
        ↓
  Must re-enter token for next session


TOKEN SECURITY SUMMARY
═══════════════════════════════════════════════════════════════
✓ Stored:      Browser memory only (volatile)
✓ Persisted:   NO (not in localStorage/cookies)
✓ Encrypted:   YES (in HTTPS transit)
✓ Logged:      Only in production console (safe)
✓ Validated:   At each layer (frontend/backend/service)
✓ Duration:    Session-scoped (cleared on reload)
✓ Rotation:    User manually manages (paste new token)
```

---

## 5️⃣ Error Handling Flow

```
USER ACTION: Click "Fetch & Append"
│
├─ TOKEN CHECK (Frontend)
│  ├─ Token exists? NO
│  │  └─ Error: "Please enter your Meta access token first"
│  │     └─ STOP - No API call made
│  │
│  └─ Token exists? YES
│     └─ Continue...
│
├─ API CALL (Frontend)
│  ├─ POST /api/meta/fetch
│  ├─ Timeout/Network error
│  │  └─ Error: "Failed to reach server"
│  │     └─ STOP
│  │
│  └─ Response received
│     └─ Continue...
│
├─ TOKEN VALIDATION (Backend)
│  ├─ Token in request body? NO
│  │  └─ Error: "Access token is required"
│  │     Status: 400 Bad Request
│  │     └─ Frontend shows error & STOP
│  │
│  └─ Token in request body? YES
│     └─ Continue to workflow
│
├─ WORKFLOW EXECUTION (Service)
│  ├─ Token parameter check
│  │  ├─ Token empty? YES
│  │  │  └─ Error: "Access token is required"
│  │  │     └─ Throw error → Backend catches
│  │  │
│  │  └─ Token not empty? YES
│  │     └─ Continue to fetch...
│  │
│  ├─ Meta API Call
│  │  ├─ Network error? YES
│  │  │  └─ Error: "Failed to reach Meta API"
│  │  │     └─ Throw error
│  │  │
│  │  ├─ Status 401? (Invalid token)
│  │  │  └─ Error: "Meta API error: HTTP 401"
│  │  │     └─ Throw error → Show to user
│  │  │
│  │  ├─ Status 403? (Insufficient permissions)
│  │  │  └─ Error: "Meta API error: HTTP 403"
│  │  │     └─ Throw error
│  │  │
│  │  ├─ Status 400? (Bad request)
│  │  │  └─ Error: "Meta API error: HTTP 400"
│  │  │     └─ Throw error + Details
│  │  │
│  │  ├─ Status 200? (Success)
│  │  │  ├─ JSON parse? NO
│  │  │  │  └─ Error: "Failed to parse response"
│  │  │  │     └─ Throw error
│  │  │  │
│  │  │  └─ JSON parse? YES
│  │  │     └─ Continue...
│  │  │
│  │  └─ Data validation
│  │     ├─ data array empty? YES
│  │     │  └─ Error: "No data received from Meta API"
│  │     │     └─ Throw error
│  │     │
│  │     └─ data array has items? YES
│  │        └─ Continue to parsing
│  │
│  ├─ Data Parsing
│  │  ├─ Required fields missing? YES
│  │  │  └─ Error: "Invalid response structure"
│  │  │     └─ Throw error
│  │  │
│  │  └─ Required fields present? YES
│  │     └─ Continue to formatting
│  │
│  ├─ Sheet Append
│  │  ├─ Google Sheets error? YES
│  │  │  └─ Error: "Failed to append to sheet"
│  │  │     └─ Throw error + Details
│  │  │
│  │  └─ Google Sheets success? YES
│  │     └─ Continue...
│  │
│  └─ Return success
│
├─ ERROR CAUGHT (Backend)
│  ├─ Error? YES
│  │  └─ res.status(500)
│  │     .json({ success: false, error: message })
│  │
│  └─ Error? NO
│     └─ res.json({ success: true, data: ... })
│
└─ FRONTEND DISPLAY
   ├─ Success? YES
   │  └─ Status: "✅ Appended Meta data for ... to meta_raw_daily"
   │     Console: Metrics details
   │     Sheet: New row visible ✓
   │
   └─ Error? YES
      └─ Status: "❌ Error message"
         Console: Full error stack
         Sheet: No changes
```

---

These diagrams show the complete architecture, data flow, component interactions, token lifecycle, and error handling for the Meta token management feature.

