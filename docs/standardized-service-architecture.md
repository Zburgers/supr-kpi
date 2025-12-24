# Standardized Service Architecture Documentation

## Overview

This document describes the standardized architecture pattern used across all data integration services in the KPI ETL Pipeline. This pattern ensures consistency, maintainability, and scalability across Meta, GA4, Shopify, and any future services.

## Core Architecture Pattern

All services follow the same architectural pattern:

### 1. Service Structure
```
services/
├── [service-name].service.ts     # Main service with credential management
├── routes/
│   └── [service-name].ts         # API routes with authentication
```

### 2. Credential Management Pattern
All services now use stored encrypted credentials instead of passing raw credentials:

- Credentials are stored in the database and encrypted at rest
- Services fetch and decrypt credentials at runtime using user context
- Authentication is handled via JWT middleware
- All queries are filtered by `user_id` for Row-Level Security (RLS)

### 3. UUID-Based ID Generation
All services now use UUIDs instead of numeric IDs for better efficiency and uniqueness:

- Uses `uuidv4()` for generating unique identifiers
- Consistent across Meta, GA4, and Shopify services
- Prevents conflicts and ensures global uniqueness

## Service Components

### A. Main Service ([service-name].service.ts)

#### Required Imports
```typescript
import { v4 as uuidv4 } from 'uuid';
import { sheetsService } from './sheets.js';
import { executeQuery } from '../lib/database.js';
import { decryptCredential } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
```

#### Core Interface
```typescript
export interface [ServiceName]MetricsRow {
  id?: string;  // UUID string
  date: string;
  // ... other metrics
}
```

#### Main Workflow Method
```typescript
async runWorkflow(
  credentialId: number,
  userId: number,
  options?: [ServiceName]RunOptions
): Promise<{
  metrics: [ServiceName]MetricsRow;
  appendResult: AppendResult;
  spreadsheetId: string;
  sheetName: string;
}>
```

#### Upsert Method
- Handles both "update existing" and "append new" operations
- Uses date-based matching to find existing records
- Preserves existing UUIDs when updating
- Generates new UUIDs for new records

### B. API Routes ([service-name].ts)

#### Authentication
- All endpoints require JWT authentication
- User context is validated via middleware
- Credential access is filtered by user_id

#### Standard Endpoints
- `POST /api/[service]/sync` - Main sync endpoint using stored credentials
- Accepts `credentialId` parameter to identify which credentials to use
- Supports optional `spreadsheetId` and `sheetName` overrides

## Implementation Steps for New Services

### 1. Create Service File
1. Create `services/[service-name].service.ts`
2. Implement credential fetching and decryption
3. Implement data fetching from external API
4. Implement parsing and normalization
5. Implement upsert logic with UUID generation
6. Implement main workflow orchestration

### 2. Create Routes File
1. Create `routes/[service-name].ts`
2. Add authentication middleware
3. Implement sync endpoint
4. Handle credentialId parameter
5. Return consistent response format

### 3. Update Main Application
1. Import new routes in `server/app.ts`
2. Register routes with authentication
3. Use consistent naming pattern

### 4. Update Frontend
1. Update API client in `dashboard/src/lib/api.ts`
2. Update hooks to pass credentialId
3. Update UI components to use new endpoints

## Security Considerations

### Credential Security
- All credentials stored encrypted in database
- Decryption happens only at runtime
- Credentials never exposed to client
- Row-Level Security prevents cross-user access

### Authentication
- JWT-based authentication for all endpoints
- User context validated for every request
- Credential access limited to owning user

### Data Validation
- Input validation on all parameters
- Service-specific credential format validation
- Proper error handling without sensitive information exposure

## Error Handling

All services follow consistent error handling:

- Use structured logging with context
- Return user-friendly error messages
- Log sensitive details only server-side
- Handle API rate limits and failures gracefully

## Migration Path

### From Legacy to New Pattern
1. Create new service with credential management
2. Update API routes to use stored credentials
3. Update frontend to pass credentialId
4. Add deprecation warnings to legacy services
5. Maintain backward compatibility during transition

## Example Services

The pattern is implemented in:
- `services/ga4.service.ts` - Google Analytics 4
- `services/shopify.service.ts` - Shopify
- `services/meta.service.ts` - Meta Ads

Each follows the exact same pattern with service-specific API calls and metrics.

## Testing Considerations

- Mock credential storage and retrieval
- Test authentication flow
- Validate UUID generation and persistence
- Test upsert logic with both new and existing data
- Verify error handling paths