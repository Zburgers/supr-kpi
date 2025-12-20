# ⚡ Quick Reference - Meta Token Management

## 🎯 What Changed?
Meta access tokens are now **user-configurable** instead of hardcoded. Update tokens without touching code!

## 📍 Where to Enter Token?
**Frontend → Meta Insights Section → "Access Token" field**

## 🔄 How It Works (TL;DR)

```
1. Paste token in frontend
2. Token stored in browser memory
3. Click "Fetch & Append"
4. Token sent to backend
5. Backend passes to service
6. Service uses dynamic token with Meta API
7. Data appended to sheet
```

## 📁 Files Changed
| File | What Changed | Lines |
|------|--------------|-------|
| `public/index.html` | Added token input field | +11 |
| `public/app.js` | Added token functions & listeners | +25 |
| `src/services/meta.ts` | Accept token parameter | ~12 |
| `src/server/index.ts` | Accept & validate token | ~25 |

## 🚀 Usage

### First Time
```
1. Get token from: https://developers.facebook.com/apps → Access Token Tool
2. Copy token
3. Paste into "Access Token" field in Meta Insights
4. See: "✓ Access token stored"
5. Click "🚀 Fetch & Append"
6. Data appended to meta_raw_daily
```

### Token Expires?
```
1. Generate new token from Meta Dashboard
2. Paste into "Access Token" field
3. See: "✓ Access token stored"
4. Click "🚀 Fetch & Append" again
5. Done! No code changes needed
```

## ⚠️ Important Notes

| Aspect | Detail |
|--------|--------|
| **Storage** | Browser memory only (cleared on reload) |
| **Persistence** | NOT saved in localStorage/cookies |
| **Duration** | Session-scoped (one browser session) |
| **Security** | Password field for UI convenience |
| **Validation** | Checked before every API call |
| **Error Handling** | Clear messages for missing/invalid tokens |

## 🔍 Testing Quick Checks

```
✓ Empty field → Error: "Please enter your Meta access token first"
✓ Paste token → Shows: "✓ Access token stored"
✓ Click Fetch → Successful data append to sheet
✓ Reload page → Token is cleared
✓ Invalid token → Error: "Meta API error: HTTP 401"
```

## 📊 Console Logs (What You'll See)

### Success
```
✓ Meta access token updated
📤 Sending request to /api/meta/fetch with token
📥 Response received: { success: true, ... }
✅ Appended Meta data for 2025-12-14 to meta_raw_daily
```

### Error
```
❌ Meta sync error: Access token is required
[API] Missing accessToken in request body
❌ Meta API error: HTTP 401
```

## 🛠️ Common Tasks

### How do I get a Meta token?
1. Go to [Meta Developer Dashboard](https://developers.facebook.com/apps)
2. Select your app
3. Go to **Tools → Access Token Tool**
4. Copy the token
5. Paste in frontend

### How long does a token last?
- Depends on token type
- Short-lived: ~1-2 hours
- Long-lived: ~60 days (if available)
- Check token expiry in Meta Dashboard

### What happens when token expires?
The app will show: `Meta API error: HTTP 401`
Solution: Generate new token and paste again

### Can I save the token permanently?
No - by design, tokens are session-scoped for security. You must re-enter after reload.

### Is my token safe?
- ✅ Not stored in localStorage/cookies
- ✅ Only in browser memory (volatile)
- ✅ Cleared on page reload
- ✅ Use HTTPS in production to encrypt in transit
- ⚠️ Visible in DevTools (intentionally password field for convenience)

## 📚 Full Documentation

For detailed information, see:
- **`TOKEN_MANAGEMENT.md`** - Complete usage guide
- **`TESTING_GUIDE.md`** - Step-by-step testing workflow
- **`IMPLEMENTATION_SUMMARY.md`** - Technical deep dive
- **`CHANGELOG.md`** - Complete change log

## ✅ Status
- ✅ Feature complete
- ✅ Zero TypeScript errors
- ✅ All tests passing
- ✅ Ready for production

## 🚀 Ready to Use!
1. Start the app: `npm start`
2. Enter your Meta token
3. Click "🚀 Fetch & Append"
4. Profit! 📈

---

**Questions?** Check the documentation files above! 📖
