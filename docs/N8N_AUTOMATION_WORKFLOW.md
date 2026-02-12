# N8N Automation Workflow Documentation
## SUPR KPI Daily Data Collection & Google Sheets Update

**Target Audience:** N8N Automation Expert  
**Created:** 19 December 2025  
**Purpose:** Complete node-by-node workflow from API request to Google Sheets append  

---

## Overview

Three independent daily workflows fetch "yesterday's" metrics from different platforms and append them to a shared Google Spreadsheet. Each workflow follows the same pattern: **FETCH → PARSE → NORMALIZE → APPEND**.

**Shared Google Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`

---

# WORKFLOW 1: GOOGLE ANALYTICS 4 (GA4)

## Node 1: Trigger (Schedule)
- **Type:** Cron Trigger  
- **Schedule:** Daily at 2:00 AM IST (fetches "yesterday" data)
- **Trigger ID:** `ga4-daily-fetch`

**Output:**
```json
{
  "timestamp": "2025-12-19T02:00:00+05:30",
  "platform": "ga4"
}
```

---

## Node 2: HTTP Request - Fetch GA4 Report

**Request Details:**

```bash
curl -X POST \
  "https://analyticsdata.googleapis.com/v1beta/properties/{PROPERTY_ID}:runReport" \
  -H "Authorization: Bearer {GA4_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "dateRanges": [
      {
        "startDate": "yesterday",
        "endDate": "yesterday"
      }
    ],
    "dimensions": [
      {
        "name": "date"
      }
    ],
    "metrics": [
      { "name": "sessions" },
      { "name": "totalUsers" },
      { "name": "addToCarts" },
      { "name": "ecommercePurchases" },
      { "name": "totalRevenue" },
      { "name": "bounceRate" }
    ],
    "keepEmptyRows": true
  }'
```

**Node Config:**
- **Type:** HTTP Request (POST)
- **URL:** `https://analyticsdata.googleapis.com/v1beta/properties/{{ $env.GA4_PROPERTY_ID }}:runReport`
- **Headers:**
  - `Authorization: Bearer {{ $env.GA4_ACCESS_TOKEN }}`
  - `Content-Type: application/json`
- **Body:** Raw JSON (see above)
- **Timeout:** 30s
- **Error Handling:** Retry 2x on network error

**Expected Response:**
```json
{
  "rows": [
    {
      "dimensionValues": [
        {
          "value": "20251218"
        }
      ],
      "metricValues": [
        { "value": "15234" },      // sessions
        { "value": "12456" },      // totalUsers
        { "value": "892" },        // addToCarts
        { "value": "234" },        // ecommercePurchases
        { "value": "45678.92" },   // totalRevenue
        { "value": "23.5" }        // bounceRate
      ]
    }
  ]
}
```

---

## Node 3: Data Transformation - Parse GA4 Metrics

**Type:** Function/Script Node

**Input:** `{{ $node["HTTP Request - GA4"].json.rows }}`

**Transformation Logic:**

```javascript
// Extract first row from GA4 response
const firstRow = input[0];

// Parse dimensions
const rawDate = firstRow.dimensionValues[0].value; // "20251218"
const date = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`; // "2025-12-18"

// Extract metrics (GA4 returns in order)
const metrics = firstRow.metricValues;

return {
  date: date,
  sessions: parseInt(metrics[0].value),
  users: parseInt(metrics[1].value),
  add_to_cart: parseInt(metrics[2].value),
  purchases: parseInt(metrics[3].value),
  revenue: parseFloat(metrics[4].value),
  bounce_rate: parseFloat(metrics[5].value)
};
```

**Output:**
```json
{
  "date": "2025-12-18",
  "sessions": 15234,
  "users": 12456,
  "add_to_cart": 892,
  "purchases": 234,
  "revenue": 45678.92,
  "bounce_rate": 23.5
}
```

---

## Node 4: Check Row Existence in Sheet

**Type:** Google Sheets Node - Get Range

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `ga4_raw_daily`
- **Range:** `B2:B` (Date column, excluding header)
- **Operation:** Get values

**Purpose:** Check if today's date already exists to prevent duplicates

**Output:**
```json
{
  "values": [
    ["2025-12-17"],
    ["2025-12-16"],
    ["2025-12-15"]
  ]
}
```

---

## Node 5: Conditional Logic - Date Exists?

**Type:** IF Node

**Condition:** 
```
{{ $node["Check Row Existence"].json.values.flat().includes($node["Parse GA4"].json.date) }}
```

**Decision:**
- **TRUE:** Skip append (date already exists)
- **FALSE:** Continue to Node 6 (append new row)

---

## Node 6: Get Next ID

**Type:** Google Sheets Node - Get Range

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `ga4_raw_daily`
- **Range:** `A2:A` (ID column)
- **Operation:** Get values

**Output:**
```json
{
  "values": [
    ["0"],
    ["1"],
    ["2"]
  ]
}
```

---

## Node 7: Calculate Next ID & Format Row

**Type:** Function Node

**Logic:**
```javascript
const idColumn = $node["Get Next ID"].json.values.flat().map(v => parseInt(v) || 0);
const nextId = Math.max(...idColumn, -1) + 1;

return {
  id: nextId,
  row: [
    nextId,
    input.date,
    input.sessions,
    input.users,
    input.add_to_cart,
    input.purchases,
    input.revenue,
    input.bounce_rate
  ]
};
```

**Output:**
```json
{
  "id": 3,
  "row": [3, "2025-12-18", 15234, 12456, 892, 234, 45678.92, 23.5]
}
```

---

## Node 8: Append Row to Sheet

**Type:** Google Sheets Node - Append

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `ga4_raw_daily`
- **Values:** `{{ $node["Calculate Next ID"].json.row }}`

**Sheet Schema (ga4_raw_daily sheet):**

| Column | Header       | Type   | Example      |
|--------|-------------|--------|-------------|
| A      | id          | Number | 3           |
| B      | date        | Date   | 2025-12-18  |
| C      | sessions    | Number | 15234       |
| D      | users       | Number | 12456       |
| E      | add_to_cart | Number | 892         |
| F      | purchases   | Number | 234         |
| G      | revenue     | Number | 45678.92    |
| H      | bounce_rate | Number | 23.5        |

**Output:**
```json
{
  "updatedRange": "Google!A4:H4",
  "updatedRows": 1,
  "updatedColumns": 8,
  "updatedCells": 8
}
```

---

## Node 9: Notification (Success)

**Type:** Slack/Email/Webhook

**Message:**
```
✅ GA4 Daily Update - {{ $node["Calculate Next ID"].json.id }}
Date: {{ $node["Parse GA4"].json.date }}
Sessions: {{ $node["Parse GA4"].json.sessions }}
Revenue: ${{ $node["Parse GA4"].json.revenue }}
```

---

---

# WORKFLOW 2: META INSIGHTS

## Node 1: Trigger (Schedule)
- **Type:** Cron Trigger  
- **Schedule:** Daily at 2:05 AM IST (5 minutes after GA4)
- **Trigger ID:** `meta-daily-fetch`

---

## Node 2: HTTP Request - Fetch Meta Insights

**Request Details:**

```bash
curl -X GET \
  "https://graph.facebook.com/v24.0/act_1458189648725469/insights" \
  -G \
  --data-urlencode 'time_increment=1' \
  --data-urlencode 'date_preset=yesterday' \
  --data-urlencode 'action_breakdowns=action_type' \
  --data-urlencode 'fields=date_start,date_stop,spend,reach,impressions,clicks,actions,action_values' \
  --data-urlencode 'access_token={META_ACCESS_TOKEN}'
```

**Node Config:**
- **Type:** HTTP Request (GET)
- **URL:** `https://graph.facebook.com/v24.0/act_1458189648725469/insights`
- **Query Parameters:**
  - `time_increment`: `1`
  - `date_preset`: `yesterday`
  - `action_breakdowns`: `action_type`
  - `fields`: `date_start,date_stop,spend,reach,impressions,clicks,actions,action_values`
  - `access_token`: `{{ $env.META_ACCESS_TOKEN }}`

**Expected Response:**
```json
{
  "data": [
    {
      "date_start": "2025-12-18",
      "date_stop": "2025-12-18",
      "spend": "13899.48",
      "reach": "20926",
      "impressions": "32479",
      "clicks": "1293",
      "actions": [
        { "action_type": "landing_page_view", "value": "2145" },
        { "action_type": "add_to_cart", "value": "456" },
        { "action_type": "initiate_checkout", "value": "123" },
        { "action_type": "purchase", "value": "89" }
      ],
      "action_values": [
        { "action_type": "purchase", "value": "18765.50" }
      ]
    }
  ]
}
```

---

## Node 3: Data Transformation - Parse & Normalize Meta Metrics

**Type:** Function Node

**Transformation Logic:**

```javascript
const data = input.data[0];

// Helper: Convert string to number safely
const toNumber = (value) => {
  if (!value) return 0;
  const num = parseFloat(value);
  return isFinite(num) ? num : 0;
};

// Helper: Pick first matching action (deterministic, no summing)
const pickAction = (actionsArray, typesList) => {
  if (!actionsArray) return { value: 0, source: "NOT_FOUND" };
  for (const type of typesList) {
    const hit = actionsArray.find(a => a.action_type === type);
    if (hit) return { value: toNumber(hit.value), source: type };
  }
  return { value: 0, source: "NOT_FOUND" };
};

// Extract basic metrics
const basicMetrics = {
  date: data.date_start,
  spend: toNumber(data.spend),
  reach: toNumber(data.reach),
  impressions: toNumber(data.impressions),
  clicks: toNumber(data.clicks)
};

// DETERMINISTIC: Pick canonical source for each action (prevent double counting)
const lpv = pickAction(data.actions, ["landing_page_view", "omni_landing_page_view"]);
const atc = pickAction(data.actions, ["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart", "omni_add_to_cart"]);
const ic = pickAction(data.actions, ["initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "omni_initiated_checkout"]);
const purchase = pickAction(data.actions, ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase", "onsite_web_purchase", "onsite_web_app_purchase", "web_in_store_purchase"]);

// REVENUE: Pick ONE canonical purchase revenue source (NO SUMMING to avoid 6x double counting)
const revenueVariants = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "onsite_web_purchase",
  "onsite_web_app_purchase",
  "web_in_store_purchase"
];

let revenue = { value: 0, source: "NO_DATA" };
for (const variant of revenueVariants) {
  const match = data.action_values.find(av => av.action_type === variant);
  if (match && toNumber(match.value) > 0) {
    revenue = { value: toNumber(match.value), source: variant };
    break; // Stop at first match (canonical)
  }
}

return {
  date: basicMetrics.date,
  spend: basicMetrics.spend,
  reach: basicMetrics.reach,
  impressions: basicMetrics.impressions,
  clicks: basicMetrics.clicks,
  landing_page_views: lpv.value,
  add_to_cart: atc.value,
  initiate_checkout: ic.value,
  purchases: purchase.value,
  revenue: revenue.value,
  metricSources: {
    landing_page_views_source: lpv.source,
    add_to_cart_source: atc.source,
    initiate_checkout_source: ic.source,
    purchases_source: purchase.source,
    revenue_source: revenue.source
  }
};
```

**Output:**
```json
{
  "date": "2025-12-18",
  "spend": 13899.48,
  "reach": 20926,
  "impressions": 32479,
  "clicks": 1293,
  "landing_page_views": 2145,
  "add_to_cart": 456,
  "initiate_checkout": 123,
  "purchases": 89,
  "revenue": 18765.50,
  "metricSources": {
    "landing_page_views_source": "landing_page_view",
    "add_to_cart_source": "add_to_cart",
    "initiate_checkout_source": "initiate_checkout",
    "purchases_source": "purchase",
    "revenue_source": "purchase"
  }
}
```

---

## Node 4: Check Row Existence

**Type:** Google Sheets - Get Range

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `meta_raw_daily`
- **Range:** `B2:B` (Date column)

**Purpose:** Prevent duplicate dates

---

## Node 5: Conditional - Date Exists?

**Condition:** `{{ $node["Check Row Existence"].json.values.flat().includes($node["Parse Meta"].json.date) }}`

---

## Node 6: Get Next ID

**Type:** Google Sheets - Get Range

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `meta_raw_daily`
- **Range:** `A2:A` (ID column)

---

## Node 7: Format Row with Audit Trail

**Type:** Function Node

```javascript
const idColumn = $node["Get Next ID"].json.values.flat().map(v => parseInt(v) || 0);
const nextId = Math.max(...idColumn, -1) + 1;
const parsed = $node["Parse Meta"].json;

return {
  id: nextId,
  row: [
    nextId,
    parsed.date,
    parsed.spend,
    parsed.reach,
    parsed.impressions,
    parsed.clicks,
    parsed.landing_page_views,
    parsed.add_to_cart,
    parsed.initiate_checkout,
    parsed.purchases,
    parsed.revenue
  ],
  auditTrail: {
    timestamp: new Date().toISOString(),
    sources: parsed.metricSources
  }
};
```

**Output:**
```json
{
  "id": 45,
  "row": [45, "2025-12-18", 13899.48, 20926, 32479, 1293, 2145, 456, 123, 89, 18765.50],
  "auditTrail": {
    "timestamp": "2025-12-19T00:05:23Z",
    "sources": {
      "landing_page_views_source": "landing_page_view",
      "add_to_cart_source": "add_to_cart",
      "purchases_source": "purchase",
      "revenue_source": "purchase"
    }
  }
}
```

---

## Node 8: Append Row to Sheet

**Type:** Google Sheets - Append

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `meta_raw_daily`
- **Values:** `{{ $node["Format Row"].json.row }}`

**Sheet Schema (meta_raw_daily sheet):**

| Column | Header              | Type   | Example      | Source               |
|--------|-------------------|--------|-------------|----------------------|
| A      | id                | Number | 45          | Auto-increment       |
| B      | date              | Date   | 2025-12-18  | date_start           |
| C      | spend             | Number | 13899.48    | spend                |
| D      | reach             | Number | 20926       | reach                |
| E      | impressions       | Number | 32479       | impressions          |
| F      | clicks            | Number | 1293        | clicks               |
| G      | landing_page_views| Number | 2145        | actions[landing_page_view] |
| H      | add_to_cart       | Number | 456         | actions[add_to_cart] |
| I      | initiate_checkout | Number | 123         | actions[initiate_checkout] |
| J      | purchases         | Number | 89          | actions[purchase]    |
| K      | revenue           | Number | 18765.50    | action_values[purchase] |

**⚠️ CRITICAL:** Revenue is picked from ONE canonical source only (not summed) to prevent 6x double-counting.

---

## Node 9: Log Audit Trail (Optional)

**Type:** Function Node - Store audit trail in logging service

```javascript
return {
  workflow: "meta-daily",
  date: $node["Parse Meta"].json.date,
  rowId: $node["Format Row"].json.id,
  metricSources: $node["Format Row"].json.auditTrail.sources,
  timestamp: new Date().toISOString()
};
```

---

---

# WORKFLOW 3: SHOPIFY

## Node 1: Trigger (Schedule)
- **Type:** Cron Trigger  
- **Schedule:** Daily at 2:10 AM IST (10 minutes after Meta)
- **Trigger ID:** `shopify-daily-fetch`

---

## Node 2: HTTP Request - Fetch Shopify Data via GraphQL

**Request Details:**

```bash
curl -X POST \
  "https://{STORE_DOMAIN}/admin/api/2025-10/graphql.json" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Access-Token: {SHOPIFY_ACCESS_TOKEN}" \
  -d '{
    "query": "query { shopifyqlQuery(query: \"FROM sales, customers SHOW day AS date, orders AS total_orders, total_sales AS total_revenue, net_sales AS net_revenue, returns AS returns_amount, new_customers, returning_customers AS repeat_customers DURING yesterday TIMESERIES day\") { tableData { columns { name dataType displayName } rows } parseErrors } }"
  }'
```

**Node Config:**
- **Type:** HTTP Request (POST)
- **URL:** `https://{{ $env.SHOPIFY_STORE_DOMAIN }}/admin/api/2025-10/graphql.json`
- **Headers:**
  - `X-Shopify-Access-Token: {{ $env.SHOPIFY_ACCESS_TOKEN }}`
  - `Content-Type: application/json`
- **Body:** Raw JSON (GraphQL query as shown above)

**Expected Response:**
```json
{
  "data": {
    "shopifyqlQuery": {
      "tableData": {
        "columns": [
          { "name": "date", "dataType": "STRING" },
          { "name": "total_orders", "dataType": "INT" },
          { "name": "total_revenue", "dataType": "DECIMAL" },
          { "name": "net_revenue", "dataType": "DECIMAL" },
          { "name": "returns_amount", "dataType": "DECIMAL" },
          { "name": "new_customers", "dataType": "INT" },
          { "name": "repeat_customers", "dataType": "INT" }
        ],
        "rows": [
          {
            "date": "2025-12-18",
            "total_orders": "342",
            "total_revenue": "52847.65",
            "net_revenue": "48923.45",
            "returns_amount": "-1234.50",
            "new_customers": "87",
            "repeat_customers": "255"
          }
        ]
      },
      "parseErrors": []
    }
  }
}
```

---

## Node 3: Data Transformation - Parse Shopify Metrics

**Type:** Function Node

**Transformation Logic:**

```javascript
const shopifyql = input.data.shopifyqlQuery;

// Validate response
if (!shopifyql || !shopifyql.tableData || !shopifyql.tableData.rows || shopifyql.tableData.rows.length === 0) {
  throw new Error("ShopifyQL returned no data for yesterday");
}

if (shopifyql.parseErrors && shopifyql.parseErrors.length > 0) {
  const errorMsg = shopifyql.parseErrors.map(e => e.message).join("; ");
  throw new Error(`ShopifyQL parse errors: ${errorMsg}`);
}

const firstRow = shopifyql.tableData.rows[0];

// Helper: Convert string to number, handle absolute value for returns
const toNumber = (value) => {
  if (!value) return 0;
  const num = parseFloat(value);
  return isFinite(num) ? num : 0;
};

return {
  date: firstRow.date || "",
  total_orders: toNumber(firstRow.total_orders),
  total_revenue: toNumber(firstRow.total_revenue),
  net_revenue: toNumber(firstRow.net_revenue),
  total_returns: Math.abs(toNumber(firstRow.returns_amount)),
  new_customers: toNumber(firstRow.new_customers),
  repeat_customers: toNumber(firstRow.repeat_customers)
};
```

**Output:**
```json
{
  "date": "2025-12-18",
  "total_orders": 342,
  "total_revenue": 52847.65,
  "net_revenue": 48923.45,
  "total_returns": 1234.50,
  "new_customers": 87,
  "repeat_customers": 255
}
```

---

## Node 4: Check Row Existence

**Type:** Google Sheets - Get Range

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `shopify_raw_daily`
- **Range:** `B2:B` (Date column)

---

## Node 5: Conditional - Update or Append?

**Type:** IF Node

**Condition:** `{{ $node["Check Row Existence"].json.values.flat().includes($node["Parse Shopify"].json.date) }}`

**Decision:**
- **TRUE:** Update existing row (row already exists for this date)
- **FALSE:** Append new row

---

### Path A: Row Exists - Update Existing Row

## Node 6A: Find Row Number

**Type:** Function Node

```javascript
const dates = $node["Check Row Existence"].json.values.flat();
const targetDate = $node["Parse Shopify"].json.date;
const rowIndex = dates.findIndex(d => d === targetDate);
return {
  rowNumber: rowIndex + 2  // +2 for header offset and 0-based indexing
};
```

---

## Node 7A: Get Existing ID

**Type:** Google Sheets - Get Range

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `Shopify`
- **Range:** `A{{ $node["Find Row Number"].json.rowNumber }}` (Get ID from existing row)

---

## Node 8A: Update Row

**Type:** Google Sheets - Update

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `shopify_raw_daily`
- **Range:** `A{{ $node["Find Row Number"].json.rowNumber }}:H{{ $node["Find Row Number"].json.rowNumber }}`
- **Values:** `{{ [[$node["Get Existing ID"].json.value[0][0], $node["Parse Shopify"].json.date, $node["Parse Shopify"].json.total_orders, $node["Parse Shopify"].json.total_revenue, $node["Parse Shopify"].json.net_revenue, $node["Parse Shopify"].json.total_returns, $node["Parse Shopify"].json.new_customers, $node["Parse Shopify"].json.repeat_customers]] }}`

---

### Path B: Row Doesn't Exist - Append New Row

## Node 6B: Get Next ID

**Type:** Google Sheets - Get Range

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `shopify_raw_daily`
- **Range:** `A2:A` (ID column)

---

## Node 7B: Format Row with Auto-Increment ID

**Type:** Function Node

```javascript
const idColumn = $node["Get Next ID"].json.values.flat().map(v => parseInt(v) || 0);
const nextId = Math.max(...idColumn, 0) + 1;
const parsed = $node["Parse Shopify"].json;

return {
  id: nextId,
  row: [
    nextId,
    parsed.date,
    parsed.total_orders,
    parsed.total_revenue,
    parsed.net_revenue,
    parsed.total_returns,
    parsed.new_customers,
    parsed.repeat_customers
  ]
};
```

---

## Node 8B: Append Row to Sheet

**Type:** Google Sheets - Append

**Config:**
- **Spreadsheet ID:** `1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8`
- **Sheet Name:** `shopify_raw_daily`
- **Values:** `{{ $node["Format Row"].json.row }}`

---

## Node 9: Notification

**Type:** Slack/Email

**Message:**
```
✅ Shopify Daily Update - {{ IF($node["Find Row Number"], "Updated", "Appended") }}
Date: {{ $node["Parse Shopify"].json.date }}
Orders: {{ $node["Parse Shopify"].json.total_orders }}
Revenue: ${{ $node["Parse Shopify"].json.total_revenue }}
```

**Sheet Schema (shopify_raw_daily sheet):**

| Column | Header          | Type   | Example      | Source                  |
|--------|----------------|--------|-------------|-------------------------|
| A      | id             | Number | 12          | Auto-increment or existing |
| B      | date           | Date   | 2025-12-18  | day (from ShopifyQL)    |
| C      | total_orders   | Number | 342         | orders                  |
| D      | total_revenue  | Number | 52847.65    | total_sales             |
| E      | net_revenue    | Number | 48923.45    | net_sales               |
| F      | total_returns  | Number | 1234.50     | ABS(returns_amount)     |
| G      | new_customers  | Number | 87          | new_customers           |
| H      | repeat_customers | Number | 255        | returning_customers     |

---

---

# CROSS-WORKFLOW SUMMARY TABLE

| Aspect | GA4 | Meta | Shopify |
|--------|-----|------|---------|
| **Trigger Time** | 2:00 AM IST | 2:05 AM IST | 2:10 AM IST |
| **API Endpoint** | Google Analytics Data API v1beta | Meta Graph API v24.0 | Shopify Admin API 2025-10 |
| **Query Type** | POST + JSON Body | GET + Query Params | POST + GraphQL |
| **Fetch Scope** | yesterday (date range) | yesterday (date_preset) | yesterday (TIMESERIES) |
| **Sheet Name** | `ga4_raw_daily` | `meta_raw_daily` | `shopify_raw_daily` |
| **Columns** | 8 | 11 | 8 |
| **Deduplication** | By date in column B | By date in column B | By date in column B (with update fallback) |
| **ID Strategy** | Auto-increment | Auto-increment | Auto-increment |
| **Critical Logic** | Parse YYYYMMDD → YYYY-MM-DD | Pick canonical action type (no summing revenue) | Handle negative returns as absolute value |

---

# AUTHENTICATION & ENVIRONMENT VARIABLES

Required `.env` variables for N8N:

```env
# Google Analytics
GA4_PROPERTY_ID=471200
GA4_ACCESS_TOKEN=ya29.a0AfH6SMB...

# Meta Ads
META_ACCESS_TOKEN=EAAFa8...

# Shopify
SHOPIFY_STORE_DOMAIN=supr-kpi.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_abc...

# Google Sheets (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=n8nworkflows@PROJECT_ID.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY={"type": "service_account", ...}
```

---

# ERROR HANDLING & RETRY LOGIC

## For All Workflows:

1. **HTTP Failures (4xx/5xx):**
   - Retry 2x with 30-second exponential backoff
   - Log full response body
   - Send alert notification to ops channel

2. **Sheet Write Failures:**
   - Retry 1x (sheet may be temporarily locked)
   - If fails, store row in failover queue (database or file)
   - Trigger manual review workflow

3. **No Data Returned:**
   - Log warning: "API returned no data for yesterday"
   - Do NOT append empty row
   - Send notification to check data source

4. **Parse Errors:**
   - Validate JSON structure before parsing
   - Catch type errors and log detailed debugging info
   - Fail workflow with descriptive error message

---

# TESTING CHECKLIST FOR N8N

- [ ] Dry-run all 3 workflows with test data
- [ ] Verify date parsing (especially GA4 YYYYMMDD format)
- [ ] Confirm deduplication logic works (try appending same date twice)
- [ ] Test ID auto-increment (append 3 rows, verify IDs increment)
- [ ] Verify sheet headers are present before appending (or create if missing)
- [ ] Check authentication tokens are valid and have correct scopes
- [ ] Run all 3 workflows sequentially and verify all 3 rows appear in sheets
- [ ] Check audit trail for Meta workflow (metricSources logged correctly)
- [ ] Verify Shopify returns_amount converted to positive absolute value
- [ ] Test error handling: simulate API down, check retry behavior

---

# DEPLOYMENT NOTES

1. **Schedule all 3 workflows with staggered start times** (5 min apart starting at 2:00 AM IST) to avoid sheet contention
2. **Use service account credentials** (stored securely, not OAuth personal tokens)
3. **Monitor execution logs** daily for warnings/errors
4. **Maintain audit trail** of which metric sources were used (critical for debugging Meta revenue)
5. **Document any sheet schema changes** immediately and update this doc

---

**Document Version:** 1.0  
**Last Updated:** 19 December 2025  
**Status:** Ready for N8N Implementation
