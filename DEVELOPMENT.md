# Development Setup Guide

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org))
- npm (comes with Node.js)
- Service account JSON file (provided)

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server (with auto-reload)
npm run dev
```

The application will start at `http://localhost:3000`

## Project Structure Overview

### Backend (`src/`)

- **`server/index.ts`**: Express server & REST API routes
  - Port: 3000
  - Routes: `/api/*`
  - CORS enabled for development

- **`services/sheets.ts`**: Google Sheets API wrapper
  - Handles authentication
  - CRUD operations on sheets
  - Error handling

- **`types/kpi.ts`**: TypeScript interfaces
  - `DailyMetrics`: KPI data structure
  - `ApiResponse`: Standard response format
  - `SheetMetadata`: Sheet information

### Frontend (`public/`)

- **`index.html`**: Main page template
  - Three-panel layout (sidebar + table + editor)
  - Modal dialogs for confirmation

- **`app.js`**: Main application logic
  - State management
  - Event handling
  - API integration

- **`utils.js`**: Helper functions
  - API wrapper
  - DOM utilities
  - Data formatting

- **`styles.css`**: Minimal, clean styling
  - CSS Grid layout
  - Custom properties (variables)
  - Responsive design

## API Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/init` | Initialize service |
| GET | `/api/spreadsheets` | List all sheets |
| GET | `/api/sheets/:id` | Get sheet names |
| GET | `/api/data/:id/:sheet` | Read sheet data |
| POST | `/api/data/:id/:sheet` | Write sheet data |
| PUT | `/api/range/:id` | Update range |
| POST | `/api/append/:id/:sheet` | Append row |

## Common Tasks

### Add a New API Endpoint

1. **Add to `src/server/index.ts`**:
   ```typescript
   app.get('/api/new-endpoint', async (req, res) => {
     try {
       const data = await sheetsService.someMethod();
       res.json({ success: true, data });
     } catch (error) {
       res.status(500).json({ success: false, error: error.message });
     }
   });
   ```

2. **Use from frontend** (`public/app.js`):
   ```javascript
   const result = await apiCall('/new-endpoint');
   ```

### Modify Data Types

Edit `src/types/kpi.ts` and update references in:
- `src/server/index.ts`
- `public/app.js` (type handling)

### Style Changes

Edit `public/styles.css`:
- CSS variables defined in `:root`
- Mobile breakpoint at `@media (max-width: 768px)`
- Dark mode possible (define alternate colors)

## Debugging

### Backend

```bash
# Enable detailed logging
NODE_DEBUG=* npm start

# Check compiled output
cat dist/server/index.js
```

### Frontend

1. Open DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for API calls
4. Use debugger breakpoints

### Google Sheets Issues

1. Verify service account email has access to sheet
2. Check sheet name spelling (case-sensitive)
3. Verify column headers match expected data
4. Use manual Sheet ID input instead of dropdown

## Performance Optimization

### Current Optimizations

- **Virtual Scrolling**: Load 20 rows initially, add more on scroll
- **Debounced Scroll**: Scroll listener debounced to 100ms
- **Lazy Loading**: Data loaded on demand
- **Minimal Dependencies**: Only essential packages

### Future Improvements

- Client-side caching (IndexedDB)
- Data compression for large sheets
- Web Workers for heavy processing
- Service Worker for offline support

## Deployment

### To Production

1. **Set environment**:
   ```bash
   NODE_ENV=production
   ```

2. **Optimize build**:
   ```bash
   npm run build
   ```

3. **Start server**:
   ```bash
   npm start
   ```

4. **Use a process manager** (PM2, Systemd, etc.):
   ```bash
   pm2 start dist/server/index.js --name "sheets-manager"
   ```

### Security Checklist

- [ ] Service account not in git/repository
- [ ] Use environment variables for sensitive data
- [ ] Enable HTTPS in production
- [ ] Set up rate limiting
- [ ] Add input validation
- [ ] Enable logging/monitoring
- [ ] Regular dependency updates

## Troubleshooting Development

### Port already in use

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### TypeScript errors

```bash
# Check types without building
npm run type-check

# Rebuild
npm run build
```

### Dependency issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

1. Test with your Google Sheets
2. Customize column headers if needed
3. Add additional calculations/tabs
4. Set up deployment pipeline
5. Configure monitoring/logging

---

For API details, see [README.md](./README.md)

For architecture decisions, see inline code comments.
