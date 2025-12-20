# Credential System Deployment & Implementation Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Key Management Setup](#key-management-setup)
4. [Application Configuration](#application-configuration)
5. [Deployment Checklist](#deployment-checklist)
6. [Verification & Testing](#verification--testing)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Disaster Recovery](#disaster-recovery)
9. [Migration from Environment Variables](#migration-from-environment-variables)

---

## Prerequisites

### Required Technologies

- PostgreSQL 14+ (for Row Level Security)
- Node.js 18+
- TypeScript 5+
- Express.js 4+
- AWS Secrets Manager or HashiCorp Vault (for key storage)

### Required Dependencies

```bash
npm install crypto crypto-js
npm install pg pg-pool  # PostgreSQL
npm install express
npm install @types/express --save-dev
npm install jsonwebtoken  # For JWT verification
npm install pino pino-pretty  # Logging
```

### Infrastructure Requirements

- HTTPS/TLS 1.3 enabled on all endpoints
- Database encryption enabled (EBS encryption or equivalent)
- Regular automated backups
- Private VPC for database
- WAF for API protection

---

## Database Setup

### Step 1: Create Database

```bash
# Connect to PostgreSQL as admin
psql -h localhost -U postgres

# Create database
CREATE DATABASE kpi_db;

# Create user with limited privileges
CREATE USER kpi_app WITH PASSWORD 'strong-random-password';
GRANT CONNECT ON DATABASE kpi_db TO kpi_app;
```

### Step 2: Run Migrations

```bash
# Copy migration file
cp migrations/credential-system.sql /tmp/

# Execute migrations
psql -h localhost -U postgres -d kpi_db -f /tmp/credential-system.sql

# Grant privileges to app user
psql -h localhost -U postgres -d kpi_db << EOF
GRANT USAGE ON SCHEMA public TO kpi_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kpi_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kpi_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO kpi_app;
EOF
```

### Step 3: Enable Row Level Security

Verify RLS is enabled:

```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('api_credentials', 'service_configs', 'sheet_mappings', 'sync_jobs', 'credential_audit_log')
AND schemaname = 'public';
```

All should show `rowsecurity = TRUE`.

### Step 4: Verify Database Connection

```typescript
// Test connection
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: true, // MUST be true for production
});

const result = await pool.query('SELECT NOW()');
console.log('Database connected:', result.rows[0]);
```

---

## Key Management Setup

### Option 1: AWS Secrets Manager (Recommended)

```bash
# Create secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name kpi/master-key-v1 \
  --secret-string "$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" \
  --description "Master encryption key for KPI credentials"

# Get secret
aws secretsmanager get-secret-value \
  --secret-id kpi/master-key-v1
```

### Option 2: HashiCorp Vault

```bash
# Vault setup
vault kv put secret/kpi/master-key \
  key="$(openssl rand -base64 32)"

# Enable audit logging
vault audit enable file file_path=/vault/logs/audit.log
```

### Option 3: Local Development Only

```bash
# Generate a development key (DO NOT USE IN PRODUCTION)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Output: 2K3f9NmL4pq7Rw8Xy0Zab1Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv/Wx=
```

### Application Code: Initialize Master Key

```typescript
import AWS from 'aws-sdk';
import { getEncryptionService } from './services/encryption.service';

async function initializeMasterKey() {
  const secretsManager = new AWS.SecretsManager({
    region: process.env.AWS_REGION,
  });

  try {
    // Get master key from Secrets Manager
    const secret = await secretsManager
      .getSecretValue({ SecretId: 'kpi/master-key-v1' })
      .promise();

    const keyMaterial = Buffer.from(secret.SecretString!, 'base64');

    // Initialize encryption service
    const encryptionService = getEncryptionService();
    await encryptionService.initializeMasterKey(1, keyMaterial);

    console.log('Master key initialized');
  } catch (error) {
    console.error('Failed to initialize master key:', error);
    process.exit(1);
  }
}

// Call on application startup
initializeMasterKey();
```

---

## Application Configuration

### Step 1: Environment Variables

Create `.env.production`:

```env
# Application
NODE_ENV=production
PORT=3000
API_URL=https://api.example.com

# Database
DATABASE_URL=postgresql://kpi_app:password@db.example.com:5432/kpi_db?sslmode=require
DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=kpi_db
DB_USER=kpi_app
DB_PASSWORD=<secure-password>

# Key Management
AWS_REGION=us-east-1
MASTER_KEY_ID=kpi/master-key-v1
MASTER_KEY_BACKUP=<base64-encrypted-backup-key>

# Clerk Authentication
CLERK_API_KEY=<clerk-api-key>
CLERK_JWT_KEY=<clerk-jwt-key>

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
RATE_LIMIT_WINDOW=60000  # 1 minute
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://dashboard.example.com

# Monitoring
SENTRY_DSN=<sentry-dsn>
NEW_RELIC_LICENSE_KEY=<new-relic-key>
```

**Important**: Use a secrets management tool (AWS Secrets Manager, Vault, or similar) in production.

### Step 2: TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Step 3: Express App Setup

```typescript
// src/server/index.ts

import express from 'express';
import { CredentialController } from './credential.controller';
import { CredentialRepository } from '../services/credential.repository';
import { CredentialService } from '../services/credential.service';
import { AuditService } from '../services/audit.service';
import { getEncryptionService } from '../services/encryption.service';
import { DatabasePool } from '../lib/database';
import { Logger } from '../lib/logger';

const app = express();
const logger = new Logger('App');

// Middleware
app.use(express.json({ limit: '1mb' })); // Limit payload
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Security middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Health check (before authentication)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize services
const db = new DatabasePool();
const auditService = new AuditService(db);
const credentialRepo = new CredentialRepository(db, auditService);
const credentialService = new CredentialService(credentialRepo);

// Setup routes
const credentialController = new CredentialController(
  credentialRepo,
  credentialService,
  auditService
);
app.use('/api', credentialController.getRouter());

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({
    error: 'Internal server error',
    error_code: 'INTERNAL_ERROR',
    request_id: req.id || 'unknown',
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Security audit completed
- [ ] Database migrations tested on staging
- [ ] Environment variables configured
- [ ] Master key stored in secrets manager
- [ ] SSL/TLS certificates installed
- [ ] WAF rules configured
- [ ] Rate limiting configured
- [ ] Logging aggregation setup (CloudWatch, DataDog, etc.)
- [ ] Monitoring/alerting configured (PagerDuty, Sentry, etc.)

### Deployment Steps

1. **Build Application**
   ```bash
   npm run build
   npm run test
   ```

2. **Deploy to Staging**
   ```bash
   npm run deploy:staging
   npm run test:integration
   npm run test:security
   ```

3. **Database Migration (if schema changed)**
   ```bash
   npm run migrate:up
   ```

4. **Deploy to Production**
   ```bash
   npm run deploy:production
   ```

5. **Verify Deployment**
   ```bash
   curl https://api.example.com/health
   curl https://api.example.com/api/v1/credentials \
     -H "Authorization: Bearer <test-token>"
   ```

6. **Monitor for Issues**
   ```bash
   # Check logs
   tail -f /var/log/kpi/app.log
   
   # Monitor error rate
   # Check dashboards in CloudWatch/DataDog
   ```

### Post-Deployment

- [ ] Verify all endpoints responding
- [ ] Check error rate is normal
- [ ] Verify encryption is working (test creation)
- [ ] Audit logs being recorded
- [ ] No credential data in logs
- [ ] Communicate deployment to team

---

## Verification & Testing

### Unit Tests

```typescript
// src/__tests__/encryption.service.test.ts

import { getEncryptionService, generateTestMasterKey } from '../services/encryption.service';

describe('EncryptionService', () => {
  let service = getEncryptionService();

  beforeAll(async () => {
    const keyMaterial = generateTestMasterKey();
    await service.initializeMasterKey(1, keyMaterial);
  });

  it('should encrypt and decrypt credentials', async () => {
    const credential = {
      _credentialType: 'google_sheets' as const,
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'key-id',
      private_key: 'key-material',
      client_email: 'test@test.iam.gserviceaccount.com',
      client_id: 'client-id',
      auth_uri: 'https://auth.uri',
      token_uri: 'https://token.uri',
    };

    // Encrypt
    const encrypted = await service.encryptCredential(
      credential,
      1,
      'google_sheets',
      'test-cred'
    );

    expect(encrypted.encryptedData).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    // Decrypt
    const decrypted = await service.decryptCredential(
      encrypted.encryptedData,
      encrypted.iv,
      encrypted.authTag,
      encrypted.keyVersion,
      1,
      'google_sheets',
      'test-cred'
    );

    expect(decrypted).toEqual(credential);
  });

  it('should reject tampered data', async () => {
    const credential = { /* ... */ };
    const encrypted = await service.encryptCredential(
      credential,
      1,
      'google_sheets',
      'test-cred'
    );

    // Tamper with ciphertext
    encrypted.encryptedData[0] ^= 0xFF;

    // Should fail decryption
    await expect(
      service.decryptCredential(
        encrypted.encryptedData,
        encrypted.iv,
        encrypted.authTag,
        encrypted.keyVersion,
        1,
        'google_sheets',
        'test-cred'
      )
    ).rejects.toThrow();
  });
});
```

### Integration Tests

```bash
# Test entire flow
npm run test:integration

# Test with real database
npm run test:db

# Test with real encryption
npm run test:encryption
```

### Security Testing

```bash
# SQL injection testing
npm run test:security:sql-injection

# XSS testing
npm run test:security:xss

# Credential leakage testing
npm run test:security:credential-leakage

# OWASP Top 10
npm run test:security:owasp
```

---

## Monitoring & Maintenance

### Key Metrics to Monitor

```typescript
// src/lib/metrics.ts

interface CredentialMetrics {
  credentialCreateCount: number; // Per hour
  credentialVerifySuccessRate: number; // %
  decryptionFailureRate: number; // %
  auditLogWriteFailureRate: number; // %
  averageDecryptionTime: number; // ms
  uniqueUsersPerHour: number;
}
```

### Alerts to Configure

| Alert | Threshold | Action |
|-------|-----------|--------|
| Decryption failure rate | > 1% | Investigate, check logs |
| Key unavailable | Any | Critical, immediate response |
| Audit log write failure | > 0% | Critical, pause operations |
| API error rate | > 5% | Page on-call engineer |
| High failure rate per user | > 10/hour | Check for brute force, block if needed |
| Database connection pool exhausted | Any | Scale database, investigate leaks |

### Scheduled Maintenance

```bash
# Daily
- Verify master key accessibility
- Check decryption error rate
- Check audit log volume

# Weekly
- Review suspicious activity logs
- Check for unused credentials
- Verify backup integrity

# Monthly
- Archive old audit logs (> 1 year)
- Review and update security policies
- Key rotation check
- Performance analysis

# Quarterly
- Security audit
- Penetration testing
- Disaster recovery drill
```

---

## Disaster Recovery

### Backup Strategy

```bash
#!/bin/bash
# backup-credentials.sh

# Daily encrypted backup of database
BACKUP_FILE="/backups/kpi_db_$(date +%Y%m%d_%H%M%S).sql.gz"

pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Encrypt backup with backup key (different from master key)
openssl enc -aes-256-cbc -in "$BACKUP_FILE" -out "$BACKUP_FILE.enc"

# Upload to S3
aws s3 cp "$BACKUP_FILE.enc" s3://kpi-backups/

# Delete local copy
rm "$BACKUP_FILE" "$BACKUP_FILE.enc"

# Verify retention (keep 30 days)
aws s3 ls s3://kpi-backups/ | awk '{print $4}' | while read file; do
  DATE=$(echo "$file" | grep -oP '\d{8}')
  if [[ $(date -d "$DATE" +%s) -lt $(date -d "30 days ago" +%s) ]]; then
    aws s3 rm "s3://kpi-backups/$file"
  fi
done
```

### Recovery Process

1. **Database Failure**
   ```bash
   # Restore from most recent backup
   aws s3 cp s3://kpi-backups/kpi_db_latest.sql.gz.enc ./
   openssl enc -d -aes-256-cbc -in kpi_db_latest.sql.gz.enc | gunzip | psql -d kpi_db
   ```

2. **Master Key Loss**
   - Use backup key stored in secure location
   - Re-encrypt all credentials with new key (background job)
   - Retire old key version after all re-encrypted

3. **Database Corruption**
   - Restore from clean backup
   - Verify all credentials still decrypt
   - Test with verification endpoint

---

## Migration from Environment Variables

### Step 1: Create Migration Script

```typescript
// src/migration/migrate-env-credentials.ts

import { CredentialRepository } from '../services/credential.repository';
import { Logger } from '../lib/logger';

async function migrateEnvCredentials() {
  const logger = new Logger('Migration');

  // For each user
  for (const user of users) {
    // For each service they have env var credentials
    if (process.env.GOOGLE_SHEETS_CREDS) {
      const credential = JSON.parse(process.env.GOOGLE_SHEETS_CREDS);
      
      await credentialRepo.createCredential(
        { userId: user.id, ... },
        'google_sheets',
        'Migrated from environment',
        credential
      );
      
      logger.info('Credential migrated', { userId: user.id, service: 'google_sheets' });
    }
  }

  logger.info('Migration complete');
}
```

### Step 2: Run Migration

```bash
# On staging first
npm run migrate:staging

# Verify all credentials migrated
npm run verify:migration

# Then on production
npm run migrate:production
```

### Step 3: Disable Environment Variables

```bash
# Remove env var credentials
unset GOOGLE_SHEETS_CREDS
unset META_CREDS
unset GA4_CREDS
unset SHOPIFY_CREDS

# Verify application still works
npm run test:integration
```

---

## Troubleshooting

### Issue: "Master key not initialized"

```
Solution:
1. Check AWS Secrets Manager has the key
2. Verify IAM role has permissions
3. Check log for getSecretValue errors
4. Restart application
```

### Issue: Decryption failures

```
Solution:
1. Check key version matches in database
2. Verify IV is 16 bytes
3. Check auth tag is valid
4. Ensure AAD (user_id, service, name) matches encryption
5. Check for database corruption
```

### Issue: Audit logs not being written

```
Solution:
1. Check database connection
2. Verify table permissions
3. Monitor for database locks
4. Check disk space
```

### Issue: High error rate after deployment

```
Solution:
1. Check logs for specific errors
2. Verify database migrations ran
3. Verify encryption service initialized
4. Check for key rotation issues
5. Rollback if needed
```

---

## Security Checklist

- [ ] Database encrypted at rest (EBS encryption)
- [ ] Database encrypted in transit (SSL/TLS)
- [ ] Application uses HTTPS/TLS 1.3
- [ ] Master key in external secrets manager
- [ ] Master key never in logs or version control
- [ ] Row Level Security enabled in PostgreSQL
- [ ] No credentials logged anywhere
- [ ] Audit logs immutable and preserved
- [ ] Rate limiting configured
- [ ] WAF protecting API
- [ ] CORS properly configured
- [ ] CSRF protection enabled
- [ ] API keys rotated regularly
- [ ] Database credentials use IAM where possible
- [ ] Regular security audits scheduled
- [ ] Incident response plan documented

---

This completes the deployment guide. For questions or issues, contact the security team.
