
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

--
This section represents the ga4 service API.

ga4.service.ts:

POST /api/ga4/sync


--
This section represents shared types used across the application.

etl.ts - has all interfaces 

config interfaces
api response interfaces
utility types
Look at Jobs interfaces here - when implementing sync