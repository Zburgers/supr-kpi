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
- `POST /api/meta/fetch` - Fetch Meta insights
- `POST /api/shopify/fetch` - Fetch Shopify metrics
- `POST /api/google/fetch` - Fetch GA4 metrics

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

## Security Notes

- Never commit service account files to version control
- Use environment variables for sensitive configuration
- Implement proper access controls with Clerk
- Monitor audit logs for security events
- Regularly rotate credentials and tokens