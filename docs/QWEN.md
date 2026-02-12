# Google Sheets KPI Data Manager

## Project Overview

The Google Sheets KPI Data Manager is a full-stack TypeScript web application designed for managing Google Sheets data with a focus on KPI tracking. It serves as a universal ETL pipeline for daily KPI metrics from multiple data sources including Meta Ads, Google Analytics 4 (GA4), and Shopify, consolidating them into Google Sheets.

The application provides a comprehensive solution for:
- Google Sheets integration with service account authentication
- Data loading, editing, and management with virtual scrolling
- ETL pipeline for pulling data from Meta, GA4, and Shopify
- Credential management with encryption
- Automated daily data synchronization
- User authentication via Clerk

## Architecture

The application follows a modern full-stack architecture with:

- **Frontend**: Lightweight SPA with virtual scrolling, in-place editing, and responsive design
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Row-Level Security (RLS) for multi-tenant support
- **Job Queue**: BullMQ with Redis for background processing
- **Authentication**: Clerk for user management
- **Containerization**: Docker with multi-stage builds

## Standardized Service Architecture

The application now implements a standardized service architecture pattern across all data integration services (Meta, GA4, Shopify):

### Core Architecture Pattern
All services follow the same architectural pattern:

#### 1. Service Structure
```
services/
├── [service-name].service.ts     # Main service with credential management
├── routes/
│   └── [service-name].ts         # API routes with authentication
```

#### 2. Credential Management Pattern
All services now use stored encrypted credentials instead of passing raw credentials:
- Credentials are stored in the database and encrypted at rest
- Services fetch and decrypt credentials at runtime using user context
- Authentication is handled via JWT middleware
- All queries are filtered by `user_id` for Row-Level Security (RLS)

#### 3. UUID-Based ID Generation
All services now use UUIDs instead of numeric IDs for better efficiency and uniqueness:
- Uses `uuidv4()` for generating unique identifiers
- Consistent across Meta, GA4, and Shopify services
- Prevents conflicts and ensures global uniqueness

### Implementation Components

#### A. Main Service ([service-name].service.ts)
- Implements credential fetching and decryption
- Handles data fetching from external API
- Implements parsing and normalization
- Implements upsert logic with UUID generation
- Implements main workflow orchestration

#### B. API Routes ([service-name].ts)
- All endpoints require JWT authentication
- User context is validated via middleware
- Credential access is filtered by user_id
- Standardized sync endpoints using stored credentials

### Security Considerations
- All credentials stored encrypted in database
- Decryption happens only at runtime
- Credentials never exposed to client
- Row-Level Security prevents cross-user access

## Key Features

### Core Functionality
- Google Sheets integration via service account authentication
- Virtual scrolling for efficient large dataset handling
- In-place cell editing with visual feedback
- Sheet selection from dropdown or manual entry
- Bulk operations and data validation
- Lazy loading and performance optimization

### Data Sources
- **Meta Ads**: Fetch ad performance metrics using user-stored credentials
- **Google Analytics 4**: Pull GA4 data with OAuth or service account using user-stored credentials
- **Shopify**: Retrieve e-commerce metrics via GraphQL API using user-stored credentials
- **Google Sheets**: Primary data destination with user-specific service accounts

### Security Features
- AES-256-GCM encryption for stored credentials with per-user key derivation
- Row-Level Security (RLS) in PostgreSQL for multi-tenant data isolation
- JWT authentication via Clerk for user management
- Secure credential verification without exposing sensitive data
- User-specific credential management with encrypted storage

### Automation
- Cron-based scheduler for daily data sync
- Manual trigger capability for on-demand sync
- Retry mechanisms and error handling
- Comprehensive audit logging

## Building and Running

### Prerequisites
- Node.js (>=18.0.0)
- PostgreSQL
- Redis
- Docker (for containerized deployment)

### Development Setup
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server with auto-reload
npm run dev
```

### Production Setup
```bash
# Build for production
npm run build

# Start production server
npm start

# Or use Docker
npm run docker:build
npm run docker:up
```

### Environment Variables
The application requires several environment variables for different services:

- **Database**: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- **Clerk**: `CLERK_SECRET_KEY`, `CLERK_PUBLIC_KEY`
- **Encryption**: `MASTER_ENCRYPTION_KEY`

**Note**: Service-specific credentials (Meta, GA4, Shopify, Google Sheets) are no longer stored as environment variables for multi-tenancy support. Instead, they are securely managed through the credential management system where each user can store encrypted credentials for their own accounts.

## API Endpoints

### Core API
- `GET /api/health` - Health check
- `GET /api/init` - Initialize sheets service
- `GET /api/spreadsheets` - List accessible spreadsheets
- `GET /api/sheets/:spreadsheetId` - Get sheet names in a spreadsheet
- `GET /api/data/:spreadsheetId/:sheetName` - Read data from sheet
- `POST /api/data/:spreadsheetId/:sheetName` - Write data to sheet
- `PUT /api/range/:spreadsheetId` - Update specific range
- `POST /api/append/:spreadsheetId/:sheetName` - Append row to sheet

### Data Source APIs
- `POST /api/meta/fetch` - Legacy Meta insights (deprecated)
- `POST /api/meta/sync` - Fetch Meta insights using stored credentials
- `POST /api/shopify/fetch` - Legacy Shopify metrics (deprecated)
- `POST /api/shopify/sync` - Fetch Shopify metrics using stored credentials
- `POST /api/google/fetch` - Fetch GA4 metrics
- `POST /api/ga4/sync` - Fetch GA4 metrics using stored credentials

### Credential Management
- `POST /api/credentials/save` - Save encrypted credential
- `GET /api/credentials/list` - List user credentials
- `GET /api/credentials/:credentialId` - Get specific credential
- `PUT /api/credentials/:credentialId` - Update credential
- `DELETE /api/credentials/:credentialId` - Delete credential
- `POST /api/credentials/:credentialId/verify` - Verify credential
- `GET /api/credentials/:credentialId/verify-status` - Get verification status

### Scheduler APIs
- `GET /api/v1/scheduler/status` - Get scheduler status
- `POST /api/v1/scheduler/start` - Start scheduler
- `POST /api/v1/scheduler/stop` - Stop scheduler
- `POST /api/v1/scheduler/trigger` - Manually trigger sync
- `POST /api/v1/sync/all` - Sync all platforms

### Sync Operations (Modern - Using Stored Credentials)
- `POST /api/meta/sync` - Sync Meta data using stored credentials
- `POST /api/ga4/sync` - Sync GA4 data using stored credentials
- `POST /api/shopify/sync` - Sync Shopify data using stored credentials

## Development Conventions

### Code Style
- TypeScript with strict mode enabled
- ES2020 target for compatibility
- ESLint and Prettier for consistent formatting
- Type safety enforced throughout

### Security Practices
- All credentials encrypted before storage
- RLS policies prevent cross-user data access
- Input validation on all endpoints
- JWT authentication required for protected routes

### Testing
- Jest for unit testing
- Integration tests for API endpoints
- Mock services for external dependencies

## Database Schema

The application uses PostgreSQL with the following key tables:

- `users`: Stores Clerk user IDs and account information
- `credentials`: Encrypted service credentials with RLS
- `service_configs`: Maps services to credentials per user
- `sheet_mappings`: Maps services to Google Sheets locations
- `audit_logs`: Comprehensive audit trail with RLS

## Deployment

The application is designed for containerized deployment with Docker Compose and supports multi-tenant architecture:

- PostgreSQL with persistent volumes and Row-Level Security
- Redis for job queue and caching
- Application with health checks
- Environment-based configuration for system-wide settings
- Per-user credential management with encrypted storage
- Resource limits and security settings

## Troubleshooting

Common issues and solutions:
- Authentication failures: Ensure proper credentials are stored via the credential management API
- CORS errors: Check server configuration
- Scheduler not running: Check environment variables and timezone settings
- Credential verification failures: Validate token formats and permissions

**Note**: The old method of placing service account files in the project root (n8nworkflows-*.json) is deprecated. All credentials should now be managed through the credential management system.

## Git Best Practices

### Branching Strategy for Major Refactors
When implementing major architectural changes or refactors, always follow this workflow:

1. **Create a feature branch** from main:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Implement changes** on the feature branch with frequent commits:
   ```bash
   git add .
   git commit -m "feat: your descriptive commit message"
   ```

3. **Test thoroughly** before merging to main

4. **Open a pull request** from your feature branch to main for review

5. **Merge to main** only after successful testing and review

### Why This Approach?
- **Prevents breaking production**: Avoid direct commits to main for major changes
- **Enables code review**: Other team members can review changes before merging
- **Facilitates rollback**: If issues arise, it's easier to revert changes from a branch
- **Maintains stability**: Main branch stays stable and deployable

### Example Workflow for Major Refactors:
```bash
# Create and switch to a new branch for major changes
git checkout -b feature/standardized-service-architecture

# Implement changes with regular commits
git add .
git commit -m "feat: create new meta service with credential management"
git add .
git commit -m "feat: update frontend to use new endpoints"

# Test changes thoroughly

# Push branch to remote
git push origin feature/standardized-service-architecture

# Open pull request in GitHub

# After review and approval, merge via pull request
```

**Important**: Never commit directly to main for major architectural changes that could potentially break the system. Always use feature branches for safety.

## Security Notes

- Never commit service account files to version control
- Use environment variables for sensitive configuration
- Implement proper access controls with Clerk
- Monitor audit logs for security events
- Regularly rotate credentials and tokens