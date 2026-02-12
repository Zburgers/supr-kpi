# Enhanced Scheduler System Implementation

## Overview
The Google Sheets KPI Data Manager now features a production-ready, multi-tenant scheduler system with the following capabilities:

- **Per-user scheduling**: Each user can configure their own cron schedules for different data sources
- **Robust retry mechanism**: Failed jobs are automatically retried after 10 minutes
- **Server restart recovery**: Missed jobs are detected and processed on server restart
- **Timezone support**: Users can select their preferred timezone for scheduling
- **Comprehensive monitoring**: Detailed logging and statistics for all scheduler operations
- **Security**: Row-Level Security (RLS) ensures users can only access their own schedules

## Database Schema

### New Table: `job_schedules`
```sql
CREATE TABLE job_schedules (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL CHECK (service IN ('meta', 'ga4', 'shopify')),
  cron_expression VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT false,
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### RLS Policy
```sql
CREATE POLICY job_schedules_user_isolation ON job_schedules
  USING (user_id = current_setting('app.current_user_id')::INTEGER)
  WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);
```

## API Endpoints

### GET /api/schedules
Returns all schedules for the authenticated user, creating default schedules for services that don't have one yet.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "service": "meta",
      "cron": "0 2 * * *",
      "enabled": true,
      "timezone": "Asia/Kolkata",
      "last_run_at": "2023-10-01T02:00:00.000Z",
      "next_run_at": "2023-10-02T02:00:00.000Z",
      "created_at": "2023-10-01T00:00:00.000Z",
      "updated_at": "2023-10-01T00:00:00.000Z"
    }
  ]
}
```

### PUT /api/schedules/:service
Updates or creates a schedule for a specific service.

**Request:**
```json
{
  "cron": "0 3 * * *",
  "enabled": true,
  "timezone": "UTC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "service": "meta",
    "cron": "0 3 * * *",
    "enabled": true,
    "timezone": "UTC",
    "last_run_at": null,
    "next_run_at": "2023-10-02T03:00:00.000Z",
    "created_at": "2023-10-01T00:00:00.000Z",
    "updated_at": "2023-10-01T00:00:00.000Z"
  }
}
```

### POST /api/schedules/:service/run
Triggers a manual sync for a specific service.

**Response:**
```json
{
  "success": true,
  "message": "meta sync job enqueued for user 123",
  "data": {
    "jobId": "job-123",
    "service": "meta",
    "userId": 123
  }
}
```

## Frontend Integration

### Schedule Configuration Component
The `ScheduleConfig` component in the frontend now supports:
- Timezone selection
- Cron expression presets
- Schedule enable/disable toggle
- Next run time calculation
- Manual run button

### API Hook Updates
The `useSchedules` hook now supports:
- Fetching user schedules
- Updating schedules with timezone
- Triggering manual syncs

## Implementation Details

### Enhanced Scheduler Architecture
1. **EnhancedScheduler Class**: Handles per-user cron scheduling
2. **Database Integration**: Schedules stored in `job_schedules` table
3. **Retry Mechanism**: Failed jobs automatically retried after 10 minutes
4. **Server Restart Recovery**: Missed jobs detected and processed on startup
5. **Robust Error Handling**: Graceful handling of missing tables and database issues
6. **Monitoring**: Comprehensive logging and statistics

### Key Features
- **Security**: RLS ensures users can only access their own schedules
- **Reliability**: Failed jobs are retried automatically
- **Scalability**: Per-user scheduling instead of global scheduler
- **Timezone Support**: Proper timezone handling for cron expressions
- **Production-Ready Error Handling**: Graceful handling when database tables don't exist yet
- **Monitoring**: Detailed logging for all scheduler operations

### Error Handling Improvements
- **Graceful Degradation**: When `job_schedules` table doesn't exist, the system returns empty schedules instead of throwing errors
- **Table Creation Handling**: System handles scenarios where the table hasn't been created yet
- **User Experience**: No error messages shown to users when schedules don't exist initially
- **Automatic Recovery**: Once the table is created, the system automatically starts using it

## Production Deployment Strategy

### Automatic Migration System

The system implements a robust, dual-layer migration approach to ensure seamless deployment in production environments:

#### 1. Docker Initialization Layer
The `docker-compose.yml` file contains:
```yaml
volumes:
  - ./migrations:/docker-entrypoint-initdb.d:ro  # Auto-run migrations
```

This ensures that when PostgreSQL starts with a fresh database (first-time deployment), it automatically executes all SQL files in the `migrations/` directory, including the `job_schedules` table creation.

#### 2. Application Initialization Layer
The application includes schema initialization in `src/lib/database.ts` which:
- Creates the `job_schedules` table if it doesn't exist (idempotent operation)
- Sets up all necessary indexes for performance
- Applies Row-Level Security (RLS) policies for multi-tenant isolation
- Creates helper functions for database operations
- Runs automatically when the application starts

#### 3. Production-Safe Error Handling
The system handles all scenarios gracefully:
- **Fresh Installation**: Both migration layers ensure the table is created
- **Existing Production**: Application layer creates the table if missing
- **Missing Table**: Graceful degradation with no user-facing errors
- **Automatic Recovery**: Once the table exists, full functionality is restored

### Deployment Process

#### For New Deployments:
1. The Docker initialization will automatically create all tables including `job_schedules`
2. Application starts with full scheduler functionality

#### For Existing Production:
1. Application automatically detects missing `job_schedules` table
2. Creates the table on startup without service interruption
3. All existing functionality continues to work normally
4. New scheduling features become available immediately after table creation

### Zero-Downtime Migration
- The `CREATE TABLE IF NOT EXISTS` pattern ensures idempotent operations
- No manual intervention required during deployment
- Existing services continue to operate during migration
- Rollback-safe (removing scheduler features won't break the system)

### Migration Verification
The system includes automatic verification:
- Database connectivity health checks
- Schema validation on startup
- Graceful error handling if any step fails
- Comprehensive logging for monitoring the migration process

This approach ensures that the scheduler system can be deployed to production environments without any manual database operations or service downtime, making it completely scalable and professional for enterprise use.

## Testing
The implementation includes:
- Unit tests for scheduler functionality
- API endpoint validation
- Frontend integration verification
- End-to-end workflow testing