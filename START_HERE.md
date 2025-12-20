# 🚀 Google Sheets KPI Manager

**Start here!** A production-ready TypeScript web app for managing Google Sheets data with a clean, minimal interface.

## ⚡ 5-Minute Setup

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Start server
npm start

# 4. Open browser
# http://localhost:3000
```

**Done!** Your app is running.

## 📖 Documentation Index

**Start with one of these based on your need:**

### 🎯 I just want to use it
→ **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - 5-minute overview

### 🔍 I need detailed documentation  
→ **[README.md](./README.md)** - Complete guide (API, features, troubleshooting)

### 🛠️ I'm a developer setting this up
→ **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Dev setup, architecture, deployment

### 💡 I want to see code examples
→ **[API_EXAMPLES.md](./API_EXAMPLES.md)** - Curl & JavaScript examples

### 🏗️ I want to understand the architecture
→ **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design, data flow, patterns

### 📦 I want a project overview
→ **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - What you have, file structure, stats

## ✨ What This App Does

Load Google Sheets data → Edit cells inline → Save changes back to sheet

**Perfect for**: KPI tracking, daily metrics, data management

## 🎨 User Interface

Three-panel layout:
- **Left**: Sheet selection & controls
- **Center**: Data table (scrollable, editable)
- **Right**: Cell editor & row operations

## 📊 Features

✅ Load any Google Sheet (via service account)  
✅ Edit cells directly in browser  
✅ Virtual scrolling for large datasets  
✅ Lazy loading for performance  
✅ Confirmation dialogs to prevent accidents  
✅ RESTful API for programmatic access  
✅ Full TypeScript type safety  

## 🔑 Data Format

The app is optimized for `meta_raw_daily` sheet structure:

| Column | Type | Example |
|--------|------|---------|
| date | string | 2025-12-01 |
| spend | number | 150.50 |
| reach | number | 5000 |
| impressions | number | 12500 |
| clicks | number | 450 |
| landing_page_views | number | 380 |
| add_to_cart | number | 25 |
| initiate_checkout | number | 12 |
| purchases | number | 3 |
| revenue | number | 450.00 |

You can adapt this for any columns you need.

## 📁 What's Included

```
KPI/
├── public/                    # Frontend (browser files)
│   ├── index.html            # UI template
│   ├── app.js                # Main logic
│   ├── utils.js              # Helpers
│   └── styles.css            # Styling
├── src/                       # Backend (Node.js)
│   ├── server/index.ts       # Express API
│   ├── services/sheets.ts    # Google Sheets wrapper
│   └── types/kpi.ts          # TypeScript types
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
└── Documentation/
    ├── README.md             # Full documentation
    ├── DEVELOPMENT.md        # Dev guide
    ├── API_EXAMPLES.md       # Code examples
    ├── ARCHITECTURE.md       # Technical design
    ├── QUICK_REFERENCE.md    # Fast lookup
    └── PROJECT_SUMMARY.md    # Project overview
```

## 🔐 Security

The app uses **service account authentication** - no user login needed.

**Your service account file** (`n8nworkflows-471200-2d198eaf6e2a.json`) is in the `.gitignore` and never committed to git.

## 📡 API Endpoints

| Method | Endpoint | What it does |
|--------|----------|-------------|
| GET | `/api/spreadsheets` | List all accessible sheets |
| GET | `/api/sheets/:id` | Get sheet names in spreadsheet |
| GET | `/api/data/:id/:name` | Read sheet data |
| POST | `/api/data/:id/:name` | Write/overwrite sheet data |
| PUT | `/api/range/:id` | Update specific range |
| POST | `/api/append/:id/:name` | Add row to sheet |

See [API_EXAMPLES.md](./API_EXAMPLES.md) for curl & JavaScript examples.

## 🎯 Common Tasks

### Load your Google Sheet

1. Open app at `http://localhost:3000`
2. Click spreadsheet dropdown
3. Select your sheet
4. Click "Load Data"

### Edit data

1. Click any cell
2. Edit value in right panel
3. Click "Save Cell" or press Enter

### Save all changes

1. Click "Save All Changes" button
2. Confirm in dialog
3. ✅ Data saved to Google Sheets

### Use the API

```javascript
// Load data
const response = await fetch('/api/data/SHEET_ID/meta_raw_daily');
const data = await response.json();

// Add row
await fetch('/api/append/SHEET_ID/meta_raw_daily', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ row: [date, spend, reach, ...] })
});
```

## 🛠️ Troubleshooting

**Port 3000 in use?**
```bash
lsof -ti:3000 | xargs kill -9
```

**Service account file missing?**
- Add `n8nworkflows-471200-2d198eaf6e2a.json` to project root

**Blank data loads?**
- Check sheet name spelling (case-sensitive)
- Verify spreadsheet URL or ID is correct

**CORS error?**
- Restart the server: `npm start`

**More help?** See [README.md](./README.md#troubleshooting)

## 💻 Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript (ES2020)
- **Backend**: Express.js, TypeScript
- **APIs**: Google Sheets v4, Google Drive v3
- **Auth**: Service account (JWT/OAuth2)

## 📚 Learn More

- **Quick Overview**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) (5 min read)
- **Complete Guide**: [README.md](./README.md) (20 min read)
- **Code Examples**: [API_EXAMPLES.md](./API_EXAMPLES.md) (15 min read)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md) (20 min read)
- **Development**: [DEVELOPMENT.md](./DEVELOPMENT.md) (15 min read)

## ❓ FAQ

**Q: Can I use this with any Google Sheet?**  
A: Yes! Any sheet you have access to. Just use the dropdown or paste the Sheet ID.

**Q: Do I need a Google account?**  
A: No! Service account handles authentication automatically.

**Q: Can I run this on production?**  
A: Yes! See [DEVELOPMENT.md](./DEVELOPMENT.md) for deployment info.

**Q: How many rows can I load?**  
A: Currently 1000 max (configurable). Virtual scrolling means large sheets still work fast.

**Q: Can I add custom columns?**  
A: Absolutely! The app adapts to any column headers in your sheet.

**Q: Is my data secure?**  
A: Yes. Service account credentials are never sent to browser. All operations go through authenticated backend.

## 🎓 Next Steps

1. **Run the app**: `npm start` → Open `http://localhost:3000`
2. **Try it out**: Load a Google Sheet and edit some data
3. **Read docs**: Pick a documentation file based on your needs
4. **Customize**: Adjust columns, styling, or add new features
5. **Deploy**: Follow instructions in [DEVELOPMENT.md](./DEVELOPMENT.md)

## 📞 Support

**Something not working?**

1. Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) troubleshooting section
2. Check [README.md](./README.md#troubleshooting) detailed troubleshooting
3. Review browser console (F12) for JavaScript errors
4. Check server logs in terminal for API errors
5. See [DEVELOPMENT.md](./DEVELOPMENT.md) for debugging tips

## 📝 Status

✅ Ready to use  
✅ Production-ready  
✅ Fully documented  
✅ Type-safe TypeScript  

**Version**: 1.0.0  
**Last Updated**: December 9, 2025  
**License**: ISC  

---

**Let's go!** → [Quick Setup](./QUICK_REFERENCE.md) or [Full Docs](./README.md)
