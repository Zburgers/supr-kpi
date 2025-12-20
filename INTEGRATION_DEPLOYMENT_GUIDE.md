# KPI ETL SaaS - Integration & Deployment Guide

**Status**: All components implemented, ready for integration
**Last Updated**: December 20, 2025

---

## **1. WHAT'S BEEN DELIVERED**

### **Backend (Node.js/Express)**
- ✅ Encryption service (AES-256-GCM)
- ✅ JWT middleware for authentication
- ✅ Credential storage API (save, list, update, delete)
- ✅ Credential verification system
- ✅ Service configuration endpoints
- ✅ Sheet mapping endpoints
- ✅ Audit logging system
- ✅ Database schema with RLS
- ✅ PostgreSQL migrations

### **Frontend (React/Vite)**
- ✅ Clerk authentication integration
- ✅ Protected routes
- ✅ Multi-step onboarding wizard
- ✅ Credential entry components
- ✅ Credential verification UI
- ✅ Sheet selector components
- ✅ Settings dashboard with 5 tabs
- ✅ Activity log viewer
- ✅ Schedule configuration UI
- ✅ API hooks (useCredentials, useServices, etc.)

### **Documentation**
- ✅ System architecture plan
- ✅ API endpoint specification
- ✅ Database schema and migrations
- ✅ Clerk integration guide
- ✅ Backend verification checklist
- ✅ Frontend component reference

---

## **2. INTEGRATION CHECKLIST**

### **Phase 1: Database Setup** (1-2 hours)

```bash
# 1. Create PostgreSQL database
# Option A: Local development
docker run --name kpi-postgres \
  -e POSTGRES_DB=kpi_etl \
  -e POSTGRES_USER=kpi_user \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  -d postgres:15-alpine

# Option B: Cloud (Supabase, AWS RDS, etc.)
# Create database and note connection string

# 2. Update environment variables
# Backend (.env file in root)
cat > .env << 'EOF'
DATABASE_URL=postgresql://kpi_user:secure_password@localhost:5432/kpi_etl
CLERK_SECRET_KEY=sk_test_dSeio38cAL0h8AfRW1V3cCVMdcWBSeoL5RJe3aNh47
ENCRYPTION_KEY_SALT=$(openssl rand -hex 32)
NODE_ENV=development
PORT=3001
REDIS_URL=redis://localhost:6379
EOF

# 3. Run migrations
npm run db:migrate

# 4. Verify database
npm run db:verify
```

### **Phase 2: Backend Integration** (3-4 hours)

```bash
# 1. Install new dependencies
npm install pg jsonwebtoken

# 2. Update database.ts with your DATABASE_URL
# File: src/lib/database.ts
# Ensure: connection pooling, error handling

# 3. Register routes in app.ts
# File: src/server/app.ts
import authMiddleware from '../middleware/auth.js';
import credentialsRouter from '../routes/credentials.js';
import servicesRouter from '../routes/services.js';
import sheetsRouter from '../routes/sheets.js';

app.use(authMiddleware);
app.use('/api/credentials', credentialsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/sheets', sheetsRouter);

# 4. Test backend
npm run build
npm run start
# Check: http://localhost:3001/api/health

# 5. Verify routes exist
curl -X POST http://localhost:3001/api/credentials/save \
  -H "Authorization: Bearer DUMMY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' 
# Expected: 401 or 400 (not 404)
```

### **Phase 3: Frontend Integration** (2-3 hours)

```bash
# 1. Update Clerk credentials
# File: dashboard/.env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_Z3Jvd2luZy1wdW1hLTE2LmNsZXJrLmFjY291bnRzLmRldiQ

# 2. Install dependencies
cd dashboard
npm install

# 3. Update API base URL
# File: src/lib/api.ts
const API_BASE = process.env.VITE_API_URL || 'http://localhost:3001'

# 4. Test onboarding page
npm run dev
# Navigate to: http://localhost:5173/onboarding
# Should show: Clerk sign-in (not yet integrated, but route exists)

# 5. Test settings page
# Navigate to: http://localhost:5173/settings
# Should show: Settings dashboard structure
```

### **Phase 4: End-to-End Testing** (2-3 hours)

```bash
# 1. Start both services in separate terminals

# Terminal 1: Backend
cd /home/naki/Desktop/itsthatnewshit/SUPR/KPI
npm run dev

# Terminal 2: Frontend
cd dashboard
npm run dev

# 2. Test sign-up flow
# Go to: http://localhost:5173
# Click "Sign Up" in Clerk modal
# Create test account

# 3. Test onboarding
# After sign-in, go to: http://localhost:5173/onboarding
# Enter dummy Google Service Account JSON:
# {
#   "type": "service_account",
#   "project_id": "test-project",
#   "private_key_id": "key123",
#   "private_key": "-----BEGIN PRIVATE KEY-----...",
#   "client_email": "test@test-project.iam.gserviceaccount.com",
#   "client_id": "123456789",
#   "auth_uri": "https://accounts.google.com/o/oauth2/auth",
#   "token_uri": "https://oauth2.googleapis.com/token",
#   "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
#   "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
# }

# 4. Monitor backend logs
# Should see:
# - [EncryptionService] Credential stored
# - [AuditLog] credential_created action=success
# - No plaintext credentials in logs

# 5. Test credential verification
# Backend should attempt to connect to Google Sheets
# On dummy data: Return 401 (invalid credential)
# Log should show: credential_verified action=failure

# 6. Test settings
# Go to: http://localhost:5173/settings
# See saved credential in credentials tab
# Verify status shows "Not Verified"
```

### **Phase 5: Production Deployment** (2-3 hours)

```bash
# 1. Build both applications
npm run build
cd dashboard && npm run build && cd ..

# 2. Update environment for production
cat > .env.production << 'EOF'
DATABASE_URL=postgresql://[production_db_user]:[password]@[prod_host]:5432/kpi_etl
CLERK_SECRET_KEY=sk_live_[production_key]
ENCRYPTION_KEY_SALT=[production_salt]
NODE_ENV=production
REDIS_URL=redis://[production_redis]:6379
PORT=3001
CORS_ORIGINS=https://[your-domain].com
EOF

# 3. Update Docker image
docker build -t kpi-etl:latest .

# 4. Deploy frontend
# Option A: Vercel
cd dashboard
npm i -g vercel
vercel --prod

# Option B: Your server
# Copy dashboard/dist to web server
# Configure nginx/reverse proxy

# 5. Deploy backend
# Option A: Docker Compose
docker-compose up -d --build

# Option B: Cloud (Heroku, Railway, etc.)
git push heroku main

# 6. Run production migrations
# ssh into server
npm run db:migrate --env production

# 7. Health check
curl https://[your-domain].com/api/health
# Expected: { status: "ok" }

curl https://[your-domain].com/onboarding
# Expected: Onboarding page loads
```

---

## **3. ENVIRONMENT VARIABLES REFERENCE**

### **Backend (.env)**
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/kpi_etl

# Authentication
CLERK_SECRET_KEY=sk_test_...
NODE_ENV=development

# Encryption
ENCRYPTION_KEY_SALT=random-hex-string

# Server
PORT=3001
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGINS=http://localhost:5173,https://your-domain.com

# Scheduler (optional, for automated jobs)
ENABLE_SCHEDULER=false
CRON_SCHEDULE=0 2 * * *
```

### **Frontend (.env.local)**
```bash
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# API
VITE_API_URL=http://localhost:3001
```

### **Docker (.env for docker-compose)**
```bash
# Same as backend, plus Docker specifics
DATABASE_URL=postgresql://kpi_user:password@postgres:5432/kpi_etl
REDIS_URL=redis://redis:6379
NODE_ENV=production
```

---

## **4. DATABASE MIGRATION STRATEGY**

### **From Old System (Env Variables) to New System (PostgreSQL)**

**Old System:**
```bash
# All credentials in env
META_ACCESS_TOKEN=secret_token
GOOGLE_ACCESS_TOKEN=secret_token
SHOPIFY_API_TOKEN=secret_token
```

**New System:**
```bash
# No credentials in env
# All credentials stored encrypted in PostgreSQL
# Per-user isolation
# Verification and audit logging
```

**Migration Steps:**
```bash
# 1. Create new database with schema
npm run db:migrate

# 2. Write migration script (one-time)
# Script: scripts/migrate-env-to-db.ts
# Read old env variables
# Insert as new credentials for "admin" user
# Update service_configs to point to new credentials
# Run: npx ts-node scripts/migrate-env-to-db.ts

# 3. Verify old credentials still work
# Test sync operations with new system

# 4. Remove old env variables
# Delete from docker-compose.yml:
#   - META_ACCESS_TOKEN
#   - GOOGLE_ACCESS_TOKEN
#   - SHOPIFY_API_TOKEN
#   - GOOGLE_SPREADSHEET_ID (per-user now)
#   etc.

# 5. Update worker to use new credential system
# File: src/lib/worker.ts
# Old: const token = process.env.META_ACCESS_TOKEN
# New: const credential = await getCredentialForUser(userId, 'meta')
#      const decrypted = decrypt(credential.encrypted_blob, userId)
#      const token = JSON.parse(decrypted).access_token
```

---

## **5. SERVICE VERIFICATION CHECKLIST**

### **Google Sheets**
```bash
# Test credential format
# File should have:
# - "type": "service_account"
# - "private_key": "-----BEGIN PRIVATE KEY-----..."
# - "client_email": "...@gserviceaccount.com"

# Test connection flow:
# 1. User enters JSON
# 2. Backend encrypts and stores
# 3. User clicks "Test"
# 4. Backend creates Auth client
# 5. Backend lists spreadsheets
# 6. If success: verified_at = NOW()
# 7. Frontend shows list of sheets

# Expected response:
# { verified: true, sheets: [{ id: "...", name: "..." }] }
```

### **Meta Ads**
```bash
# Test credential format
# Should be: Facebook Graph API token
# Can test with: /me endpoint

# Expected response format from verification:
# { verified: true, accountName: "My Ads Account" }
```

### **Google Analytics 4**
```bash
# Test credential format
# Should be: OAuth 2.0 token or Service Account

# Expected response:
# { verified: true, propertyId: "GA4-123456" }
```

### **Shopify**
```bash
# Test credential format
# Should be: Custom App token or OAuth token

# Expected response:
# { verified: true, storeName: "mystore.myshopify.com" }
```

---

## **6. TROUBLESHOOTING**

### **Database Connection Error**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Solution: 
1. Check PostgreSQL is running: docker ps | grep postgres
2. Verify DATABASE_URL is correct
3. Check credentials are correct
```

### **JWT Verification Failed**
```
Error: Invalid JWT token
Solution:
1. Check CLERK_SECRET_KEY is set correctly
2. Verify user is signed in (check Clerk dashboard)
3. Check token is not expired (15 min expiry)
```

### **Encryption Error**
```
Error: Failed to decrypt credential
Solution:
1. Check ENCRYPTION_KEY_SALT matches deployment
2. Verify credential_blob is valid JSON
3. Check user_id matches encryption key derivation
```

### **Credential Verification Fails**
```
Error: Service returned 401 Unauthorized
Solution:
1. Verify credential JSON format is correct
2. Check credential scopes match requirements
3. Try with known-good credential first
4. Check service isn't rate-limiting
```

### **Settings Page Shows No Credentials**
```
Error: List appears empty
Solution:
1. Verify user successfully saved credential (check db)
2. Check auth middleware is working (test with curl)
3. Verify JWT token is valid (check Clerk dashboard)
4. Check RLS policies allow SELECT
```

---

## **7. MONITORING & MAINTENANCE**

### **Health Checks**
```bash
# Backend health
curl http://localhost:3001/api/health

# Frontend page load
curl http://localhost:5173/

# Database connectivity
npm run db:verify

# Credential verification status
curl -X GET http://localhost:3001/api/credentials/list \
  -H "Authorization: Bearer {jwt}"
```

### **Logs to Monitor**
```bash
# Backend logs (Docker)
docker-compose logs -f app

# Frontend errors (Browser console)
# Check for: Failed API calls, auth errors

# Database logs
docker-compose logs -f postgres

# Audit log viewer
# Go to: Settings → Activity Log (in UI)
```

### **Backups**
```bash
# Database backup
docker exec kpi-postgres pg_dump -U kpi_user kpi_etl > backup.sql

# Restore
psql -U kpi_user -d kpi_etl -f backup.sql

# Automated backups (recommended)
# Configure: docker-compose.yml with backup volume
```

### **Scaling Considerations**
```
- Database: Use connection pooling (already in place)
- API: Stateless (can run multiple instances behind load balancer)
- Jobs: BullMQ with Redis (can scale workers)
- Frontend: Serve from CDN
- Encryption keys: Rotate annually, before rotation migrate data
```

---

## **8. NEXT STEPS AFTER DEPLOYMENT**

### **Week 1: Beta Testing**
- [ ] Test with 5-10 internal users
- [ ] Verify all services work (Google, Meta, GA4, Shopify)
- [ ] Load test (simulate 100+ concurrent users)
- [ ] Penetration test for security

### **Week 2: Feature Polish**
- [ ] Improve error messages based on feedback
- [ ] Add more service integrations if needed
- [ ] Implement API rate limiting
- [ ] Add email notifications for sync failures

### **Week 3: Production Hardening**
- [ ] Set up monitoring (DataDog, New Relic, etc.)
- [ ] Configure alerting for errors
- [ ] Implement automated backups
- [ ] Set up log aggregation

### **Week 4: Go-Live**
- [ ] Final security audit
- [ ] Load test at scale
- [ ] Prepare incident response plan
- [ ] Launch to early customers

---

## **9. ROLLBACK PLAN**

If something goes wrong in production:

```bash
# 1. Stop new version
docker-compose down

# 2. Restore database from backup
psql -U kpi_user -d kpi_etl -f backup_before_deployment.sql

# 3. Revert to previous Docker image
docker-compose up -d --force-recreate

# 4. Notify team
# Post message: Status page, email, etc.

# 5. Investigate issue
# Check logs: docker-compose logs
# Test in staging environment first

# 6. Fix and redeploy
# Merge fix to main, rebuild, redeploy
```

---

## **10. SUPPORT & HANDOFF**

### **Documentation for New Team Members**
- [x] System architecture plan
- [x] API endpoint reference
- [x] Database schema
- [x] Onboarding flow diagram
- [x] Troubleshooting guide

### **Code Comments**
- [x] Encryption service (why AES-256-GCM)
- [x] JWT middleware (why verify from Clerk)
- [x] Credential storage (why encrypt at rest)
- [x] RLS policies (why user isolation)

### **Runbooks**
```
Need to create for:
- Adding a new service (Google Sheets → new adapter)
- Scaling to 10k+ users (database optimization)
- Key rotation (encryption key generation and migration)
- Disaster recovery (database restore)
- Performance optimization (query indexing)
```

---

## **QUICK REFERENCE: COMMON COMMANDS**

```bash
# Development
npm run dev                    # Start backend in watch mode
cd dashboard && npm run dev    # Start frontend

# Building
npm run build                  # Build backend
cd dashboard && npm run build  # Build frontend

# Database
npm run db:migrate            # Run migrations
npm run db:verify             # Check connection
npm run db:seed               # Seed test data

# Docker
docker-compose up -d          # Start services
docker-compose down           # Stop services
docker-compose logs -f app    # Watch logs

# Testing
curl http://localhost:3001/api/health              # API health
curl http://localhost:5173                         # Frontend
curl -X GET http://localhost:3001/api/credentials/list \
  -H "Authorization: Bearer {jwt}"                 # API with auth
```

---

**Created by**: System Architecture Team
**Date**: December 20, 2025
**Status**: Ready for Integration Testing
