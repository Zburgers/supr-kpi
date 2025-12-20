# Credential Backend System - Setup & Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 12+
- Clerk account with public key
- Environment configured

### Installation Steps

#### 1. Install Required Dependencies

The following packages are needed (check package.json):

```bash
npm install pg jsonwebtoken
npm install --save-dev @types/pg
```

If not already installed, verify in package.json:
```json
{
  "dependencies": {
    "pg": "^8.8.0 or higher",
    "jsonwebtoken": "^9.0.0 or higher",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/pg": "^8.8.0 or higher",
    "@types/node": "^20.0.0"
  }
}
```

#### 2. Setup PostgreSQL Database

```bash
# Create database
createdb kpi_etl

# Run migration (this creates all tables and RLS policies)
psql kpi_etl < migrations/credential-system-v2.sql

# Verify tables created
psql kpi_etl -c "\\dt"
```

Output should show:
```
          List of relations
 Schema |      Name       | Type  | Owner
--------+-----------------+-------+----------
 public | audit_logs      | table | postgres
 public | credentials     | table | postgres
 public | service_configs | table | postgres
 public | sheet_mappings  | table | postgres
 public | users           | table | postgres
```

#### 3. Configure Environment Variables

Create `.env` file:

```bash
# Copy template
cp .env.example .env

# Edit and set required variables
nano .env
```

Required settings:
```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kpi_etl
DB_USER=postgres
DB_PASSWORD=postgres

# Authentication (from Clerk dashboard)
CLERK_PUBLIC_KEY=pk_test_YOUR_KEY_HERE

# Encryption (generate random salt)
ENCRYPTION_KEY_SALT=$(openssl rand -base64 32)

# Other services
REDIS_URL=redis://localhost:6379
PORT=3001
```

#### 4. Build TypeScript

```bash
npm run build

# Check for errors
npm run type-check
```

#### 5. Start Server

```bash
# Development with watch
npm run dev

# Production
npm start
```

Expected output:
```
============================================================
🚀 KPI ETL Pipeline - Starting Server
============================================================

Database connection established
Database schema initialized
Queue initialized
Worker started

============================================================
✅ Server running at http://localhost:3001
📊 Open http://localhost:3001 in browser
============================================================

📡 API Endpoints:
   Credentials: POST /api/credentials/save
   Credentials: GET  /api/credentials/list
   Services:    GET  /api/services
   ...
```

## Docker Setup

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build
COPY . .
RUN npm run build

# Expose port
EXPOSE 3001

# Start
CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kpi_etl
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  app:
    build: .
    depends_on:
      - postgres
      - redis
    environment:
      DB_HOST: postgres
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_NAME: kpi_etl
      REDIS_URL: redis://redis:6379
      CLERK_PUBLIC_KEY: ${CLERK_PUBLIC_KEY}
      ENCRYPTION_KEY_SALT: ${ENCRYPTION_KEY_SALT}
    ports:
      - "3001:3001"

volumes:
  postgres_data:
```

Deploy with:
```bash
docker-compose up -d
```

## Testing the API

### 1. Get Clerk JWT Token

From your Clerk dashboard or client app:
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6Ik5Ub3pSRlJEUmpWRVJtRT...
```

### 2. Test Health Endpoint

```bash
curl http://localhost:3001/api/health
```

### 3. Test Credential Save

```bash
# Prepare credential JSON
cat > credential.json << 'EOF'
{
  "type": "service_account",
  "project_id": "my-project",
  "private_key_id": "key123",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIB...",
  "client_email": "service@my-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
EOF

# Save credential
curl -X POST http://localhost:3001/api/credentials/save \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "credentialJson": "$(cat credential.json | jq -c .)",
  "credentialName": "My Google Service Account",
  "service": "google_sheets"
}
EOF
```

### 4. List Credentials

```bash
curl http://localhost:3001/api/credentials/list \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 5. Enable Service

```bash
curl -X POST http://localhost:3001/api/services/google_sheets/enable \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credentialId": 1}'
```

### 6. List Services

```bash
curl http://localhost:3001/api/services \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Database Maintenance

### View Credentials Table

```bash
psql kpi_etl -c "SELECT id, user_id, service, name, verified, created_at FROM credentials ORDER BY created_at DESC LIMIT 10;"
```

### View Audit Logs

```bash
psql kpi_etl -c "SELECT user_id, action, service, status, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20;"
```

### Reset RLS Context (if needed)

```bash
psql kpi_etl -c "SELECT set_user_context(1);"
```

### Delete Old Soft-Deleted Credentials

```bash
psql kpi_etl << 'EOF'
-- View soft-deleted
SELECT id, name, deleted_at FROM credentials WHERE deleted_at IS NOT NULL;

-- Hard delete if older than 90 days
DELETE FROM credentials WHERE deleted_at < NOW() - INTERVAL '90 days';
EOF
```

## Troubleshooting

### Connection Error: ECONNREFUSED

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check PostgreSQL is running
systemctl status postgresql

# Or start it
systemctl start postgresql

# Verify connection
psql -U postgres -d kpi_etl -c "SELECT NOW();"
```

### Authentication Error: MISSING_TOKEN

```json
{"error": "Missing authorization token", "code": "MISSING_TOKEN"}
```

**Solution:** Add header to request:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3001/api/credentials/list
```

### Authentication Error: INVALID_TOKEN

```json
{"error": "Authentication failed", "code": "AUTH_FAILED"}
```

**Solution:**
1. Verify CLERK_PUBLIC_KEY is correct in .env
2. Verify JWT token is valid (not expired)
3. Token must be RS256 signed by Clerk

### Database Error: Column "credentials.deleted_at" does not exist

**Solution:** Run migration again:
```bash
psql kpi_etl < migrations/credential-system-v2.sql
```

### Encryption Error: Failed to decrypt credential

**Solution:**
1. Verify user_id matches (credentials are user-specific)
2. Verify ENCRYPTION_KEY_SALT hasn't changed
3. Check encrypted_data is not corrupted in database

### RLS Error: new row violates row-level security policy

**Solution:** Ensure app.current_user_id is set:
```typescript
// In executeQuery helper - this is handled automatically
await client.query('SET app.current_user_id = $1', [userId]);
```

## Performance Tuning

### Connection Pool Settings

In `.env`:
```
DB_POOL_SIZE=20  # Increase for high concurrency
```

In src/lib/database.ts:
```typescript
idleTimeoutMillis: 30000,  // Reduce if idle connections are a problem
connectionTimeoutMillis: 2000,  // Increase if connection timeouts occur
```

### Index Optimization

View index usage:
```bash
psql kpi_etl << 'EOF'
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('credentials', 'audit_logs', 'service_configs', 'sheet_mappings');
EOF
```

Analyze query plans:
```bash
psql kpi_etl << 'EOF'
EXPLAIN ANALYZE SELECT * FROM credentials WHERE user_id = 1 AND service = 'google_sheets';
EOF
```

### Audit Log Retention

Archive old logs:
```bash
psql kpi_etl << 'EOF'
-- Archive to separate table monthly
CREATE TABLE audit_logs_archive_2024_12 AS 
SELECT * FROM audit_logs 
WHERE created_at < '2024-12-01' AND created_at >= '2024-11-01';

DELETE FROM audit_logs 
WHERE created_at < '2024-12-01' AND created_at >= '2024-11-01';

CREATE INDEX idx_archive_2024_12_user_id ON audit_logs_archive_2024_12(user_id);
EOF
```

## Backup & Recovery

### Backup Database

```bash
# Full backup
pg_dump kpi_etl > kpi_etl_backup.sql

# Compressed backup
pg_dump kpi_etl | gzip > kpi_etl_backup.sql.gz

# With credentials table only
pg_dump kpi_etl --table=credentials > kpi_etl_credentials_backup.sql
```

### Restore Database

```bash
# From SQL file
psql kpi_etl < kpi_etl_backup.sql

# From compressed file
gunzip -c kpi_etl_backup.sql.gz | psql kpi_etl
```

### Backup Encryption Keys

**IMPORTANT**: Store ENCRYPTION_KEY_SALT securely!

```bash
# Encrypt .env file
gpg --symmetric .env

# Decrypt when needed
gpg --decrypt .env.gpg > .env
```

## Monitoring

### Application Logs

```bash
# View logs from stdout
tail -f logs/app.log

# Filter by level
grep "ERROR" logs/app.log
```

### Database Monitoring

```bash
# Monitor active connections
watch -n 1 'psql kpi_etl -c "SELECT count(*) FROM pg_stat_activity;"'

# Monitor table sizes
psql kpi_etl << 'EOF'
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::regclass)) 
FROM pg_tables 
WHERE tablename NOT LIKE 'pg_%' 
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
EOF
```

### Audit Logging

View recent operations:
```bash
psql kpi_etl << 'EOF'
SELECT user_id, action, service, status, error_message, created_at 
FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 50;
EOF
```

## Security Best Practices

### Environment Variables

```bash
# Never commit .env to git
echo ".env" >> .gitignore

# Use strong ENCRYPTION_KEY_SALT
ENCRYPTION_KEY_SALT=$(openssl rand -base64 32)

# Rotate periodically
# Note: Old credentials won't decrypt, so plan migration
```

### Database Access

```bash
# Restrict PostgreSQL to local only
# Edit postgresql.conf
listen_addresses = 'localhost'

# Use SSL in production
# Generate certificates and enable in postgresql.conf
ssl = on
```

### JWT Token Rotation

Clerk automatically rotates signing keys. Monitor /api/health for issues.

### Credential Access

Always decrypt credentials only when needed:
```typescript
// ❌ Wrong - decrypt and store
const decrypted = decryptCredential(...);
req.decrypted = decrypted;

// ✅ Right - decrypt only in verification handler
if (needsVerification) {
  const decrypted = decryptCredential(...);
  // Use and discard
}
```

## Deployment Checklist

- [ ] PostgreSQL database created and migrated
- [ ] CLERK_PUBLIC_KEY configured
- [ ] ENCRYPTION_KEY_SALT configured (unique, random)
- [ ] DATABASE credentials set and tested
- [ ] Redis connection verified
- [ ] Environment set to 'production'
- [ ] HTTPS enabled (in reverse proxy)
- [ ] Rate limiting configured appropriately
- [ ] Monitoring/logging setup
- [ ] Backup strategy in place
- [ ] Disaster recovery tested
- [ ] Security audit completed

## Support & Documentation

- [API Documentation](./CREDENTIAL_BACKEND_IMPLEMENTATION.md)
- [Database Schema](./migrations/credential-system-v2.sql)
- [Type Definitions](./src/types/api.ts)
- [Error Handling](./src/types/api.ts#L134)
