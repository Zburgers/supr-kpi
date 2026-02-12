# Data Flow Architecture Analysis

## Current Architecture Overview

The current system has **TWO SEPARATE DATA FLOWS**:

### 1. 📥 DATA WRITING FLOW (API → Google Sheets)
**When**: Triggered by scheduler (2 AM daily) or manual sync
**Direction**: `Meta/GA4/Shopify APIs → Backend → Google Sheets`

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Scheduler runs at 2 AM OR user clicks "Sync" / "Manual Pull" │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Backend fetches fresh data from platform APIs:              │
│    • Meta Graph API     (Meta Ads data)                         │
│    • GA4 Data API       (Google Analytics data)                 │
│    • Shopify Admin API  (Store data)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Backend parses & normalizes the API responses                │
│    • meta.ts:    parseMetrics()                                 │
│    • google.ts:  parseMetrics()                                 │
│    • shopify.ts: parseMetrics()                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Backend writes/appends to Google Sheets                      │
│    • sheets.ts: appendRow() or upsertToSheet()                  │
│    • Target: 1HlVbOXTf...8uCkZjUBHxFPRXB-2mcVNvu8               │
│    • Sheets: RawMeta, RawGA, RawShopify                         │
└─────────────────────────────────────────────────────────────────┘
```

**Files involved:**
- `src/server/index.ts` - Scheduler: `runDailySync()` at line 54-139
- `src/services/meta.service.ts` - `runWorkflow()` fetches from Meta API, appends to sheets using stored credentials
- `src/services/ga4.service.ts` - `runWorkflow()` fetches from GA4 API, appends to sheets using stored credentials
- `src/services/shopify.service.ts` - `runWorkflow()` fetches from Shopify API, appends to sheets using stored credentials
- `src/services/sheets.ts` - `appendRow()`, `upsertToSheet()` - writes to Google Sheets

---

### 2. 📊 DATA READING FLOW (Google Sheets → Dashboard)
**When**: Dashboard loads or user changes date range
**Direction**: `Google Sheets → Backend → Frontend Dashboard`

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Dashboard loads (React useEffect) or date range changes      │
│    File: dashboard/src/hooks/use-dashboard-data.ts:148          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Frontend calls API endpoint (3 parallel requests):           │
│    GET /api/data/:spreadsheetId/RawMeta                         │
│    GET /api/data/:spreadsheetId/RawGA                           │
│    GET /api/data/:spreadsheetId/RawShopify                      │
│                                                                  │
│    File: dashboard/src/lib/api.ts:44                            │
│    Function: getSheetData(spreadsheetId, sheetName)             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Backend receives request                                     │
│    File: src/server/index.ts:285-299                            │
│    Route: app.get("/api/data/:spreadsheetId/:sheetName")        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Backend calls Google Sheets API                              │
│    File: src/services/sheets.ts:273-317                         │
│    Function: readSheet(spreadsheetId, sheetName)                │
│    API: spreadsheets.values.get({ spreadsheetId, range })       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Google Sheets API returns raw data (2D array of strings)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Backend returns data to frontend                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Frontend parses the data                                     │
│    File: dashboard/src/hooks/use-dashboard-data.ts:62-114       │
│    Functions: parseMetaRows(), parseGa4Rows(), parseShopifyRows()│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Dashboard renders the data (charts, tables, metrics)         │
│    File: dashboard/src/pages/dashboard.tsx                      │
└─────────────────────────────────────────────────────────────────┘
```

**Key Files:**
- `dashboard/src/hooks/use-dashboard-data.ts:116-148` - `fetchData()` function
- `dashboard/src/lib/api.ts:44-47` - `getSheetData()` API call
- `src/server/index.ts:285-299` - API endpoint handler
- `src/services/sheets.ts:273-317` - `readSheet()` Google Sheets API call

---

## 🚨 RATE LIMITING CONCERNS

### Current Issue: Direct Google Sheets API Calls
**Every time the dashboard loads or date range changes:**
1. **3 Google Sheets API requests** are made (Meta, GA4, Shopify)
2. Each request reads the **ENTIRE sheet** (A1:Z range)
3. **No caching** exists - every dashboard interaction = 3 API calls

### Google Sheets API Quota Limits
| Limit Type | Value |
|------------|-------|
| Requests per 100 seconds per user | 100 |
| Requests per 100 seconds | 300 |
| Read requests per minute per user | 60 |

**With 10 users refreshing the dashboard:**
- 10 users × 3 sheets × 1 refresh = **30 API calls**
- If each user refreshes 3 times/minute = **90 API calls/minute**
- **EXCEEDS QUOTA** → Rate limiting errors

---

## 💡 CACHING STRATEGY RECOMMENDATIONS

### Option 1: **Backend In-Memory Cache** (Simple, Quick Win)
```javascript
// Pseudo-code
const cache = {
  data: null,
  timestamp: null,
  TTL: 5 * 60 * 1000 // 5 minutes
}

app.get("/api/data/:spreadsheetId/:sheetName", async (req, res) => {
  const cacheKey = `${req.params.spreadsheetId}:${req.params.sheetName}`
  
  // Check cache
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < TTL) {
    return res.json({ 
      success: true, 
      data: cache[cacheKey].data,
      cached: true 
    })
  }
  
  // Fetch from Sheets API
  const data = await sheetsService.readSheet(...)
  
  // Store in cache
  cache[cacheKey] = { data, timestamp: Date.now() }
  
  res.json({ success: true, data, cached: false })
})
```

**Pros:**
- Easy to implement (30 minutes of work)
- Reduces API calls by 95%+
- No additional infrastructure

**Cons:**
- Cache lost on server restart
- Not shared across multiple server instances
- Memory usage grows with data size

---

### Option 2: **Redis Cache** (Production-Grade)
Already have Redis setup in docker-compose.yml!

```javascript
import { createClient } from 'redis'

const redis = createClient({ url: process.env.REDIS_URL })

app.get("/api/data/:spreadsheetId/:sheetName", async (req, res) => {
  const cacheKey = `sheets:${req.params.spreadsheetId}:${req.params.sheetName}`
  
  // Check Redis
  const cached = await redis.get(cacheKey)
  if (cached) {
    return res.json({ 
      success: true, 
      data: JSON.parse(cached),
      cached: true 
    })
  }
  
  // Fetch from Sheets API
  const data = await sheetsService.readSheet(...)
  
  // Store in Redis with TTL
  await redis.setEx(cacheKey, 300, JSON.stringify(data)) // 5 min TTL
  
  res.json({ success: true, data, cached: false })
})
```

**Pros:**
- Persistent cache (survives server restarts)
- Shared across multiple server instances
- TTL management built-in
- Can invalidate cache on sync

**Cons:**
- Requires Redis setup (already done!)
- Slightly more complex

---

### Option 3: **Database Cache** (Long-term Storage)
Store fetched data in PostgreSQL/MongoDB instead of reading from Sheets.

**Architecture:**
```
Platform APIs → Backend → Database (primary storage)
                            ↓
                       Dashboard reads from DB
```

**Pros:**
- Complete independence from Google Sheets
- Fast queries with indexes
- Historical data tracking
- No rate limiting concerns

**Cons:**
- Major architectural change
- Database setup required
- Duplicate data storage

---

## 📋 RECOMMENDED IMPLEMENTATION PLAN

### Phase 1: Quick Win (TODAY - 1 hour)
✅ Implement **Option 1: In-Memory Cache**
- Add simple cache to `/api/data` endpoint
- Set TTL to 5 minutes
- Invalidate cache after sync completes

### Phase 2: Production Ready (TOMORROW - 2 hours)
✅ Implement **Option 2: Redis Cache**
- Already have Redis in docker-compose
- Add `ioredis` package
- Migrate from in-memory to Redis
- Add cache invalidation on sync

### Phase 3: Scale (FUTURE - if needed)
⚠️ Consider **Option 3: Database** if:
- Need historical data beyond what's in sheets
- Want complex queries/reporting
- Planning to scale to 100+ users

---

## 🎯 CACHE INVALIDATION STRATEGY

**When to invalidate cache:**
1. ✅ After successful sync (scheduler or manual)
2. ✅ After manual data pull
3. ✅ On demand via API endpoint `/api/cache/clear`

**Implementation in current codebase:**
```javascript
// After successful sync in runDailySync()
if (result.success) {
  await cache.invalidate(`sheets:${spreadsheetId}:${sheetName}`)
}
```

---

## 📊 EXPECTED IMPROVEMENTS

| Metric | Before | After Cache |
|--------|--------|-------------|
| Dashboard load time | 2-3 seconds | 200-300ms |
| Google Sheets API calls | 3 per page load | 3 per 5 minutes |
| Concurrent users supported | ~10-15 | 100+ |
| Rate limit errors | Frequent | None |

---

## 🔧 FILES TO MODIFY FOR CACHING

1. `src/server/index.ts` - Add cache to `/api/data` endpoint
2. `src/lib/cache.ts` - New file for cache service
3. `src/server/index.ts` - Invalidate cache after sync
4. `dashboard/src/lib/api.ts` - Display cache status to user (optional)

---

## CONCLUSION

**Answer to your questions:**
1. ✅ **Dashboard data is fetched FROM GOOGLE SHEETS** (not directly from APIs)
2. ✅ **Every dashboard load = 3 Google Sheets API calls** (no caching currently)
3. ✅ **Rate limiting IS a real concern** with multiple users
4. ✅ **Caching is HIGHLY RECOMMENDED** - start with Option 1 or 2

The good news: You already have the scheduler writing to Sheets daily, so the data is fresh. You just need to cache the reads from Sheets to avoid rate limits!
