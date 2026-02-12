# 🧪 Testing Guide - Meta Token Management

## Quick Test Workflow

### Test 1: Empty Token (Error Case)
```
1. Open browser to http://localhost:3000
2. Scroll to "Meta Insights" section
3. Leave token field empty
4. Click "🚀 Fetch & Append"

EXPECTED:
✗ Status message: "Please enter your Meta access token first"
✗ Nothing sent to backend
✓ Console shows the request was blocked
```

### Test 2: Token Storage (Happy Path)
```
1. Get your Meta access token from:
   https://developers.facebook.com/apps → Your App → Tools → Access Token Tool

2. Paste token into "Access Token" field in Meta Insights section

3. Click outside the field (blur event)

EXPECTED:
✓ Status message: "✓ Access token stored"
✓ appState.metaToken now contains your token
✓ Token remains until page reload
✓ Console shows: "✓ Meta access token updated"
```

### Test 3: Fetch with Valid Token
```
1. Ensure token is entered and shows "✓ Access token stored"

2. Click "🚀 Fetch & Append" button

3. Watch the console for detailed logging

EXPECTED:
✓ Console shows: "📤 Sending request to /api/meta/fetch with token"
✓ Backend logs: "[API] Access token received, starting workflow..."
✓ Workflow runs through all 4 steps:
  - [STEP 1] Fetching from Meta API
  - [STEP 2] Parsing and normalizing data
  - [STEP 3] Formatting for sheet
  - [STEP 4] Appending to Google Sheet
✓ Status message: "✅ Appended Meta data for YYYY-MM-DD to meta_raw_daily"
✓ New row appears in meta_raw_daily Google Sheet
```

### Test 4: Token Expiration (Invalid Token)
```
1. Use an expired or invalid token

2. Click "🚀 Fetch & Append"

3. Watch console and status message

EXPECTED:
✗ Backend receives token and starts workflow
✗ Meta API rejects with HTTP 401/400
✗ Status message: "❌ Meta API error: HTTP 401"
✗ Console shows full error details
✗ No data appended to sheet
```

### Test 5: Page Reload (Session Clearing)
```
1. Enter valid token, see "✓ Access token stored"

2. Press F5 to reload page

3. Check token field

EXPECTED:
✓ Token field is empty
✓ appState.metaToken is null
✓ Trying to click button without token shows error
✓ You must re-enter token after reload
```

### Test 6: Token Field Validation (UI/UX)
```
1. Type/paste into token field (type event)

2. Change the token value

3. Blur (click elsewhere)

EXPECTED:
✓ updateMetaToken() called on both "change" and "blur"
✓ Token is validated each time
✓ Status shows immediately
✓ Can paste long tokens without issues
```

---

## Console Logging - What to Look For

### Success Flow (Token received, data fetched):
```
🔵 [API] POST /api/meta/fetch - Request received
✓ [API] Access token received, starting workflow...
==================================================================
🚀 Starting Meta insights workflow...
==================================================================

[STEP 1] Fetching from Meta API
---------...
📡 Fetching Meta insights from Graph API...
URL: https://graph.facebook.com/v24.0/act_1458189648725469/insights [with token]
✓ Got response - Status: 200 OK

[STEP 2] Parsing and normalizing data
---------...
📝 Processing metrics:
   - date: 2025-12-14
   - spend: 13899.48
   - reach: 20926
   ...

[STEP 3] Formatting for sheet
---------...
📊 Sheet row formatted (10 columns):
   [date, spend, reach, impressions, clicks, landing_page_views, add_to_cart, ...]

[STEP 4] Appending to Google Sheet
---------...
✓ Successfully appended to meta_raw_daily

==================================================================
✅ Meta insights workflow completed successfully
==================================================================

🟢 [API] Sending success response
```

### Error Flow (Missing token):
```
🔵 [API] POST /api/meta/fetch - Request received
❌ [API] Missing accessToken in request body
🔴 [API] Sending error response
[API] Error details: Access token is required...
```

### Error Flow (Invalid token):
```
🔵 [API] POST /api/meta/fetch - Request received
✓ [API] Access token received, starting workflow...

[STEP 1] Fetching from Meta API
❌ Meta API error response (401):
{"error":{"message":"Invalid OAuth access token","type":"OAuthException","code":190}}

🔴 [API] Sending error response
```

---

## Browser DevTools - What to Check

### Network Tab:
1. Click "🚀 Fetch & Append"
2. Look for POST request to `/api/meta/fetch`
3. In Request → click "Payload" tab
4. Should show: `{ "accessToken": "your-token-here" }`
5. Status should be 200 (success) or 400/500 (error)

### Console Tab:
1. All logs show token flow and progress
2. No security warnings about token exposure
3. Errors clearly indicate the issue

### Application Tab → Session Storage:
1. Token should NOT appear in localStorage
2. Token should NOT appear in cookies
3. Token only exists in JavaScript `appState.metaToken` variable

---

## Common Issues & Solutions

### Issue: "Please enter your Meta access token first"
**Cause:** Token field is empty or value is whitespace only  
**Solution:** Paste a valid Meta access token into the field

### Issue: "Meta API error: HTTP 400"
**Cause:** Token is expired or malformed  
**Solution:** Generate a fresh token from Meta Developer Dashboard

### Issue: "Meta API error: HTTP 401"
**Cause:** Token lacks required permissions  
**Solution:** Ensure token includes these permissions:
- `ads_read`
- `ads_management`
- `pages_manage_metadata`

### Issue: Token disappears after refresh
**Cause:** Session storage behavior (intentional)  
**Solution:** This is correct - tokens are NOT saved. Re-enter after reload

### Issue: No data in meta_raw_daily after successful sync
**Cause:** Possible sheet permission issue  
**Solution:** Verify service account has write access to the sheet

### Issue: "Cannot read property 'metaToken' of undefined"
**Cause:** appState not initialized  
**Solution:** Ensure page is fully loaded, check console for init errors

---

## Advanced Testing

### Test Different Token Formats:
```
✓ Valid format: abc123def456...
✓ With spaces: abc 123 def 456 (will be trimmed)
✗ Empty string: (shows error)
✗ Spaces only: "   " (shows error)
```

### Test Rapid Token Changes:
```
1. Paste token A → See "✓ Access token stored"
2. Quickly change to token B → Should update
3. Change back to token A → Should work
4. Click Fetch → Uses the current token in appState
```

### Test Concurrent Requests (Should not happen):
```
1. Enter token
2. Click "🚀 Fetch & Append"
3. Immediately click again before response
EXPECTED:
✓ First request processes normally
✓ Second request waits or is queued
✓ No race condition errors
```

---

## Success Checklist

- [ ] Token field appears in "Meta Insights" section
- [ ] Can paste multi-character strings into field
- [ ] "✓ Access token stored" appears after blur
- [ ] Page reload clears token
- [ ] Empty token shows error message
- [ ] Valid token successfully fetches data
- [ ] Data appears in meta_raw_daily sheet
- [ ] Console shows all 4 workflow steps
- [ ] Invalid token shows HTTP error
- [ ] No token causes 400 error from backend
- [ ] Token is never logged/exposed in plain text
- [ ] Feature doesn't break other functionality

---

## Ready to Launch? ✨

Once all tests pass, your token management feature is production-ready!

**Next Steps:**
1. Share this guide with your team
2. Test with real Meta tokens
3. Verify Google Sheet permissions
4. Monitor console for any errors
5. Update token when it expires (no code changes needed!)
