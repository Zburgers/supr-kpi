# Architecture & Design

Technical documentation of the application architecture.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Frontend)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  HTML (index.html)                                   │   │
│  │  ├─ Left Sidebar: Sheet Selection                    │   │
│  │  ├─ Center: Data Table (Virtual Scrolling)          │   │
│  │  └─ Right Sidebar: Cell Editor                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  JavaScript (app.js + utils.js)                     │   │
│  │  ├─ State Management (appState object)              │   │
│  │  ├─ Event Handlers                                  │   │
│  │  ├─ API Wrapper (apiCall function)                  │   │
│  │  └─ UI Rendering                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  CSS (styles.css)                                   │   │
│  │  ├─ Grid Layout                                     │   │
│  │  ├─ Component Styles                                │   │
│  │  └─ Responsive Design                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓↑
                        HTTP/JSON
                            ↓↑
┌─────────────────────────────────────────────────────────────┐
│                  Server (Backend)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express.js (server/index.ts)                       │   │
│  │  ├─ Routes: /api/*                                  │   │
│  │  ├─ CORS Middleware                                 │   │
│  │  ├─ JSON Parser                                     │   │
│  │  └─ Static File Serving                             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SheetsService (services/sheets.ts)                 │   │
│  │  ├─ Authentication (JWT)                            │   │
│  │  ├─ Spreadsheet Operations                          │   │
│  │  ├─ Sheet CRUD                                      │   │
│  │  └─ Range Updates                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Types (types/kpi.ts)                               │   │
│  │  ├─ DailyMetrics                                    │   │
│  │  ├─ ApiResponse                                     │   │
│  │  └─ Sheet Metadata                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓↑
                    Service Account
                            ↓↑
┌─────────────────────────────────────────────────────────────┐
│            Google APIs                                       │
│  ├─ Sheets API v4 (Read/Write spreadsheet data)            │
│  ├─ Drive API v3 (List accessible files)                   │
│  └─ OAuth2 (Service account authentication)                │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow

### 1. Application Initialization

```
Page Load
    ↓
DOMContentLoaded event
    ↓
initApp() function
    ↓
apiCall('/api/init')
    ↓
SheetsService.initialize()
    ↓
Load & Parse JWT credentials
    ↓
Setup Sheets & Drive APIs
    ↓
loadSpreadsheets()
    ↓
Populate sheet dropdown
```

### 2. Loading Data

```
User selects spreadsheet
    ↓
loadSheetNames() called
    ↓
GET /api/sheets/:spreadsheetId
    ↓
SheetsService.getSheetNames()
    ↓
Get sheet metadata from Sheets API
    ↓
Return array of sheet objects
    ↓
Populate sheet dropdown

User selects sheet & clicks "Load Data"
    ↓
loadData() called
    ↓
GET /api/data/:spreadsheetId/:sheetName
    ↓
SheetsService.readSheet()
    ↓
Get values from Sheets API (A1:Z1000)
    ↓
Parse headers and data rows
    ↓
Convert to array of objects
    ↓
Store in appState.data
    ↓
renderTable() - Display in UI
    ↓
setupEventListeners() - Enable cell editing
```

### 3. Editing and Saving

```
User clicks cell
    ↓
selectCell() called
    ↓
Display editor form in right sidebar
    ↓
User enters new value & clicks Save
    ↓
saveCell() called
    ↓
Update appState.data
    ↓
Mark cell as edited (yellow highlight)
    ↓
Show local confirmation message

User clicks "Save All Changes"
    ↓
saveToSheet() called
    ↓
showConfirmDialog() - Ask for confirmation
    ↓
POST /api/data/:spreadsheetId/:sheetName
    ↓
SheetsService.writeSheet()
    ↓
Send 2D array to Sheets API
    ↓
Overwrite sheet values
    ↓
Clear editedCells map
    ↓
Show success message
```

## 🔄 State Management

### `appState` Object

```javascript
const appState = {
  spreadsheetId: null,        // Current spreadsheet ID
  sheetName: null,            // Current sheet name
  data: [],                   // Array of data rows (objects)
  headers: [],                // Array of column headers
  originalData: [],           // Backup of original data
  editedCells: new Map(),     // Track which cells changed
  currentCell: null           // Currently selected cell
};
```

### State Lifecycle

1. **Initialize**: Empty on page load
2. **Load Sheet**: User loads data → populate all arrays
3. **Edit Cell**: User edits → update data & editedCells
4. **Save All**: User saves → reset originalData & editedCells
5. **Cancel**: User cancels → revert to originalData

## 🔐 Authentication Flow

```
Application Start
    ↓
Read n8nworkflows-471200-2d198eaf6e2a.json
    ↓
Extract credentials:
  - client_email
  - private_key
  - scopes
    ↓
Create JWT (JSON Web Token)
    ↓
Exchange JWT for access token via OAuth2
    ↓
Access token added to all API requests
    ↓
Use Google APIs with service account
```

**Scopes Required**:
- `https://www.googleapis.com/auth/spreadsheets` - Read/write sheets
- `https://www.googleapis.com/auth/drive.readonly` - List files

## 🎨 Component Architecture

### Frontend Components

#### 1. **Header**
- Brand & title
- Non-interactive

#### 2. **Left Sidebar (Control Panel)**
- Spreadsheet dropdown
- Sheet dropdown
- Manual URL input
- Action buttons (Load, Refresh)
- Status messages
- Info display

#### 3. **Center (Data Table)**
- Sticky header
- Virtual scrolling
- Clickable cells
- Visual feedback (hover, selected, edited)
- Lazy-load on scroll

#### 4. **Right Sidebar (Editor)**
- Cell reference display
- Text input
- Save/Cancel buttons
- Add row section

#### 5. **Modals**
- Confirmation dialog
- Loading spinner

### UI State Patterns

```javascript
// Show/Hide elements
element.style.display = "none|block|flex"

// Add/Remove classes
element.classList.add("selected")
element.classList.remove("selected")

// Update content
element.textContent = value
element.innerHTML = htmlString

// Data attributes for tracking
td.dataset.rowIndex = 5
td.dataset.colIndex = 3
```

## 📈 Performance Optimizations

### 1. Virtual Scrolling
- Load 20 rows initially
- Add 10 more on scroll near bottom
- Memory efficient for large datasets

**Implementation**:
```javascript
// Render initial batch
appState.data.slice(0, 20).forEach(row => renderRow(row))

// Listen to scroll events
container.addEventListener('scroll', debounce(handleScroll, 100))

// Load more when needed
if (scrollPercentage > 0.8) {
  loadMoreRows()
}
```

### 2. Debouncing
- Scroll listener debounced to 100ms
- Prevents excessive function calls
- Improves responsiveness

### 3. Lazy DOM Updates
- Only render visible rows
- Update on demand
- Minimal DOM manipulation

### 4. Efficient Styling
- CSS Grid for layout
- CSS variables for theming
- No heavy JavaScript animations

## 🔌 API Design Principles

### RESTful Structure

```
Resources:
  /api/spreadsheets      - Spreadsheet collection
  /api/sheets/:id        - Sheets in spreadsheet
  /api/data/:id/:name    - Sheet data
  /api/range/:id         - Range of cells

Methods:
  GET    - Retrieve data
  POST   - Create or write data
  PUT    - Update data
```

### Response Format

All responses follow standard format:

```json
{
  "success": boolean,
  "data": T | null,
  "error": string | null,
  "message": string | null
}
```

### Error Handling

```typescript
try {
  const result = await apiCall(endpoint);
  // Process result
} catch (error) {
  showStatus(`Error: ${error.message}`, "error");
  console.error(error);
}
```

## 🧪 Testing Strategy

### Unit Testing (Future)
- Service methods
- Utility functions
- Type validation

### Integration Testing (Future)
- API endpoints with mock sheets
- Full workflow scenarios
- Error cases

### Manual Testing Checklist
- [ ] Load spreadsheet from dropdown
- [ ] Load spreadsheet from URL
- [ ] Edit single cell
- [ ] Edit multiple cells
- [ ] Save changes
- [ ] Cancel dialog
- [ ] Confirm dialog
- [ ] Scroll and load more rows
- [ ] Check error messages

## 🚀 Scalability Considerations

### Current Limits
- Rows: 1000 (API limit, configurable)
- Columns: Z (26 columns, configurable)
- Response size: 50MB (JSON limit, configurable)

### For Larger Datasets
1. **Pagination**: Load data in chunks
2. **Filters**: Add date range filters
3. **Search**: Add row search/filter
4. **Indexing**: Use Google Sheets API filters
5. **Caching**: Cache frequently accessed data

### Optimization Tips
1. Increase virtual scroll batch size for fast data
2. Add IndexedDB for client-side caching
3. Use Web Workers for heavy processing
4. Implement Service Worker for offline support
5. Add database layer for historical data

## 🔄 Deployment Architecture

### Development
```
npm run dev
├─ TypeScript watch mode
├─ Express server on port 3000
├─ Auto-reload on changes
└─ Source maps enabled
```

### Production
```
npm start
├─ Compiled JavaScript
├─ Express server
├─ Environment-based config
├─ No source maps
└─ Process manager (PM2, Systemd, etc.)
```

### Cloud Deployment
```
- Platform: Heroku, Railway, Render, etc.
- Build: npm install && npm run build
- Start: npm start
- Environment: Set PORT and .env vars
- Service Account: Mounted as secret/file
```

## 📋 Design Patterns Used

### 1. **Singleton Pattern**
- `sheetsService` - Single instance throughout app

### 2. **Module Pattern**
- Services, utilities, types in separate modules
- Clean separation of concerns

### 3. **Observer Pattern**
- Event listeners for user interactions
- Reactive UI updates

### 4. **Factory Pattern**
- Creating row objects from headers
- Dynamic object construction

### 5. **Strategy Pattern**
- Different rendering strategies (initial vs. lazy load)
- Flexible data loading

## 🔐 Security Architecture

### Data Protection
- Service account credentials in separate file
- Not exposed in frontend
- API requests validated server-side

### Access Control
- Service account email has specific permissions
- Sheet-level access via Google Drive
- Rate limiting (future)

### Input Validation
- Range validation
- Sheet name sanitization
- Array type checking

---

See also:
- [README.md](./README.md) - User documentation
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development guide
- [API_EXAMPLES.md](./API_EXAMPLES.md) - Code examples
