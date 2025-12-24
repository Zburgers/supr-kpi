# KPI ETL Pipeline API Documentation

This document provides a comprehensive overview of the API endpoints available in the KPI ETL Pipeline, including their entry points, request/response structures, and authentication requirements.

## Table of Contents

1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Structure](#requestresponse-structure)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)

## Authentication

All API endpoints (except health check) require authentication using a JWT token from Clerk. Include the token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## API Endpoints

### Health Check & Initialization

#### GET `/api/health`
- **Description**: Check the health status of the API
- **Authentication**: Not required
- **Response**: Health check response

#### GET `/api/init`
- **Description**: Initialize the sheets service
- **Authentication**: Required
- **Response**: Initialization status

### User & Onboarding

#### GET `/api/user/status`
- **Description**: Get current user status including onboarding completion
- **Authentication**: Required
- **Response**: User status information

#### POST `/api/user/onboarding/complete`
- **Description**: Mark user onboarding as complete
- **Authentication**: Required
- **Response**: Onboarding completion status

#### POST `/api/user/onboarding/reset`
- **Description**: Reset user onboarding (for testing/debugging)
- **Authentication**: Required
- **Response**: Onboarding reset status

### Credential Management

#### POST `/api/credentials/save`
- **Description**: Save a new credential
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "credentialJson": "string",
    "credentialName": "string",
    "service": "google_sheets | meta | ga4 | shopify"
  }
  ```
- **Response**: Credential information

#### GET `/api/credentials/list`
- **Description**: List all credentials for the user
- **Authentication**: Required
- **Response**: Array of credential objects

#### GET `/api/credentials/:credentialId`
- **Description**: Get a specific credential by ID
- **Authentication**: Required
- **Path Parameter**: `credentialId` - The credential ID
- **Response**: Credential information

#### PUT `/api/credentials/:credentialId`
- **Description**: Update a credential
- **Authentication**: Required
- **Path Parameter**: `credentialId` - The credential ID
- **Request Body** (optional):
  ```json
  {
    "credentialJson": "string",
    "credentialName": "string"
  }
  ```
- **Response**: Updated credential information

#### DELETE `/api/credentials/:credentialId`
- **Description**: Delete a credential
- **Authentication**: Required
- **Path Parameter**: `credentialId` - The credential ID
- **Response**: Deletion status

#### POST `/api/credentials/:credentialId/verify`
- **Description**: Verify a credential
- **Authentication**: Required
- **Path Parameter**: `credentialId` - The credential ID
- **Response**: Verification status

#### GET `/api/credentials/:credentialId/verify-status`
- **Description**: Get verification status of a credential
- **Authentication**: Required
- **Path Parameter**: `credentialId` - The credential ID
- **Response**: Verification status information

### Service Configuration

#### POST `/api/services/:serviceName/enable`
- **Description**: Enable a service with a credential
- **Authentication**: Required
- **Path Parameter**: `serviceName` - google_sheets | meta | ga4 | shopify
- **Request Body**:
  ```json
  {
    "credential_id": "string"
  }
  ```
- **Response**: Service configuration information

#### POST `/api/services/:serviceName/disable`
- **Description**: Disable a service
- **Authentication**: Required
- **Path Parameter**: `serviceName` - google_sheets | meta | ga4 | shopify
- **Response**: Service disable status

#### GET `/api/services`
- **Description**: List all services and their configuration status
- **Authentication**: Required
- **Response**: Array of service configuration objects

### Sheet Mappings

#### POST `/api/sheet-mappings/set`
- **Description**: Set a sheet mapping for a service
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "service": "google_sheets | meta | ga4 | shopify",
    "credential_id": "string",
    "spreadsheet_id": "string",
    "sheet_name": "string"
  }
  ```
- **Response**: Sheet mapping information

#### GET `/api/sheet-mappings`
- **Description**: List all sheet mappings for the user
- **Authentication**: Required
- **Response**: Array of sheet mapping objects

### Schedules

#### GET `/api/schedules`
- **Description**: Get all schedules
- **Authentication**: Required
- **Response**: Array of schedule objects

#### PUT `/api/schedules/:service`
- **Description**: Update a schedule for a service
- **Authentication**: Required
- **Path Parameter**: `service` - meta | ga4 | shopify
- **Request Body**:
  ```json
  {
    "cron": "string",
    "enabled": "boolean"
  }
  ```
- **Response**: Updated schedule information

#### POST `/api/schedules/:service/run`
- **Description**: Run a manual sync for a service
- **Authentication**: Required
- **Path Parameter**: `service` - meta | ga4 | shopify
- **Response**: Sync job status

### Activity & Audit Logs

#### GET `/api/activity-log`
- **Description**: Get activity log entries
- **Authentication**: Required
- **Query Parameters**:
  - `service`: Filter by service (meta | ga4 | shopify)
  - `status`: Filter by status (success | failure | partial)
  - `start_date`: Filter by start date (YYYY-MM-DD)
  - `end_date`: Filter by end date (YYYY-MM-DD)
  - `limit`: Number of entries to return (1-100, default 50)
  - `offset`: Number of entries to skip (default 0)
- **Response**: Activity log entries with pagination

### Sync Operations (v1)

#### POST `/api/v1/sync/all`
- **Description**: Trigger sync for all sources via queue
- **Authentication**: Required
- **Request Body** (optional):
  ```json
  {
    "targetDate": "string (YYYY-MM-DD)"
  }
  ```
- **Response**: Sync job status

#### POST `/api/v1/sync/:service`
- **Description**: Trigger sync for a specific service via queue
- **Authentication**: Required
- **Path Parameter**: `service` - meta | ga4 | shopify
- **Request Body** (optional):
  ```json
  {
    "targetDate": "string (YYYY-MM-DD)",
    "spreadsheetId": "string",
    "sheetName": "string"
  }
  ```
- **Response**: Sync job status

#### POST `/api/v1/sync/meta/direct`
- **Description**: Direct Meta sync (bypasses queue - for testing/debugging) - now requires stored credentials
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "accessToken": "string",
    "accountId": "string",
    "targetDate": "string (YYYY-MM-DD, optional)",
    "spreadsheetId": "string (optional)",
    "sheetName": "string (optional)"
  }
  ```
- **Response**: Sync result with status information

#### POST `/api/v1/sync/ga4/direct`
- **Description**: Direct GA4 sync (bypasses queue - for testing/debugging) - now requires stored credentials
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "accessToken": "string",
    "propertyId": "string",
    "targetDate": "string (YYYY-MM-DD, optional)",
    "spreadsheetId": "string (optional)",
    "sheetName": "string (optional)"
  }
  ```
- **Response**: Sync result with status information

#### POST `/api/v1/sync/shopify/direct`
- **Description**: Direct Shopify sync (bypasses queue - for testing/debugging) - now requires stored credentials
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "storeDomain": "string",
    "accessToken": "string",
    "targetDate": "string (YYYY-MM-DD, optional)",
    "spreadsheetId": "string (optional)",
    "sheetName": "string (optional)"
  }
  ```
- **Response**: Sync result with status information

### Job Management

#### GET `/api/v1/jobs/:jobId`
- **Description**: Get status of a specific job
- **Authentication**: Required
- **Path Parameter**: `jobId` - The job ID
- **Response**: Job status information

#### GET `/api/v1/queue/stats`
- **Description**: Get queue statistics
- **Authentication**: Required
- **Response**: Queue statistics

### Google Sheets with Stored Credentials (Recommended)

#### GET `/api/sheets/spreadsheets`
- **Description**: List spreadsheets using stored credentials
- **Authentication**: Required
- **Query Parameter**: `credential_id` - The ID of the stored credential to use (required)
- **Response**: Array of spreadsheet objects

#### GET `/api/sheets/:spreadsheetId/sheets`
- **Description**: Get sheet names for a spreadsheet using stored credentials
- **Authentication**: Required
- **Path Parameter**: `spreadsheetId` - The spreadsheet ID
- **Query Parameter**: `credential_id` - The ID of the stored credential to use (required)
- **Response**: Array of sheet objects

#### GET `/api/sheets/:spreadsheetId/values`
- **Description**: Read raw sheet values using stored credentials
- **Authentication**: Required
- **Path Parameter**: `spreadsheetId` - The spreadsheet ID
- **Query Parameters**:
  - `credential_id` - The ID of the stored credential to use (required)
  - `sheetName` - The sheet name (required)
- **Response**: Raw sheet values

### Legacy Google Sheets (Deprecated)

#### GET `/api/spreadsheets`
- **Description**: List spreadsheets (deprecated - use `/api/sheets/spreadsheets` with credential_id)
- **Authentication**: Required
- **Response**: Array of spreadsheet objects

#### GET `/api/sheets/:spreadsheetId`
- **Description**: Get sheet names for a spreadsheet (deprecated - use `/api/sheets/:spreadsheetId/sheets` with credential_id)
- **Authentication**: Required
- **Path Parameter**: `spreadsheetId` - The spreadsheet ID
- **Response**: Array of sheet objects

#### GET `/api/data/:spreadsheetId/:sheetName`
- **Description**: Read sheet data (deprecated - use `/api/sheets/:spreadsheetId/values` with credential_id)
- **Authentication**: Required
- **Path Parameters**:
  - `spreadsheetId` - The spreadsheet ID
  - `sheetName` - The sheet name
- **Response**: Sheet data

#### GET `/api/data/raw/:spreadsheetId/:sheetName`
- **Description**: Read raw sheet values (deprecated - use `/api/sheets/:spreadsheetId/values` with credential_id)
- **Authentication**: Required
- **Path Parameters**:
  - `spreadsheetId` - The spreadsheet ID
  - `sheetName` - The sheet name
- **Response**: Raw sheet values

## Request/Response Structure

### Common Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": {},
  "error": "string"
}
```

- `success`: Boolean indicating if the request was successful
- `data`: Response data (only present if success is true)
- `error`: Error message (only present if success is false)

### Authentication Headers

All authenticated requests must include:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## Error Handling

The API uses standard HTTP status codes:

- `200`: Success
- `201`: Created (for POST requests)
- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Missing or invalid authentication
- `404`: Not Found - Resource doesn't exist
- `500`: Internal Server Error

## Rate Limiting

The API implements rate limiting to prevent abuse. Standard limits apply per IP address and authenticated user.

## Testing the API

To explore and test the API endpoints interactively, visit the Swagger documentation at:
```
http://localhost:3000/api/docs
```

This provides an interactive interface to test all endpoints with proper authentication.