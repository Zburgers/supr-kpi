This section represents the sheets external API.
source: sheets-external.ts

GET /api/sheets/spreadsheets
// Get spreadsheets using stored credential (if provided) or global service account
// Query parameter: credential_id (optional)

GET /api/sheets/:spreadsheetId/sheets
// Get sheet names within a spreadsheet using stored credential
// Query parameter: credential_id (optional)

--

This section represents the credentials API.

PUT /api/credentials/:credentialId
updates the credential with the specified ID.

DELETE /api/credentials/:credentialId
soft deletes the credential with the specified ID.

POST /api/credentials/:credentialId/verify
checks all services for the given credential ID.

GET /api/credentials/:credentialId/verify-status
retrieves the verification status for the given credential ID.

--

This section represents the sync API.
source: app.ts

POST /api/v1/sync/shopify/direct
POST /api/v1/sync/meta/direct
POST /api/v1/sync/ga4/direct

POST /api/v1/sync/all
// Trigger sync for all sources via queue
// Body: { targetDate?: string }

POST /api/v1/sync/meta
// Trigger Meta sync via queue
// Body: { targetDate?: string, spreadsheetId?: string, sheetName?: string }

POST /api/v1/sync/ga4
// Trigger GA4 sync via queue
// Body: { targetDate?: string, spreadsheetId?: string, sheetName?: string }

POST /api/v1/sync/shopify
// Trigger Shopify sync via queue
// Body: { targetDate?: string, spreadsheetId?: string, sheetName?: string }

--

This section represents the ga4 service API.

ga4.service.ts:

POST /api/ga4/sync
// Fetch GA4 data and append to Google Sheet
// Body: { credentialId: number, options?: { spreadsheetId?: string, sheetName?: string } }

POST /api/ga4/sync/yesterday
// Fetch yesterday's GA4 data and append to Google Sheet
// Body: { credentialId: number, options?: { spreadsheetId?: string, sheetName?: string } }

--

This section represents the meta service API.

meta.service.ts:

POST /api/meta/sync
// Sync Meta data using stored credentials
// Body: { credentialId: number, options?: { spreadsheetId?: string, sheetName?: string } }

--

This section represents the shopify service API.

shopify.service.ts:

POST /api/shopify/sync
// Fetch Shopify data and append to Google Sheet
// Body: { credentialId: number, options?: { spreadsheetId?: string, sheetName?: string } }

POST /api/shopify/sync/yesterday
// Fetch yesterday's Shopify data and append to Google Sheet
// Body: { credentialId: number, options?: { spreadsheetId?: string, sheetName?: string } }

--

This section represents the services API.

services.ts:

POST /api/services/:serviceName/enable
// Enable a service with a specific credential
// Body: { credentialId: string }
// Valid services: google_sheets, meta, ga4, shopify

POST /api/services/:serviceName/disable
// Disable a service

GET /api/services
// List all service configurations for the user

--

This section represents the sheet mappings API.

sheets.ts:

POST /api/sheet-mappings/set
// Set sheet mapping for a service
// Body: { service: string, spreadsheetId: string, sheetName: string }

GET /api/sheet-mappings
// List all sheet mappings for the user

--

This section represents the schedules API.

schedules.ts:

GET /api/schedules
// Get all schedules for services

PUT /api/schedules/:service
// Update schedule for a specific service
// Body: { cron?: string, enabled?: boolean }
// Valid services: meta, ga4, shopify

POST /api/schedules/:service/run
// Manually trigger a sync for a service
// Valid services: meta, ga4, shopify

--

This section represents the activity log API.

activity-log.ts:

GET /api/activity-log
// Get activity log entries with filtering
// Query parameters: service, status, start_date, end_date, limit, offset

--

This section represents the user API.

user.ts:

GET /api/user/status
// Get current user status including onboarding completion

POST /api/user/onboarding/complete
// Mark user onboarding as complete

POST /api/user/onboarding/reset
// Reset user onboarding (for testing/debugging)

--

This section represents the health and queue monitoring API.

app.ts:

GET /api/health
// Health check endpoint

GET /api/v1/queue/stats
// Get queue statistics

GET /api/v1/jobs/:jobId
// Get job status by job ID

--

This section represents shared types used across the application.

etl.ts - has all interfaces 

config interfaces
api response interfaces
utility types
Look at Jobs interfaces here - when implementing sync
