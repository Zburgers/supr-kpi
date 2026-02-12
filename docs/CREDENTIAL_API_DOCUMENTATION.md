# Credential Management API Documentation

## Overview

This document describes the REST API for managing encrypted API credentials in the KPI ETL system.

**Base URL**: `https://api.example.com/api/v1`

**Authentication**: All endpoints require Bearer token authentication (Clerk JWT)

---

## Authentication

All API requests must include an `Authorization` header with a valid JWT token:

```
Authorization: Bearer <clerk_jwt_token>
```

### Error: Unauthorized (401)
```json
{
  "error": "Unauthorized",
  "error_code": "AUTH_001",
  "request_id": "req_123456"
}
```

---

## Request/Response Format

All requests and responses use JSON with Content-Type: `application/json`.

### Error Response Format
```json
{
  "error": "Human-readable error message",
  "error_code": "ERROR_CODE",
  "request_id": "req_<timestamp>_<random>"
}
```

Error codes:
- `AUTH_001`: Unauthorized/invalid token
- `CRED_001`: Missing required fields
- `CRED_002`: Invalid credential format
- `CRED_003`: Invalid pagination parameters
- `CRED_004`: Invalid credential ID
- `CRED_005`: Credential not found
- `CRED_006`: Access denied
- `CRED_007`: Duplicate credential
- `USER_001`: User account not active

---

## Endpoints

### 1. Create Credential

Create and encrypt a new API credential.

```
POST /credentials
```

#### Request

```json
{
  "service_type": "google_sheets",
  "credential_name": "Primary Google Account",
  "credential_data": {
    "type": "service_account",
    "project_id": "my-project-123",
    "private_key_id": "key-id-123",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "client_email": "service@my-project.iam.gserviceaccount.com",
    "client_id": "123456789",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token"
  },
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_type` | string | Yes | One of: `google_sheets`, `meta`, `ga4`, `shopify` |
| `credential_name` | string | Yes | User-friendly name (unique per user per service) |
| `credential_data` | object | Yes | Service-specific credential format |
| `expires_at` | string (ISO 8601) | No | Optional expiration date |

#### Response (201 Created)

```json
{
  "id": "cred_1a2b3c4d5e6f7g8h",
  "user_id": 123,
  "service_type": "google_sheets",
  "credential_name": "Primary Google Account",
  "version": 1,
  "is_active": true,
  "verification_status": "pending",
  "created_at": "2025-12-20T10:30:00Z",
  "updated_at": "2025-12-20T10:30:00Z"
}
```

#### Errors

- `400`: Invalid credential format
  ```json
  {
    "error": "Invalid credential format",
    "error_code": "CRED_002",
    "request_id": "req_..."
  }
  ```

- `409`: Duplicate credential name
  ```json
  {
    "error": "Credential with this name already exists for this service",
    "error_code": "CRED_007",
    "request_id": "req_..."
  }
  ```

---

### 2. List Credentials

Retrieve all credentials for the authenticated user (without decryption).

```
GET /credentials
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `service_type` | string | - | Filter by service type |
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 10 | Results per page (max 100) |

#### Examples

```
GET /credentials
GET /credentials?service_type=google_sheets
GET /credentials?page=2&limit=20
```

#### Response (200 OK)

```json
{
  "credentials": [
    {
      "id": "cred_1a2b3c4d5e6f7g8h",
      "user_id": 123,
      "service_type": "google_sheets",
      "credential_name": "Primary Google Account",
      "version": 1,
      "is_active": true,
      "verification_status": "valid",
      "last_verified_at": "2025-12-20T09:15:00Z",
      "created_at": "2025-12-20T10:30:00Z",
      "updated_at": "2025-12-20T10:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

### 3. Get Credential Metadata

Retrieve metadata for a specific credential (without decryption).

```
GET /credentials/:credentialId
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `credentialId` | string | Yes | Credential ID |

#### Response (200 OK)

```json
{
  "id": "cred_1a2b3c4d5e6f7g8h",
  "user_id": 123,
  "service_type": "google_sheets",
  "credential_name": "Primary Google Account",
  "version": 1,
  "is_active": true,
  "verification_status": "valid",
  "last_verified_at": "2025-12-20T09:15:00Z",
  "expires_at": null,
  "created_at": "2025-12-20T10:30:00Z",
  "updated_at": "2025-12-20T10:30:00Z"
}
```

#### Errors

- `404`: Credential not found
  ```json
  {
    "error": "Credential not found or access denied",
    "error_code": "CRED_005",
    "request_id": "req_..."
  }
  ```

---

### 4. Update Credential

Update credential name, data, or expiration.

```
PUT /credentials/:credentialId
```

#### Request

```json
{
  "credential_name": "Updated Google Account",
  "credential_data": {
    "type": "service_account",
    ...
  },
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**All fields are optional. Only provided fields are updated.**

#### Response (200 OK)

```json
{
  "id": "cred_1a2b3c4d5e6f7g8h",
  "user_id": 123,
  "service_type": "google_sheets",
  "credential_name": "Updated Google Account",
  "version": 2,
  "is_active": true,
  "verification_status": "valid",
  "last_verified_at": "2025-12-20T09:15:00Z",
  "created_at": "2025-12-20T10:30:00Z",
  "updated_at": "2025-12-20T11:00:00Z"
}
```

**Note**: Version is incremented when credential data is updated (for rotation tracking).

---

### 5. Delete Credential

Soft-delete a credential (disables it but preserves audit history).

```
DELETE /credentials/:credentialId
```

#### Response (204 No Content)

No response body.

**Note**: Credential is marked inactive but audit logs are preserved indefinitely for compliance.

---

### 6. Verify Credential

Test connection to external service using the credential.

```
POST /credentials/:credentialId/verify
```

#### Response (200 OK)

**Success:**
```json
{
  "credential_id": "cred_1a2b3c4d5e6f7g8h",
  "is_valid": true,
  "verification_status": "valid",
  "last_verified_at": "2025-12-20T11:15:00Z",
  "message": "Successfully verified google_sheets credential"
}
```

**Failure (still returns 200 for privacy):**
```json
{
  "credential_id": "cred_1a2b3c4d5e6f7g8h",
  "is_valid": false,
  "verification_status": "invalid",
  "last_verified_at": "2025-12-20T11:15:00Z",
  "message": "Credential verification failed"
}
```

**Note**: Always returns `200 OK` to avoid leaking information about credential validity.

---

## Credential Data Formats

### Google Sheets (Service Account)

```json
{
  "type": "service_account",
  "project_id": "my-project-123",
  "private_key_id": "key-id-123",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "service@my-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

**Required fields:** All of the above

**Source:** Download from Google Cloud Console → Service Accounts → Create Key (JSON)

### Meta Ads (OAuth 2.0)

```json
{
  "access_token": "EAAB...",
  "token_type": "bearer",
  "expires_in": 5184000,
  "refresh_token": "...",
  "account_id": "123456789"
}
```

**Required fields:** `access_token`, `account_id`

**Optional fields:** `token_type`, `expires_in`, `refresh_token`

### Google Analytics 4 (OAuth 2.0)

```json
{
  "client_id": "123456789.apps.googleusercontent.com",
  "client_secret": "secret-...",
  "refresh_token": "1//...",
  "property_id": "123456789"
}
```

**Required fields:** All of the above

### Shopify (API Access Token)

```json
{
  "shop_url": "mystore.myshopify.com",
  "access_token": "shpat_...",
  "api_version": "2024-01"
}
```

**Required fields:** All of the above

---

## Security Considerations

### What Happens to Your Credentials

1. **Transmission**: Sent via HTTPS/TLS 1.3
2. **Storage**: Encrypted with AES-256-GCM before storage
3. **Retrieval**: Only decrypted in memory when needed, never in logs or responses
4. **Access Control**: Only you can access your credentials (verified by JWT)
5. **Audit**: All access attempts logged and immutable

### Best Practices

✅ **DO:**
- Use service accounts for Google Sheets (not personal credentials)
- Rotate credentials every 90 days
- Use unique credential names for easy management
- Monitor the credential list regularly for unexpected entries
- Delete unused credentials

❌ **DON'T:**
- Share your JWT tokens
- Use personal OAuth tokens
- Store credentials in version control
- Share credential API responses with others
- Use the same credentials across multiple services

---

## Rate Limiting

The API implements rate limiting:

- **Authentication endpoints**: 10 requests/minute
- **Credential endpoints**: 100 requests/minute per user
- **Verification endpoint**: 5 requests/minute per credential

Rate limit headers included in response:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640341200
```

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `CRED_002: Invalid credential format` | Missing required fields or wrong format | Check credential format against documentation |
| `CRED_005: Credential not found` | Wrong credential ID or credential was deleted | List credentials to find correct ID |
| `CRED_006: Access denied` | User account suspended or deleted | Contact support |
| `CRED_007: Duplicate credential` | Credential name already exists for this service | Use unique names or update existing |
| `AUTH_001: Unauthorized` | Invalid or expired JWT | Re-authenticate with Clerk |

### What We Don't Disclose

For security reasons, error messages don't reveal:
- Whether a credential exists
- The actual decryption failure reason
- Which field is invalid (generic "invalid format" instead)
- User IDs or service details

---

## Pagination

List endpoints support pagination with the following parameters:

```
GET /credentials?page=2&limit=20
```

**Response includes:**
```json
{
  "credentials": [...],
  "total": 50,
  "page": 2,
  "limit": 20
}
```

**Constraints:**
- `page`: 1 to N (1-indexed)
- `limit`: 1 to 100

---

## Examples

### Example 1: Add Google Sheets Credential

```bash
curl -X POST https://api.example.com/api/v1/credentials \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "service_type": "google_sheets",
    "credential_name": "Marketing Sheet",
    "credential_data": {
      "type": "service_account",
      ...
    }
  }'
```

### Example 2: List All Meta Credentials

```bash
curl https://api.example.com/api/v1/credentials?service_type=meta \
  -H "Authorization: Bearer <jwt_token>"
```

### Example 3: Verify a Credential

```bash
curl -X POST https://api.example.com/api/v1/credentials/cred_123/verify \
  -H "Authorization: Bearer <jwt_token>"
```

---

## Webhook Events (Future)

The API will support webhooks for credential events:

- `credential.created`
- `credential.updated`
- `credential.deleted`
- `credential.verified`
- `credential.expired`

Configuration coming in v2 API.
