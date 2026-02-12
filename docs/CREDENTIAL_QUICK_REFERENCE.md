# Credential System - Quick Reference Guide

## 🚀 Quick Start for Developers

### Installation

```bash
# Install dependencies
npm install crypto pg express jsonwebtoken

# Build TypeScript
npm run build

# Run tests
npm run test
```

---

## 📝 Common Tasks

### Initialize the System

```typescript
import { getEncryptionService } from './services/encryption.service';
import AWS from 'aws-sdk';

// 1. Load master key from Secrets Manager
const secretsManager = new AWS.SecretsManager();
const secret = await secretsManager.getSecretValue({ 
  SecretId: 'kpi/master-key-v1' 
}).promise();

// 2. Initialize encryption service
const encService = getEncryptionService();
const keyMaterial = Buffer.from(secret.SecretString!, 'base64');
await encService.initializeMasterKey(1, keyMaterial);
```

### Create a Credential

```typescript
import { CredentialRepository } from './services/credential.repository';

const credentialRepo = new CredentialRepository(db, auditService);

const credential = await credentialRepo.createCredential(
  user, // UserContext from JWT
  'google_sheets',
  'My Google Account',
  {
    _credentialType: 'google_sheets',
    type: 'service_account',
    project_id: 'my-project',
    private_key_id: 'key-id',
    private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
    client_email: 'service@project.iam.gserviceaccount.com',
    client_id: 'client-id',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token'
  }
);
```

### Retrieve & Use a Credential

```typescript
// Get decrypted credential (only when needed)
const credential = await credentialRepo.getCredential(user, credentialId);

// Use it with external service
const googleAuth = new GoogleAuth({
  projectId: credential.project_id,
  keyId: credential.private_key_id,
  privateKey: credential.private_key,
  // ...
});

// Clear from memory after use (TypeScript - memory still has reference)
// For Node.js, garbage collection will clear when out of scope
```

### List Credentials

```typescript
const { credentials, total, page, limit } = await credentialRepo.listCredentials(
  user,
  'google_sheets', // optional filter
  1,               // page
  10               // limit
);

credentials.forEach(cred => {
  console.log(`${cred.credential_name}: ${cred.verification_status}`);
});
```

### Update Credential

```typescript
const updated = await credentialRepo.updateCredential(user, credentialId, {
  credentialName: 'Updated Name',
  credentialData: newCredentialData, // Optional - re-encrypts
  expiresAt: new Date('2025-12-31')  // Optional
});
```

### Delete Credential

```typescript
await credentialRepo.deleteCredential(user, credentialId);
// Soft delete - marked inactive, audit log preserved
```

### Verify Credential

```typescript
const service = new CredentialService(credentialRepo);
const isValid = await service.verifyCredential(user, credentialId, 'google_sheets');
// Returns true/false
```

---

## 🔐 Security Checklist

Before using credentials:

- [ ] Credential retrieved only when needed
- [ ] Decrypted credential stays in memory only
- [ ] Never log credential content
- [ ] Use `sanitizeCredentialForLogging()` if logging metadata
- [ ] Clear credential variables after use
- [ ] Always verify user ownership
- [ ] Check credential is_active
- [ ] Check credential not expired
- [ ] Audit log the operation

---

## 📊 Database Queries

### Find all credentials for a user
```sql
SELECT * FROM api_credentials 
WHERE user_id = $1 AND is_active = TRUE;
```

### Find verified credentials
```sql
SELECT * FROM api_credentials 
WHERE user_id = $1 AND verification_status = 'valid' AND is_active = TRUE;
```

### Check audit history
```sql
SELECT * FROM credential_audit_log 
WHERE credential_id = $1 
ORDER BY created_at DESC 
LIMIT 50;
```

### Find suspicious activity
```sql
SELECT user_id, COUNT(*) as failed_count
FROM credential_audit_log 
WHERE action_status = 'failed' 
AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
GROUP BY user_id 
HAVING COUNT(*) > 10;
```

---

## 🧪 Testing Examples

### Test Encryption
```typescript
import { getEncryptionService, generateTestMasterKey } from './services/encryption.service';

it('encrypts and decrypts', async () => {
  const service = getEncryptionService();
  const key = generateTestMasterKey();
  await service.initializeMasterKey(1, key);
  
  const cred = { _credentialType: 'google_sheets', ... };
  const encrypted = await service.encryptCredential(cred, 1, 'google_sheets', 'test');
  const decrypted = await service.decryptCredential(
    encrypted.encryptedData,
    encrypted.iv,
    encrypted.authTag,
    encrypted.keyVersion,
    1, 'google_sheets', 'test'
  );
  
  expect(decrypted).toEqual(cred);
});
```

### Test Validation
```typescript
import { validateCredentialFormat } from './services/credential.validator';

const result = validateCredentialFormat('google_sheets', credentialData);
if (!result.isValid) {
  result.errors.forEach(error => {
    console.error(`${error.field}: ${error.message}`);
  });
}
```

---

## 📋 API Examples

### Create Credential
```bash
curl -X POST https://api.example.com/api/v1/credentials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service_type": "google_sheets",
    "credential_name": "Marketing Metrics",
    "credential_data": {...}
  }'
```

### List Credentials
```bash
curl https://api.example.com/api/v1/credentials?service_type=google_sheets \
  -H "Authorization: Bearer $TOKEN"
```

### Get Credential Metadata
```bash
curl https://api.example.com/api/v1/credentials/cred_123 \
  -H "Authorization: Bearer $TOKEN"
```

### Verify Credential
```bash
curl -X POST https://api.example.com/api/v1/credentials/cred_123/verify \
  -H "Authorization: Bearer $TOKEN"
```

### Update Credential
```bash
curl -X PUT https://api.example.com/api/v1/credentials/cred_123 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"credential_name": "New Name"}'
```

### Delete Credential
```bash
curl -X DELETE https://api.example.com/api/v1/credentials/cred_123 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🐛 Debugging

### Check if master key is initialized
```typescript
const service = getEncryptionService();
const version = service.getActiveMasterKeyVersion();
console.log('Active key version:', version);
console.log('Has key:', service.hasKeyVersion(version));
```

### Debug encryption
```typescript
const credential = { _credentialType: 'google_sheets', ... };
console.log('Original:', credential);

const encrypted = await encryptionService.encryptCredential(
  credential, userId, serviceType, name
);

console.log('Encrypted data length:', encrypted.encryptedData.length);
console.log('IV length:', encrypted.iv.length, '(should be 16)');
console.log('Auth tag length:', encrypted.authTag.length, '(should be 16)');
console.log('Key version:', encrypted.keyVersion);
```

### Check audit logs
```typescript
const logs = await auditService.getUserAuditLog(userId, 100);
logs.forEach(log => {
  console.log(`${log.created_at} ${log.action} ${log.action_status}`);
});
```

---

## 🚨 Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Master key not initialized" | Encryption service not started | Call `initializeMasterKey()` at startup |
| "Credential not found or access denied" | Wrong user or credential doesn't exist | Verify credential_id and user_id |
| "Invalid credential format" | Missing required fields | Check credential against service schema |
| "Decryption failed" | Tampered data or wrong key | Verify database integrity, check key rotation |
| "RLS policy violation" | User accessing other user's credential | Verify user context is correct |
| "Duplicate credential" | Credential name exists for service | Use unique names or update existing |

---

## 🔄 Key Rotation

### Rotate Master Key
```typescript
const newKeyMaterial = crypto.randomBytes(32);
const newVersion = await encryptionService.rotateKey(newKeyMaterial);

// Store new version in database
// Add to encryption_keys table
// Background job re-encrypts all credentials
```

### Monitor Encryption Key Status
```sql
SELECT * FROM encryption_keys ORDER BY key_version DESC;
-- is_active: current key
-- is_retired: old key (can still decrypt)
```

---

## 📊 Monitoring Queries

### Credential health check
```sql
SELECT 
  service_type,
  COUNT(*) as total,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN verification_status = 'valid' THEN 1 ELSE 0 END) as verified
FROM api_credentials
GROUP BY service_type;
```

### Recent activity
```sql
SELECT 
  action,
  action_status,
  COUNT(*) as count
FROM credential_audit_log
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 day'
GROUP BY action, action_status;
```

### Failed operations
```sql
SELECT 
  user_id,
  action,
  failure_reason,
  COUNT(*) as count
FROM credential_audit_log
WHERE action_status = 'failed'
AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
GROUP BY user_id, action, failure_reason;
```

---

## 🎯 Performance Tips

1. **Cache metadata** - Get credential metadata frequently, decrypt only when needed
2. **Use indexes** - Query by user_id and service_type
3. **Pool connections** - Use connection pooling for database
4. **Batch audits** - Audit logs can be batched if needed
5. **Archive logs** - Archive logs older than 1 year monthly

---

## 📚 Documentation Map

| File | Purpose |
|------|---------|
| `CREDENTIAL_SYSTEM_DESIGN.md` | Architecture details |
| `CREDENTIAL_API_DOCUMENTATION.md` | API reference |
| `CREDENTIAL_DEPLOYMENT_GUIDE.md` | Deployment steps |
| `src/types/credential-system.ts` | Type definitions |
| `src/services/encryption.service.ts` | Encryption implementation |
| `src/services/credential.repository.ts` | Database access |
| `src/services/credential.service.ts` | Business logic |
| `migrations/credential-system.sql` | Database schema |

---

## 🔗 Related Files

- `src/lib/logger.ts` - Implement logging (never log credentials)
- `src/lib/database.ts` - Database connection pool
- `src/lib/security.ts` - Additional security utilities
- `.env.example` - Environment variables template
- `src/__tests__/` - Unit and integration tests

---

## 📞 Getting Help

1. Check **CREDENTIAL_SYSTEM_DESIGN.md** for architecture questions
2. Check **CREDENTIAL_API_DOCUMENTATION.md** for API questions
3. Check **CREDENTIAL_DEPLOYMENT_GUIDE.md** for operations questions
4. Check type definitions in **credential-system.ts** for typing help
5. Check test files for implementation examples

---

**Keep credentials secure. Never log them. Always verify access.**
