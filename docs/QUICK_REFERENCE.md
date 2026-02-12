# Quick Reference

Fast lookup guide for common tasks.

## 🚀 Getting Started (5 minutes)

```bash
# 1. Install
npm install

# 2. Build
npm run build

# 3. Start
npm start

# 4. Open browser
# http://localhost:3000
```

## 📊 Frontend Workflow

1. **Select Sheet** → Dropdown or paste ID
2. **Load Data** → Click "Load Data" button
3. **Edit Cells** → Click any cell
4. **Save All** → Click "Save All Changes"
5. **Confirm** → Confirm dialog appears

## 📡 API Quick Ref

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/spreadsheets` | GET | List all sheets |
| `/api/sheets/:id` | GET | Get sheet names |
| `/api/data/:id/:name` | GET | Read data |
| `/api/data/:id/:name` | POST | Write data |
| `/api/range/:id` | PUT | Update range |
| `/api/append/:id/:name` | POST | Add row |

## 🔧 Common Tasks

### Load Sheet Data

```javascript
const sheetId = "1A2B3C...";
const sheetName = "meta_raw_daily";
const response = await fetch(`/api/data/${sheetId}/${sheetName}`);
const { data } = await response.json();
```

### Add Daily Row

```javascript
await fetch(`/api/append/${sheetId}/${sheetName}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    row: [date, spend, reach, impressions, ...]
  })
});
```

### Save All Changes

```javascript
// Frontend: Click "Save All Changes" button
// API call handled by saveToSheet() in app.js
```

## 📁 File Structure

```
src/
  ├── server/index.ts      ← API routes
  ├── services/sheets.ts   ← Google Sheets logic
  └── types/kpi.ts         ← Type definitions

public/
  ├── index.html           ← HTML template
  ├── app.js               ← Main logic
  ├── utils.js             ← Helpers
  └── styles.css           ← Styling
```

## 🔑 Key Interfaces

```typescript
// Daily data row
interface DailyMetrics {
  date: string;              // "2025-12-01"
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  landing_page_views: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchases: number;
  revenue: number;
}

// API Response
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## ⚙️ Configuration

| Setting | Location | Value |
|---------|----------|-------|
| Port | `src/server/index.ts` | 3000 |
| Service Account | Project root | `n8nworkflows-*.json` |
| Frontend Rows | `public/app.js` | 20 initial + lazy load |

## 📝 Data Format

```
Headers (Row 1):
date | spend | reach | impressions | clicks | landing_page_views | add_to_cart | initiate_checkout | purchases | revenue

Data (Row 2+):
2025-12-01 | 150.50 | 5000 | 12500 | 450 | 380 | 25 | 12 | 3 | 450
```

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | Kill process: `lsof -ti:3000 \| xargs kill -9` |
| Service account missing | Add file to project root |
| Blank data loads | Check sheet name spelling (case-sensitive) |
| CORS error | Restart server |
| No spreadsheets showing | Verify service account has Drive access |

## 🔐 Security

- ✅ CORS enabled for development
- ✅ Service account in .gitignore
- ⚠️ Don't commit service account JSON
- ⚠️ Add rate limiting for production

## 📚 Documentation

| File | Purpose |
|------|---------|
| `README.md` | Full docs & API reference |
| `DEVELOPMENT.md` | Dev guide & setup |
| `API_EXAMPLES.md` | Code examples |
| `QUICK_REFERENCE.md` | This file |

## 🎯 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` (in edit) | Save cell |
| `Escape` | Cancel edit |
| Click cell | Select & edit |

## 📞 Support

- Check console (F12) for errors
- Review API logs in terminal
- See error status message in left sidebar
- Check network tab for failed requests

---

**Last Updated**: Dec 9, 2025
