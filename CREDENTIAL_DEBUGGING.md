# Credential and Queue Debugging Guide

This document explains how to test and debug the fixes for the credential and queue issues in the KPI ETL pipeline.

## Issues Fixed

1. **Credential retrieval failure**: Queue worker now properly retrieves and decrypts credentials from database
2. **Poor observability**: Enhanced logging for better debugging
3. **Frontend/backend disconnect**: Improved error handling and feedback
4. **Missing error propagation**: Better error reporting throughout the process

## Testing the Fixes

### 1. Verify Credential Retrieval

Run the credential debugging script to check if credentials are properly stored and retrievable:

```bash
npm run build
node dist/scripts/debug-credentials.js
```

This will:
- List all stored credentials
- Show service configurations
- Attempt to decrypt a credential (without exposing sensitive data)

### 2. Test Queue Functionality

Run the queue test script to verify the queue system works:

```bash
node dist/scripts/test-queue.js
```

This will:
- Initialize the queue
- Enqueue a test job
- Check job status

### 3. Manual Testing

1. Ensure you have valid credentials configured in the dashboard
2. Go to the dashboard and click the "Manual Data Pull" button
3. Select a target date and click "Pull Meta"
4. Check the server logs for detailed information about the job processing

### 4. Check Server Logs

Look for logs with the following patterns to verify proper operation:

- `Processing meta sync job` - indicates the job started
- `Fetching service configuration` - indicates credential lookup
- `Decrypting credential` - indicates successful credential retrieval
- `Starting Meta sync process` - indicates sync started with credentials
- `Sync completed successfully` - indicates successful completion

## Enhanced Logging

The following improvements have been made to logging:

1. **Job-specific logging**: Each queue job now has its own logger with job ID context
2. **Credential validation**: Added logging to verify credential structure before use
3. **Step-by-step tracking**: Each step of the ETL process is now logged
4. **Error details**: More detailed error messages with stack traces

## Error Handling Improvements

1. **Credential validation**: Added explicit checks for required credential fields
2. **Better error messages**: More descriptive error messages for different failure scenarios
3. **Frontend feedback**: Improved message handling in the frontend to show actual status

## Troubleshooting Common Issues

### "Meta access token is required"

This error typically means:
1. No credentials are stored for the Meta service
2. The stored credentials are invalid or missing required fields
3. The service configuration is not properly enabled

### Job shows as "completed" but no data in sheet

Check the logs for:
- Successful API calls to Meta
- Successful Google Sheets authentication
- Any errors during the upsert operation

### Queue job failing immediately

Check:
- Redis connection status
- Database connectivity
- Credential storage and encryption