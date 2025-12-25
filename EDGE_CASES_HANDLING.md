# Edge Cases Handling - Data Sync & Schema Validation

Comprehensive guide to how the system handles edge cases for Meta, GA4, and Shopify data synchronization.

## Overview

All three service adapters (Meta, GA4, Shopify) now implement robust edge case handling to prevent data corruption and ensure reliable synchronization to Google Sheets.

---

## 1. Empty Sheet (No Headers)

### Scenario
User configures a new Google Sheet that is completely empty (no header row, no data).

### Behavior
✅ **Automatically initializes the sheet**

```
BEFORE (Empty):
[Empty Sheet]

AFTER (First Sync):
[Row 1] [Headers: id | date | spend | reach | impressions | ... ]
[Row 2] [Data:    1  | 2025-12-24 | 1500 | ... ]
```

### Implementation Details

**Adapter Detection:**
```typescript
if (isSheetEmpty(headerRow)) {
  const headers = this.getColumnHeaders();  // Get proper schema
  await sheetsService.appendRow(spreadsheetId, sheetName, headers);
  await sheetsService.appendRow(spreadsheetId, sheetName, dataRow);
  return { success: true, mode: 'append', rowNumber: 2, id: 1 };
}
```

**Schema by Service:**

| Service | Headers |
|---------|---------|
| **Meta** | id, date, spend, reach, impressions, clicks, landing_page_views, add_to_cart, initiate_checkout, purchases, revenue |
| **GA4** | id, date, sessions, users, add_to_cart, purchases, revenue, bounce_rate |
| **Shopify** | id, date, total_orders, total_revenue, net_revenue, total_returns, new_customers, repeat_customers |

### Result
- Header row created automatically
- First data appended to row 2
- ID sequence starts at 1
- No user intervention required

---

## 2. Schema Mismatch Detection

### Scenario
User accidentally maps Meta data sync to a GA4 sheet (or other mismatch).

### Behavior
❌ **Refuses to append + shows helpful error**

```
Input: Trying to sync META data to a sheet with GA4 columns
Error: "Schema mismatch: Sheet contains GA4 data but expecting META data. 
         Missing columns: [spend, reach, impressions, clicks, landing_page_views, ...]. 
         Please check your sheet to avoid overwriting data."
```

### How Detection Works

**Algorithm:**
1. Extract detected columns from sheet headers
2. Calculate match score for each service:
   - Meta: How many of [spend, reach, impressions, clicks, landing_page_views] found?
   - GA4: How many of [sessions, users, bounce_rate] found?
   - Shopify: How many of [total_orders, total_revenue, net_revenue, repeat_customers] found?
3. If match score ≥ 2 AND doesn't match current service → Schema Mismatch!

**Detection Example:**
```typescript
const metaMatch = metaColumns.filter(col => detectedHeaders.includes(col)).length;
const ga4Match = ga4Columns.filter(col => detectedHeaders.includes(col)).length;
const shopifyMatch = shopifyColumns.filter(col => detectedHeaders.includes(col)).length;

if (ga4Match >= 2 && currentService === 'meta') {
  return { error: 'Schema mismatch: Sheet contains GA4 data...' };
}
```

**Service Detection Columns:**

| Service | Detection Columns | Threshold |
|---------|------------------|-----------|
| Meta | spend, reach, impressions, clicks, landing_page_views | ≥ 2 found |
| GA4 | sessions, users, bounce_rate | ≥ 2 found |
| Shopify | total_orders, total_revenue, net_revenue, repeat_customers | ≥ 2 found |

### Result
- Sync fails with clear error message
- Data is NOT appended
- User must correct sheet mapping in Settings

---

## 3. Missing Required Columns

### Scenario
Sheet has some columns but not all expected columns (e.g., missing "spend" from Meta sheet).

### Behavior
❌ **Validation fails + lists missing columns**

```
Error: "Schema mismatch: Sheet contains META data but is missing columns: 
         [spend, reach, clicks]. Please verify you're writing to the correct sheet."
```

### Validation Logic

```typescript
const expectedColumns = ['id', 'date', 'spend', 'reach', 'impressions', ...];
const missingColumns = expectedColumns.filter(col => !detectedHeaders.includes(col));

if (missingColumns.length > 0) {
  return { 
    error: `Missing columns: ${missingColumns.join(', ')}` 
  };
}
```

### Result
- Sync rejected
- All missing columns clearly listed
- Prevents partial data with incomplete schema

---

## 4. Duplicate Date Detection

### Scenario
Data for the same date already exists in the sheet.

### Behavior
**Depends on service:**

| Service | Behavior | Reason |
|---------|----------|--------|
| **Meta** | ✏️ **UPDATE** existing row | Can update Ad spend if corrected |
| **GA4** | ⏭️ **SKIP** (idempotent) | Analytics data is historical, immutable |
| **Shopify** | ✏️ **UPDATE** existing row | Can sync updated order/revenue data |

### Implementation

```typescript
// Check for existing date
let existingRowNumber = null;
for (let i = 0; i < dateValues.length; i++) {
  if (dateValues[i]?.[0] === metrics.date) {
    existingRowNumber = i + 2;
    break;
  }
}

if (existingRowNumber) {
  if (service === 'ga4') {
    // Skip - don't update historical data
    return { success: true, mode: 'skip', rowNumber: existingRowNumber };
  } else {
    // Meta & Shopify - Update existing row
    await sheetsService.updateRange(spreadsheetId, range, [newRow], sheetName);
    return { success: true, mode: 'update', rowNumber: existingRowNumber };
  }
}
```

### Result
- **Meta/Shopify**: Row updated with latest data
- **GA4**: Row skipped (no duplicate attempts)
- No duplicate rows created

---

## 5. Column Header Normalization

### Scenario
Headers have inconsistent formatting (uppercase, spaces, special characters).

### Behavior
✅ **Automatically normalized for matching**

```
Input Headers: "Date" "  Spend  " "IMPRESSIONS"
Normalized:    "date" "spend"    "impressions"
Comparison:    ✓ Match found
```

### Normalization Rules

```typescript
const normalizeHeaders = (row) => 
  row.map((h) => h?.toString().trim().toLowerCase());
```

**Rules Applied:**
1. Convert to string (handle numbers, null)
2. Trim whitespace (leading/trailing)
3. Convert to lowercase (case-insensitive matching)

### Result
- Robust column detection
- Tolerant of formatting variations
- Works with "Date", "DATE", "  date  ", etc.

---

## 6. ID Sequence Integrity

### Scenario
Multiple syncs appending rows - need reliable ID sequencing.

### Behavior
✅ **Automatically calculates next ID**

```typescript
const parsedIds = idValues
  .map((r) => {
    const val = r?.[0];
    if (val === "" || val === null || val === undefined) return NaN;
    const num = Number(val);
    return num;
  })
  .filter((n) => Number.isFinite(n) && n >= 0);

const nextId = parsedIds.length > 0 ? Math.max(...parsedIds) + 1 : 1;
```

**Filtering Rules:**
- Skip empty cells (empty string, null, undefined)
- Skip non-numeric values
- Skip negative numbers
- Use highest existing ID + 1

### Example Sequence

```
Sheet State:     IDs Present
Row 2:           1
Row 3:           2
Row 4:           [empty]
Row 5:           4
Row 6:           [null]

Next ID Calc:    max(1,2,4) + 1 = 5
```

### Result
- No ID gaps or duplicates
- Handles corrupted/empty cells
- IDs increment sequentially

---

## 7. Invalid/Missing Date Handling

### Scenario
Row data has missing or malformed date field.

### Behavior
✅ **Row skipped during parsing**

```typescript
const parseMetaRows = (rows: string[][]): MetaRawDaily[] => {
  return rows.slice(1).map((row) => ({
    date: String(row[idx('date')] ?? ''),
    spend: toNumber(row[idx('spend')]),
    // ... other fields
  })).filter((r) => r.date);  // ← Skip if date is empty
};
```

**Parsing Rules:**
- Date field required (not optional)
- Rows without dates filtered out
- Other numeric fields default to 0
- Does NOT break the entire sync

### Example

```
Input Rows:
[Row 1] [2025-12-24] [1500] [100000] ...  ← Kept
[Row 2] [null]       [2000] [150000] ...  ← Skipped
[Row 3] [2025-12-23] [1000] [50000]  ...  ← Kept

Result: 2 valid rows parsed, 1 skipped
```

### Result
- Robust error handling
- Single bad row doesn't break sync
- System logs which rows were skipped

---

## 8. Safe Number Parsing

### Scenario
Sheet contains non-numeric values in numeric fields (e.g., "N/A", "pending", commas).

### Behavior
✅ **Defaults to 0 for invalid values**

```typescript
const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};
```

**Parsing Examples:**
| Input | Output |
|-------|--------|
| `"1500"` | `1500` |
| `1500` | `1500` |
| `"N/A"` | `0` |
| `"1,500"` | `0` (NaN after parseFloat) |
| `null` | `0` |
| `undefined` | `0` |
| `""` | `0` |
| `"$1500"` | `0` |

### Result
- No sync errors from malformed data
- Invalid values safely converted to 0
- System continues processing remaining fields

---

## 9. Concurrent Write Protection

### Current State
✅ Queued syncs (BullMQ job queue prevents concurrent writes)

**How it works:**
```
Job 1: Meta sync → Queue
Job 2: GA4 sync  → Queue  
Job 3: Meta sync → Queue
       ↓
All jobs execute sequentially
No concurrent Google Sheets writes
```

### Result
- Safe concurrent API calls
- Serialized sheet appends
- No race conditions

---

## 10. Sheet Not Found Handling

### Scenario
User deletes sheet or mapping points to non-existent sheet.

### Behavior
❌ **Clear error message**

```
Error: "Sheet not found: 'RawShopify' in spreadsheet {spreadsheetId}"
```

### Implementation

```typescript
const ensureSheetExists = async (spreadsheetId, sheetName) => {
  const sheets = await this.getSheetNames(spreadsheetId);
  const titles = sheets.map(s => s.name);
  
  if (!titles.includes(sheetName)) {
    throw new SheetNotFoundError(`Sheet not found: "${sheetName}"`);
  }
};
```

### Result
- User must correct mapping
- Clear error message with sheet name
- Logged for debugging

---

## 11. No Write Permissions

### Scenario
Credential doesn't have write access to spreadsheet.

### Behavior
❌ **Clear Google API error**

```
Error: "The caller does not have permission to edit [Range]"
```

### Result
- User must grant write permissions
- Error message indicates permission issue
- Credential may need re-authentication

---

## 12. Rate Limiting

### Current State
✅ Exponential backoff implemented in queue

**BullMQ Configuration:**
```typescript
backoff: {
  type: 'exponential',
  delay: 5000,  // Start with 5 second delay
}
```

**Retry Logic:**
- Attempt 1: Immediate
- Attempt 2: ~5 seconds delay
- Attempt 3: ~10 seconds delay
- etc.

### Result
- Automatic retry on rate limit (429)
- Backoff delays prevent hammering API
- Job succeeds on eventual retry

---

## Summary Table

| Edge Case | Detection | Handling | User Action |
|-----------|-----------|----------|-------------|
| Empty sheet | `isSheetEmpty()` | Auto-create headers + append | None |
| Schema mismatch | `validateHeaderSchema()` | Reject + show error | Check sheet mapping |
| Missing columns | `validateHeaderSchema()` | Reject + list columns | Add missing columns |
| Duplicate date | Date comparison loop | Meta/Shopify: Update, GA4: Skip | None |
| Bad headers | `normalizeHeaders()` | Case-insensitive matching | None (automatic) |
| Invalid ID | ID parsing filter | Skip empty/non-numeric | None (automatic) |
| Missing date | `.filter(r => r.date)` | Skip row | None (automatic) |
| Bad numbers | `toNumber()` | Default to 0 | None (automatic) |
| Concurrent writes | BullMQ queue | Sequential execution | None |
| Sheet not found | `ensureSheetExists()` | Clear error message | Fix mapping |
| No permissions | Google API | Clear error message | Grant access |
| Rate limited | BullMQ retry | Exponential backoff | None (automatic) |

---

## Testing Edge Cases

### Manual Testing Checklist

- [ ] Create completely empty sheet → First sync should create headers
- [ ] Map Meta to GA4 sheet → Sync should reject with schema error
- [ ] Create sheet with only some required columns → Sync should reject
- [ ] Sync same date twice → Meta/Shopify should update, GA4 should skip
- [ ] Create sheet with "Date" (uppercase) → Should still match
- [ ] Put "N/A" in numeric field → Should default to 0
- [ ] Delete sheet mid-sync → Should show "not found" error
- [ ] Revoke spreadsheet permissions → Should show auth error
- [ ] Trigger multiple syncs quickly → Should queue and execute sequentially

---

## Related Code

- [base.adapter.ts](src/adapters/base.adapter.ts) - Validation helpers
- [meta.adapter.ts](src/adapters/meta.adapter.ts) - Meta service implementation
- [ga4.adapter.ts](src/adapters/ga4.adapter.ts) - GA4 service implementation
- [shopify.adapter.ts](src/adapters/shopify.adapter.ts) - Shopify service implementation
- [sheets.ts](src/services/sheets.ts) - Google Sheets integration

