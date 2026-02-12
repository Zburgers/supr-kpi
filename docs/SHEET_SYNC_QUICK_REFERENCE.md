# Sheet Sync Edge Cases - Quick Reference

## Per-Service Behavior

### Meta Adapter ✏️ Updates Duplicates
**Empty Sheet:** ✅ Auto-creates headers + appends  
**Duplicate Date:** ✏️ Updates existing row  
**Schema Mismatch:** ❌ Rejects sync  

**Columns Required:**
```
id, date, spend, reach, impressions, clicks, landing_page_views, 
add_to_cart, initiate_checkout, purchases, revenue
```

---

### GA4 Adapter ⏭️ Skips Duplicates  
**Empty Sheet:** ✅ Auto-creates headers + appends  
**Duplicate Date:** ⏭️ Skips (idempotent)  
**Schema Mismatch:** ❌ Rejects sync  

**Columns Required:**
```
id, date, sessions, users, add_to_cart, purchases, revenue, bounce_rate
```

---

### Shopify Adapter ✏️ Updates Duplicates
**Empty Sheet:** ✅ Auto-creates headers + appends  
**Duplicate Date:** ✏️ Updates existing row  
**Schema Mismatch:** ❌ Rejects sync  

**Columns Required:**
```
id, date, total_orders, total_revenue, net_revenue, total_returns, 
new_customers, repeat_customers
```

---

## Automatic Handling

| Issue | Handled Automatically |
|-------|----------------------|
| Empty sheet → Create headers | ✅ Yes |
| Uppercase headers ("Date" vs "date") | ✅ Yes |
| Extra spaces in headers | ✅ Yes |
| Missing/invalid dates in rows | ✅ Skip row |
| Non-numeric values in numeric fields | ✅ Default to 0 |
| Empty ID cells | ✅ Auto-generate next ID |
| Concurrent writes | ✅ Queue serializes |
| Rate limiting | ✅ Exponential backoff |

---

## Manual Intervention Required

| Issue | Action | Error Type |
|-------|--------|-----------|
| Schema mismatch | Check sheet mapping in Settings | ❌ Sync fails |
| Wrong sheet configured | Select correct sheet | ❌ Sync fails |
| Missing columns | Add all required columns to sheet | ❌ Sync fails |
| No write permissions | Grant edit access to spreadsheet | ❌ Auth error |
| Sheet deleted | Reconfigure sheet in Settings | ❌ Not found |

---

## Detection Logic

### Schema Mismatch Detection
```
If sheet has:
  - 2+ Meta-specific columns (spend, reach, impressions, clicks, landing_page_views)
  - 2+ GA4-specific columns (sessions, users, bounce_rate)
  - 2+ Shopify-specific columns (total_orders, total_revenue, net_revenue, repeat_customers)

AND doesn't match current sync service
→ Reject with "Schema mismatch" error
```

---

## Error Messages

### User-Friendly Error Messages
```
1. Empty sheet detected
   ✅ Auto-fixed: Headers created

2. Schema mismatch detected
   ❌ Error: "Schema mismatch: Sheet contains [GA4] data but expecting [META] data. 
             Missing columns: [spend, reach, clicks]. 
             Please check your sheet to avoid overwriting data."

3. Missing columns
   ❌ Error: "Schema mismatch: Missing columns: [spend, impressions, landing_page_views]"

4. Sheet not found
   ❌ Error: "Sheet not found: 'RawShopify' in spreadsheet {ID}"

5. No permissions
   ❌ Error: "The caller does not have permission to edit [Range]"
```

---

## ID Sequence Rules

```
Existing IDs in column:    [1, 2, empty, 4, null, 6]
Parsed (cleaned):          [1, 2, 4, 6]
Next ID:                   max(1,2,4,6) + 1 = 7

Rules:
- Skip empty cells
- Skip null/undefined
- Skip non-numeric values
- Skip negative numbers
- Start at 1 if no existing IDs
```

---

## For New Users

**First Sync to Empty Sheet:**
1. User configures sheet mapping
2. Sheet is completely empty → No headers yet
3. First sync runs
4. **System automatically:**
   - Creates header row with proper column names
   - Appends first data row
   - Initializes ID sequence starting at 1
5. User sees data in spreadsheet
6. All future syncs append new rows

**No additional setup needed!** ✅

---

## Troubleshooting

**"Schema mismatch" error?**
- ❓ Did you select the right sheet for this service?
- Check: Settings → Sheet Mappings
- Fix: Select the sheet configured for this service

**"Missing columns" error?**
- ❓ Does the sheet have all expected columns?
- Check: Column headers in the sheet
- Fix: Add any missing columns

**"Sheet not found" error?**
- ❓ Was the sheet deleted?
- Check: Does the sheet still exist in the spreadsheet?
- Fix: Recreate sheet or update mapping

**Sync keeps failing?**
- Check: Spreadsheet permissions (must have Edit access)
- Check: Google Sheets credential is still valid
- Try: Manually create headers in the sheet

---

## Code References

- **Validation Logic**: [src/adapters/base.adapter.ts](src/adapters/base.adapter.ts)
  - `validateHeaderSchema()` - Schema detection
  - `isSheetEmpty()` - Empty sheet detection
  
- **Implementation**:
  - [src/adapters/meta.adapter.ts](src/adapters/meta.adapter.ts)
  - [src/adapters/ga4.adapter.ts](src/adapters/ga4.adapter.ts)
  - [src/adapters/shopify.adapter.ts](src/adapters/shopify.adapter.ts)

- **Full Guide**: [EDGE_CASES_HANDLING.md](EDGE_CASES_HANDLING.md)
