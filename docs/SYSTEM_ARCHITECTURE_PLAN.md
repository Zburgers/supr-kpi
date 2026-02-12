# KPI ETL Multi-User SaaS - System Architecture Plan

**Status**: Architecture Phase Complete | Implementation Phase Starting
**Created**: December 20, 2025
**Scope**: Complete redesign from single-user ETL to multi-user SaaS with secure credential management

---

## **1. EXECUTIVE SUMMARY**

### **Current State**
- ❌ Single-user ETL with credentials in environment variables
- ❌ No authentication system
- ❌ No secure credential storage
- ❌ Credentials visible in Docker compose and codebase
- ❌ No user isolation or data segmentation

### **Target State**
- ✅ Multi-user SaaS platform
- ✅ Clerk-based user authentication
- ✅ PostgreSQL-backed credential vault with encryption
- ✅ Per-user credential isolation
- ✅ Self-service credential onboarding
- ✅ Settings dashboard with verification
- ✅ Automated scheduling per user
- ✅ Audit logging for compliance

### **Key Design Decisions**

| Aspect | Technology | Rationale |
|--------|-----------|-----------|
| **Authentication** | Clerk.com | Purpose-built SaaS auth, handles sign-up/sign-in/MFA |
| **Frontend Auth** | @clerk/react | Vite SPA support (not Next.js) |
| **Credential Storage** | PostgreSQL + Encryption | Encrypted at rest, per-user isolation via RLS |
| **Encryption** | AES-256-GCM | Industry standard, authenticated encryption |
| **Backend Auth** | JWT + Clerk verification | Verify tokens server-side, scope to user ID |
| **Scheduling** | BullMQ + Redis | Existing queue system, extend for per-user jobs |

---

## **2. SYSTEM ARCHITECTURE OVERVIEW**

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Vite SPA (React + TypeScript)                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Dashboard / Onboarding / Settings                   │ │  │
│  │  │  - Clerk UI (Sign-in, Sign-up, User Menu)         │ │  │
│  │  │  - Credential Entry Forms                          │ │  │
│  │  │  - Verification Flows                              │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬─────────────────────────────────┘
                               │ HTTPS + JWT
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (Express)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Auth Middleware (JWT Verification + User Scoping)       │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────┬───────┴────────┬──────────────┬──────────┐ │
│  ↓                ↓                ↓              ↓           ↓  │
│  Credentials API  Services API    Settings API   Jobs API    Health
│  POST /save       GET /services   GET /user      POST /job   GET /health
│  GET /list        POST /verify    PUT /config    GET /jobs
│  PUT /update      GET /verify     DELETE /creds  DELETE /job
│  DELETE /cred     POST /test
│  │
│  └─────────────────────────────────────┬────────────────────┘  │
│                                        │                        │
│  ┌────────────────────────────────────┴─────────────────────┐  │
│  │ Credential Encryption Layer (AES-256-GCM)              │  │
│  │ - encrypt(credential, userKey) → encryptedBlob         │  │
│  │ - decrypt(encryptedBlob, userKey) → credential         │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │ Database Layer (PostgreSQL with RLS)                  │  │
│  │                                                        │  │
│  │ ┌──────────────────────────────────────────────────┐ │  │
│  │ │ users (linked to Clerk)                          │ │  │
│  │ │ credentials (encrypted, per-user isolated)       │ │  │
│  │ │ service_configs (which services user enabled)    │ │  │
│  │ │ sheet_mappings (sheet IDs per user per service)  │ │  │
│  │ │ job_schedules (cron jobs per user)               │ │  │
│  │ │ audit_logs (all credential access)               │ │  │
│  │ └──────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                        │                       │
│                                        │                       │
│  ┌────────────────────────────────────┴────────────────────┐ │
│  │ Worker Layer (Credential Decryption + API Integration) │ │
│  │  For each user + service:                              │ │
│  │  1. Fetch encrypted credentials                        │ │
│  │  2. Decrypt (using user key)                           │ │
│  │  3. Initialize service client (Sheets, Meta, etc.)    │ │
│  │  4. Fetch data → write to user's spreadsheet          │ │
│  │  5. Audit log the operation                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         ↓                                        ↓
    Clerk Auth                          External Services
    (Sign-in, Tokens)                   (Google Sheets, Meta, GA4, Shopify)
```

---

## **3. AUTHENTICATION FLOW**

### **3.1 User Sign-Up & Sign-In (Clerk Handles)**

```
User Opens App
    ↓
Is authenticated? (Clerk session check)
    ├─ No → Redirect to Clerk Sign-In UI
    │        User enters email + password
    │        Clerk creates user account
    │        JWT session created
    │        ↓
    └─ Yes → Continue
             ↓
Extract Clerk user ID from JWT
    ↓
Create entry in PostgreSQL users table (if first login)
    ↓
Fetch user's saved credentials from database
    ↓
Load dashboard or redirect to onboarding (if no credentials)
```

### **3.2 Request Authentication (Every API Call)**

```
Frontend API Call (React)
    │
    ├─ Get Clerk JWT token: await useAuth().getToken()
    │
    ├─ Attach header: Authorization: Bearer {jwt}
    │
    └─ Send to backend
             ↓
Backend Middleware
    │
    ├─ Verify JWT signature (using Clerk public key)
    │
    ├─ Extract sub (user ID)
    │
    ├─ Query: SELECT * FROM users WHERE clerk_id = sub
    │
    ├─ Attach user to req.user
    │
    └─ Scope all database queries to user ID
             ↓
Endpoint handler
    │
    ├─ req.user.id is available
    │
    └─ All queries filtered by WHERE user_id = req.user.id
```

---

## **4. CREDENTIAL MANAGEMENT FLOW**

### **4.1 Storing a Credential**

```
User enters Google Service Account JSON in UI
    ↓
POST /api/credentials/google with body:
  {
    "credentialJson": "{ ... }",
    "credentialName": "My Google Account",
    "service": "google_sheets"
  }
    ↓
Backend receives request
    │
    ├─ Verify user is authenticated (JWT)
    │
    ├─ Validate JSON is valid Google SA format
    │
    ├─ Generate encryption key from: HMAC(userSecret, userId)
    │
    ├─ Encrypt: encryptedBlob = encrypt(credentialJson, key, AES-256-GCM)
    │
    ├─ Store in DB:
    │   INSERT INTO credentials (
    │     user_id, service, name, encrypted_blob, 
    │     algorithm, created_at, verified_at
    │   ) VALUES (...)
    │
    └─ Return: { credentialId, service, name, verified: false }
```

### **4.2 Verifying a Credential**

```
User clicks "Test Connection" button
    ↓
POST /api/credentials/{credentialId}/verify
    ↓
Backend:
    │
    ├─ Query credential from DB where user_id = req.user.id
    │
    ├─ Decrypt using user's key
    │
    ├─ Create service client (e.g., Google Sheets auth)
    │
    ├─ Try operation: get list of spreadsheets
    │   ├─ Success → UPDATE credentials SET verified_at = NOW()
    │   │            Return { verified: true, details: [...] }
    │   │
    │   └─ Failure → Return { verified: false, error: "Invalid credentials" }
    │
    └─ Log operation in audit_logs (no credential data)
```

### **4.3 Using a Credential (During Sync)**

```
BullMQ Job Triggered (e.g., "fetch-meta-data" for user)
    ↓
Worker receives job with: { userId, service, sheetId, sheetName }
    ↓
Worker:
    │
    ├─ Query: SELECT encrypted_blob, algorithm FROM credentials 
    │         WHERE user_id = userId AND service = service
    │
    ├─ Decrypt using user's key
    │
    ├─ Initialize service client (Meta, Sheets, etc.)
    │
    ├─ Fetch data from external API
    │
    ├─ Transform data according to user's mapping
    │
    ├─ Append rows to user's Google Sheet
    │
    └─ Log operation: { timestamp, user_id, service, status, record_count }
       (NOT including credential data)
```

---

## **5. DATABASE SCHEMA (Simplified Overview)**

```sql
-- Users (synced with Clerk)
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) UNIQUE NOT NULL,  -- Clerk user ID
  email VARCHAR(255),
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Enable Row-Level Security
  CONSTRAINT users_rls CHECK (clerk_id IS NOT NULL)
);

-- Credentials (encrypted)
CREATE TABLE credentials (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,  -- 'google_sheets', 'meta', 'ga4', 'shopify'
  name VARCHAR(255) NOT NULL,    -- User-friendly name
  encrypted_blob TEXT NOT NULL,  -- AES-256-GCM encrypted JSON
  algorithm VARCHAR(50) DEFAULT 'aes-256-gcm',
  created_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,  -- NULL if not verified
  expires_at TIMESTAMP,   -- For OAuth tokens
  version INT DEFAULT 1,  -- For credential rotation
  
  -- Ensure user can only access own credentials via RLS
  CONSTRAINT credentials_user_isolation UNIQUE(user_id, service, id)
);

-- Service Configurations
CREATE TABLE service_configs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,  -- 'google_sheets', 'meta', 'ga4', 'shopify'
  enabled BOOLEAN DEFAULT false,
  credential_id BIGINT REFERENCES credentials(id) ON DELETE SET NULL,
  custom_config JSONB DEFAULT '{}',  -- Service-specific settings
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, service)
);

-- Sheet Mappings (which Google Sheet for which service)
CREATE TABLE sheet_mappings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,
  spreadsheet_id VARCHAR(255) NOT NULL,
  sheet_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, service, spreadsheet_id)
);

-- Job Schedules
CREATE TABLE job_schedules (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,
  cron_expression VARCHAR(100),  -- e.g., "0 2 * * *" = daily at 2 AM
  enabled BOOLEAN DEFAULT false,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs (NO credential data)
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100),  -- 'credential_created', 'credential_verified', 'sync_started'
  service VARCHAR(50),
  status VARCHAR(50),   -- 'success', 'failure', 'pending'
  error_message TEXT,   -- Sanitized, no credentials
  metadata JSONB,       -- Additional context, no credentials
  created_at TIMESTAMP DEFAULT NOW()
);

-- Row-Level Security Policy (PostgreSQL)
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY credentials_user_isolation ON credentials
  USING (user_id = current_user_id);  -- current_user_id set in app context

ALTER TABLE service_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_configs_user_isolation ON service_configs
  USING (user_id = current_user_id);

-- Same for other tables...
```

---

## **6. USER FLOWS**

### **6.1 First-Time User Onboarding**

```
Step 1: Sign-Up (Clerk handles)
  User enters email + password → Clerk creates account → JWT issued

Step 2: First Login (Frontend + Backend)
  Frontend: GET /api/user/profile
  Backend: Check if user exists in PostgreSQL
    ├─ No → INSERT into users table
    └─ Yes → Already onboarded

Step 3: Onboarding Page (Frontend)
  Display: "Welcome to KPI Dashboard!"
  Options:
    - "Setup Google Sheets" → Credential entry form
    - "Setup Meta Ads" → Credential entry form
    - "Setup Google Analytics" → Credential entry form
    - "Setup Shopify" → Credential entry form
    - "Skip for now" → Go to dashboard (limited functionality)

Step 4: Google Sheets Credential Setup
  User inputs: Google Service Account JSON
  Frontend: POST /api/credentials/save
  Backend:  Validate → Encrypt → Store
  Response: credential_id + "Test connection?" button
  
Step 5: Test Google Sheets Connection
  User clicks: "Test Connection"
  Frontend: POST /api/credentials/{id}/verify
  Backend:  Decrypt → Auth → List sheets → "✓ Connected!"
  
Step 6: Select Spreadsheet
  User sees: Dropdown of their spreadsheets
  User selects: One to use for data
  Frontend: POST /api/sheet-mappings/set
  Backend:  Store mapping: user_id → service → spreadsheet_id
  
Step 7: Repeat for Meta, GA4, Shopify
  Same flow for other services
  
Step 8: Dashboard Ready
  User sees: "All configured! Dashboard ready."
  Redirects to: Dashboard with service widgets
```

### **6.2 Settings Dashboard**

```
User goes to: Settings / Configuration
  
Sections:
  1. Account
     - Display name
     - Email address (from Clerk)
     - Logout button
     - Delete account button
  
  2. Credentials
     ├─ Google Sheets
     │  ├─ Connected as: [email]
     │  ├─ Verified: [✓ / ✗]
     │  ├─ Test button
     │  └─ Update/Remove buttons
     │
     ├─ Meta Ads
     │  ├─ Connected as: [Account Name]
     │  ├─ Verified: [✓ / ✗]
     │  ├─ Test button
     │  └─ Update/Remove buttons
     │
     ├─ Google Analytics
     │  └─ Similar pattern
     │
     └─ Shopify
        └─ Similar pattern
  
  3. Sheet Mappings
     ├─ Google Sheets for Meta data → [Current sheet]
     ├─ Google Sheets for GA4 data → [Current sheet]
     ├─ Google Sheets for Shopify data → [Current sheet]
     └─ Edit buttons to change sheets
  
  4. Automation
     ├─ Meta sync schedule
     │  └─ Cron: [0 2 * * *] (Daily 2 AM)
     │  └─ Enable/Disable toggle
     │
     ├─ GA4 sync schedule
     │  └─ Similar
     │
     └─ Shopify sync schedule
        └─ Similar
  
  5. Activity Log
     ├─ Last sync: 2025-12-20 02:15:30
     ├─ Status: ✓ Success
     ├─ Records: 150 rows added
     ├─ See full log → Expandable table
     └─ Shows: timestamp, service, status, record_count (NO credentials)
```

---

## **7. IMPLEMENTATION PHASES**

### **Phase 1: Foundation (Week 1-2)**
- ✅ Clerk authentication setup (Subagent completed)
- ✅ Database schema design (Subagent completed)
- [ ] Set up PostgreSQL database
- [ ] Implement JWT verification middleware
- [ ] Create user table + sync with Clerk

### **Phase 2: Backend Credential System (Week 3-4)**
- [ ] Implement encryption/decryption functions
- [ ] Build credential storage API endpoints
- [ ] Build credential verification endpoints
- [ ] Implement audit logging
- [ ] Add database migrations

### **Phase 3: Frontend Auth (Week 5)**
- [ ] Integrate Clerk auth (@clerk/react)
- [ ] Update header with user menu
- [ ] Implement protected routes
- [ ] Add JWT token to all API calls

### **Phase 4: Onboarding UI (Week 6)**
- [ ] Create credential entry forms
- [ ] Implement verification flow UI
- [ ] Create sheet selector component
- [ ] Build welcome wizard

### **Phase 5: Settings Dashboard (Week 7)**
- [ ] Build settings layout
- [ ] Credential management section
- [ ] Schedule configuration UI
- [ ] Activity log viewer

### **Phase 6: Integration & Testing (Week 8)**
- [ ] Connect onboarding to backend
- [ ] Test credential storage/retrieval
- [ ] Test service verification (Google, Meta, GA4, Shopify)
- [ ] End-to-end testing

---

## **8. TECHNOLOGY STACK UPDATES**

### **Frontend Changes**
```json
{
  "dependencies": {
    "@clerk/react": "^latest",
    "@clerk/types": "^latest"
  }
}
```

### **Backend Changes**
```json
{
  "dependencies": {
    "pg": "^8.8.0",              // PostgreSQL client
    "crypto": "builtin",          // Node.js built-in
    "jsonwebtoken": "^9.0.0",    // JWT verification
    "dotenv": "^16.3.1"          // Already have
  },
  "new-env-vars": {
    "DATABASE_URL": "postgresql://...",
    "CLERK_SECRET_KEY": "sk_test_...",
    "ENCRYPTION_KEY_SALT": "random-bytes",
    "NODE_ENV": "production"
  }
}
```

---

## **9. SECURITY CHECKLIST**

- [ ] No credentials in git history
- [ ] No credentials in logs
- [ ] Encrypted at rest (AES-256-GCM)
- [ ] Encrypted in transit (HTTPS only)
- [ ] Row-level security in database
- [ ] JWT signature verification
- [ ] Rate limiting on sensitive endpoints
- [ ] Audit logging of all credential access
- [ ] User ID validation on every request
- [ ] Secrets rotation plan
- [ ] CORS restricted to frontend domain
- [ ] API key masking in responses (e.g., "goog...9ac3")

---

## **10. DEPLOYMENT CHECKLIST**

- [ ] PostgreSQL database provisioned
- [ ] Migrations run in production
- [ ] Environment variables configured
- [ ] Clerk production keys installed
- [ ] Docker image rebuilt with new code
- [ ] Frontend deployed to CDN/server
- [ ] Backend health checks passing
- [ ] SSL certificates valid
- [ ] Monitoring + alerting enabled
- [ ] Backup strategy in place

---

## **11. RISK MITIGATION**

| Risk | Mitigation |
|------|-----------|
| Credential exposure in logs | Sanitize all logs, audit logging with RLS |
| Database breach | AES-256-GCM encryption, key rotation |
| JWT token theft | Short expiry (15 min), refresh tokens, secure storage |
| User enumeration | Generic error messages |
| Brute force attacks | Rate limiting on sign-in endpoint |
| Service interruption | Database backups, worker retry logic |

---

## **12. NEXT STEPS**

1. **Database Setup** (Scheduled Task)
   - Provision PostgreSQL instance
   - Run schema migrations
   - Set up RLS policies

2. **Backend Implementation** (In Progress)
   - Implement credential encryption/decryption
   - Build credential API endpoints
   - Add JWT middleware

3. **Frontend Auth** (In Progress - Subagent)
   - Integrate Clerk (@clerk/react)
   - Update React components
   - Add protected routes

4. **UI Components** (Pending)
   - Credential entry forms
   - Settings dashboard
   - Onboarding wizard

5. **Integration Testing** (Pending)
   - Test end-to-end credential flow
   - Test service verification
   - Load testing

---

**Architecture approved by**: System Architecture Review
**Last updated**: 2025-12-20
**Next review**: After Phase 2 completion
