# Backend Credential Storage System - Implementation Guide

## Overview

This implementation provides a complete backend credential storage system for the KPI ETL SaaS platform, replacing environment variable-based credential management with secure, encrypted, multi-tenant storage.

## Architecture

### Core Components

```
src/
├── lib/
│   ├── database.ts           # PostgreSQL connection pool & schema
│   ├── encryption.ts         # AES-256-GCM encryption (existing)
│   └── audit-log.ts          # Audit logging service
├── middleware/
│   └── auth.ts               # JWT authentication middleware
├── routes/
│   ├── credentials.ts        # Credential CRUD operations
│   ├── services.ts           # Service configuration
│   └── sheets.ts             # Sheet mapping configuration
├── types/
│   └── api.ts                # API request/response types
└── server/
    └── app.ts                # Express app with routes
```

### Database Schema

The system uses PostgreSQL with Row-Level Security (RLS) for multi-tenant isolation:

- **users** - User records linked to Clerk auth
- **credentials** - Encrypted service credentials (soft deleted)
- **service_configs** - Links users to active credentials per service
- **sheet_mappings** - Maps services to Google Sheets locations
- **audit_logs** - Complete audit trail (no sensitive data logged)

## Security Model

### Encryption

- **Algorithm**: AES-256-GCM with random IV for each credential
- **Key Derivation**: PBKDF2 (100,000 iterations) from user ID + salt
- **Never Encrypted**: Credential JSON is only encrypted/decrypted server-side
- **Never Returned**: Encrypted data never sent to client

### Authentication

- **Token Source**: Clerk JWT from Authorization header
- **Token Verification**: RS256 signature validation using Clerk public key
- **User Context**: Extracted from JWT 'sub' claim
- **Database Sync**: User auto-created if not in database

### Row-Level Security

All tables with RLS policies:
- **Policy Function**: `user_id = current_setting('app.current_user_id')::INTEGER`
- **Enforcement**: Set via `executeQuery()` helper
- **Isolation**: Complete data separation between users

### Audit Logging

All credential operations logged:
- **Never Logged**: Credential data, keys, tokens, sensitive fields
- **Always Logged**: Action, user_id, service, status, timestamp
- **Metadata**: Sanitized before logging (sensitive fields redacted)

## API Endpoints

### Credential Management

#### POST /api/credentials/save
Save a new encrypted credential.

```json
{
  "credentialJson": "{...service account JSON...}",
  "credentialName": "My Google Account",
  "service": "google_sheets"
}
```

Response:
```json
{
  "credentialId": 1,
  "service": "google_sheets",
  "name": "My Google Account",
  "verified": false,
  "createdAt": "2024-12-20T10:00:00Z"
}
```

#### GET /api/credentials/list
List all user's credentials (never returns encrypted data).

Response:
```json
{
  "credentials": [
    {
      "id": 1,
      "service": "google_sheets",
      "name": "My Google Account",
      "verified": true,
      "verifiedAt": "2024-12-20T10:05:00Z",
      "createdAt": "2024-12-20T10:00:00Z",
      "maskedPreview": "use...com"
    }
  ]
}
```

#### GET /api/credentials/{credentialId}
Get credential metadata (not encrypted data).

#### PUT /api/credentials/{credentialId}
Update credential JSON or name.

#### DELETE /api/credentials/{credentialId}
Soft delete credential (sets deleted_at timestamp).

### Credential Verification

#### POST /api/credentials/{credentialId}/verify
Test credential validity and mark as verified.

Response:
```json
{
  "verified": true,
  "message": "Connected as user@gmail.com",
  "connectedAs": "user@gmail.com",
  "expiresAt": "2025-12-20T10:00:00Z"
}
```

#### GET /api/credentials/{credentialId}/verify-status
Get verification status without testing.

### Service Configuration

#### POST /api/services/{serviceName}/enable
Enable a service with a credential.

```json
{
  "credentialId": 1
}
```

#### POST /api/services/{serviceName}/disable
Disable a service.

#### GET /api/services
List all services and their configuration.

```json
{
  "services": [
    {
      "name": "google_sheets",
      "enabled": true,
      "credential": {
        "id": 1,
        "name": "My Google Account",
        "verified": true
      }
    }
  ]
}
```

### Sheet Mappings

#### POST /api/sheet-mappings/set
Set which spreadsheet/sheet a service writes to.

```json
{
  "service": "meta",
  "spreadsheetId": "1abc123...",
  "sheetName": "meta_raw_daily"
}
```

#### GET /api/sheet-mappings
List all sheet mappings.

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "User-friendly error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Status Codes

- **400**: Invalid input (missing fields, invalid JSON, invalid service)
- **401**: Missing/invalid JWT token
- **403**: Access denied (not owner of credential)
- **404**: Credential/service not found
- **409**: Conflict (credential already exists)
- **500**: Server error

### Error Codes

```typescript
enum ErrorCode {
  // 400
  INVALID_JSON = 'INVALID_JSON',
  MISSING_FIELDS = 'MISSING_FIELDS',
  INVALID_SERVICE = 'INVALID_SERVICE',
  INVALID_CREDENTIAL_FORMAT = 'INVALID_CREDENTIAL_FORMAT',
  DUPLICATE_CREDENTIAL = 'DUPLICATE_CREDENTIAL',

  // 401
  MISSING_TOKEN = 'MISSING_TOKEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  AUTH_FAILED = 'AUTH_FAILED',

  // 403
  ACCESS_DENIED = 'ACCESS_DENIED',

  // 404
  CREDENTIAL_NOT_FOUND = 'CREDENTIAL_NOT_FOUND',
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',

  // 500
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
}
```

## Supported Credential Types

### Google Sheets (Service Account)
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----...",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "..."
}
```

### Meta Ads (OAuth 2.0)
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "refresh_token": "...",
  "expires_in": 5183944,
  "account_id": "...",
  "account_name": "..."
}
```

### Google Analytics 4 (OAuth 2.0)
```json
{
  "client_id": "...",
  "client_secret": "...",
  "refresh_token": "...",
  "property_id": "..."
}
```

### Shopify (API Access Token)
```json
{
  "shop_url": "mystore.myshopify.com",
  "access_token": "...",
  "api_version": "2024-01",
  "scope": ["read_products", "write_orders"]
}
```

## Setup Instructions

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb kpi_etl

# Run migration
psql kpi_etl < migrations/credential-system-v2.sql
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kpi_etl
DB_USER=postgres
DB_PASSWORD=postgres

# Authentication
CLERK_PUBLIC_KEY=your_clerk_public_key

# Encryption
ENCRYPTION_KEY_SALT=your-random-salt-CHANGE-THIS
```

### 3. Install Dependencies

```bash
npm install pg jsonwebtoken
```

### 4. Build & Start

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Migration from Legacy System

### Old System (Environment Variables)
```bash
META_ACCESS_TOKEN=xxx
META_AD_ACCOUNT_ID=yyy
GOOGLE_ACCESS_TOKEN=zzz
SHOPIFY_ACCESS_TOKEN=aaa
```

### New System (Encrypted Storage)
1. Create credentials via POST /api/credentials/save
2. Enable services via POST /api/services/{service}/enable
3. Set sheet mappings via POST /api/sheet-mappings/set
4. Remove environment variables from production

### Migration Script Example

```typescript
import { saveCredential, enableService } from './api';

async function migrateFromEnv() {
  // Migrate Meta
  if (process.env.META_ACCESS_TOKEN) {
    const credId = await saveCredential(
      {
        access_token: process.env.META_ACCESS_TOKEN,
        account_id: process.env.META_AD_ACCOUNT_ID,
      },
      'Meta Legacy',
      'meta'
    );
    await enableService('meta', credId);
  }

  // Migrate others similarly...
}
```

## Testing

### Test Credential Save

```bash
curl -X POST http://localhost:3001/api/credentials/save \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialJson": "{\"type\":\"service_account\",...}",
    "credentialName": "Test Credential",
    "service": "google_sheets"
  }'
```

### Test Credential List

```bash
curl http://localhost:3001/api/credentials/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Service Enable

```bash
curl -X POST http://localhost:3001/api/services/google_sheets/enable \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credentialId": 1}'
```

## Security Checklist

- [x] All credentials encrypted with AES-256-GCM
- [x] Row-Level Security on all user data
- [x] JWT validation on all endpoints
- [x] User isolation at database level
- [x] Audit logging of all operations
- [x] No credential data logged
- [x] No encryption keys logged
- [x] Encryption keys derived, not stored
- [x] Soft deletes for credential history
- [x] Environment variables for configuration (not credentials)
- [x] Error messages don't leak system details
- [x] All sensitive operations require authentication

## Performance Considerations

### Connection Pooling
- Default pool size: 20 connections
- Configurable via DB_POOL_SIZE
- Idle timeout: 30 seconds

### Indexing
- Indexes on user_id for all tables
- Indexes on created_at for audit logs
- Indexes on service for quick lookups
- Unique constraints on user_id + service combinations

### Query Optimization
- Prepared statements to prevent SQL injection
- Indexes on common filter columns
- Soft deletes to preserve history

## Troubleshooting

### Database Connection Errors

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Solution: Ensure PostgreSQL is running and connection parameters are correct.

### Authentication Failures

```
Authentication failed - Invalid token
```

Solution: Verify CLERK_PUBLIC_KEY is correctly configured.

### RLS Policy Errors

```
Error: new row violates row-level security policy
```

Solution: Ensure `app.current_user_id` is set before querying.

### Encryption/Decryption Errors

```
Failed to decrypt credential - invalid key or corrupted data
```

Solution: User ID must match the ID used for encryption.

## Future Enhancements

1. **Token Refresh**: Automatic refresh token management for OAuth credentials
2. **Credential Rotation**: Scheduled credential rotation
3. **Backup/Export**: Encrypted credential backup
4. **Webhook Events**: Credentials changed/verified events
5. **Rate Limiting**: Per-user rate limits on verification
6. **Advanced Audit**: Query/filter audit logs via API
7. **Credential Sharing**: Controlled sharing between team members
8. **Expiration Alerts**: Notifications for expiring credentials

## Files Summary

| File | Purpose |
|------|---------|
| src/lib/database.ts | Database initialization, RLS queries |
| src/lib/audit-log.ts | Audit logging with sanitization |
| src/middleware/auth.ts | JWT verification & user context |
| src/routes/credentials.ts | CRUD operations for credentials |
| src/routes/services.ts | Service enable/disable/list |
| src/routes/sheets.ts | Sheet mapping management |
| src/types/api.ts | TypeScript type definitions |
| migrations/credential-system-v2.sql | Database schema migration |
| .env.example | Environment configuration template |

## Support

For issues or questions:
1. Check error logs in src/lib/logger.ts output
2. Review audit logs in database via SELECT from audit_logs
3. Verify database connectivity: psql kpi_etl
4. Confirm JWT token validity
5. Check RLS policies: SELECT * FROM pg_policies
