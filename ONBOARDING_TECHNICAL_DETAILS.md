# Onboarding System - Technical Implementation Details

## Architecture Overview

```
User Flow:
┌─────────────────────────────────────────────────────────────────┐
│                     Onboarding Wizard                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Google Sheets Setup (Required)                       │  │
│  │    ├─ Input credentials                                 │  │
│  │    ├─ Save to backend                                   │  │
│  │    ├─ Get success response with credential ID           │  │
│  │    ├─ Verify connection                                 │  │
│  │    └─ Show ✅ "Credential Saved" banner               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 2. Analytics Service Selection                           │  │
│  │    ├─ Display Meta, GA4, Shopify options               │  │
│  │    ├─ Show which ones are already configured           │  │
│  │    └─ Auto-refresh every 5 seconds                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 3. Service Configuration (For each service)              │  │
│  │    ├─ Input API credentials                             │  │
│  │    ├─ Save to backend                                   │  │
│  │    ├─ Verify connection                                 │  │
│  │    ├─ Select Google Sheet for storage                   │  │
│  │    ├─ Save sheet mapping                                │  │
│  │    └─ Show ✅ "Credential Saved" banner               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 4. Completion & Redirect                                │  │
│  │    └─ Navigate to Dashboard                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    [Backend API Routes]
                            ↓
            [PostgreSQL Database - Persistence]
```

## Data Flow: Credential Save

### Step 1: User submits credentials
```typescript
// Frontend: CredentialInput.tsx
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateCredentials()) return;
  
  onSave({
    name: name.trim(),
    type,
    credentials: credentials.trim(),
  });
};
```

### Step 2: Save via hook
```typescript
// Frontend: useCredentials.ts
const saveCredential = useCallback(
  async (request: CredentialCreateRequest): Promise<Credential> => {
    console.log('[useCredentials] Saving credential:', { service: request.service, name: request.name });
    
    const requestBody = {
      service: request.service,
      credentialName: request.name,
      credentialJson: request.credentials,
    };

    const result = await fetchApi<Credential>('/credentials/save', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    
    console.log('[useCredentials] Save response:', result);
    const data = (result as { success: true; data: Credential }).data;
    return data;
  },
  []
);
```

### Step 3: Backend processes request
```typescript
// Backend: src/routes/credentials.ts
router.post('/save', authMiddleware, async (req, res) => {
  const { service, credentialName, credentialJson } = req.body;
  const userId = req.user.id;

  try {
    // Encrypt the credential
    const encrypted = encrypt(credentialJson);

    // Save to database
    const result = await db.query(
      'INSERT INTO credentials (user_id, service, name, credential_data, credential_type) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, service, name, verified, created_at, updated_at',
      [userId, service, credentialName, encrypted, 'service_account']
    );

    const credential = result.rows[0];

    // Log the action
    await auditLog.log(userId, 'credential_saved', service, 'success', {
      name: credentialName,
      credentialId: credential.id,
    });

    // ✅ NEW: Return with standard format
    return res.json({
      success: true,
      data: credential
    });
  } catch (error) {
    await auditLog.log(userId, 'credential_saved', service, 'failed', {
      error: error.message,
    });

    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});
```

### Step 4: Frontend displays success
```typescript
// Frontend: improved-service-wizard.tsx
const handleCredentialSave = async (data: {...}) => {
  console.log('[Onboarding] Saving credential:', { service: 'google_sheets', name: data.name });
  
  try {
    const credential = await saveCredential({
      service: 'google_sheets',
      name: data.name,
      type: data.type,
      credentials: data.credentials,
    });
    
    console.log('[Onboarding] Credential saved:', credential);
    setCredentialId(credential.id);
    setCredentialName(credential.name);
    setStep('verify');
  } catch (err) {
    setError(err.message);
  }
};

// Render success banner
{step === 'verify' && credentialId && (
  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
    <CheckCircle className="w-5 h-5 text-green-500" />
    <h4>Credential Saved</h4>
    <p>{credentialName}</p>
  </div>
)}
```

## Component Hierarchy

```
OnboardingPage
├── OnboardingProvider
│   └── OnboardingContent
│       └── ImprovedServiceWizard
│           ├── GoogleSheetsSetup
│           │   ├── CredentialInput
│           │   └── CredentialVerification
│           ├── ServiceSelection
│           ├── AnalyticsServiceSetup (for each service)
│           │   ├── CredentialInput
│           │   ├── CredentialVerification
│           │   └── SheetSelector
│           └── SetupComplete

SettingsPage
├── Tabs (Account, Credentials, Sheets, Automation, Activity)
│   ├── CredentialsSection
│   │   ├── CredentialAddDialog
│   │   │   └── ServiceCredentialForm (Google Sheets, Meta, GA4, Shopify)
│   │   └── Credential Cards
│   └── ...
```

## State Management

### Onboarding Wizard State
```typescript
interface WizardState {
  currentStep: 'google_sheets' | 'service_select' | 'service_config' | 'complete';
  googleSheetsCredentialId: string | null;
  googleSheetsVerified: boolean;
  selectedService: ServiceType | null;
  configuredServices: ServiceType[];
}
```

### Credential Setup State (per service)
```typescript
interface CredentialSetupState {
  step: 'credentials' | 'verify' | 'sheet';
  credentialId: string | null;
  credentialName: string | null;
  error: string | null;
  savingProgress: string;
}
```

### Settings Page State
```typescript
interface SettingsState {
  activeTab: string;
  credentials: Credential[];
  sheetMappings: SheetMapping[];
  schedules: Schedule[];
  loading: boolean;
  editingCredential: string | null;
  addingCredential: boolean;
  editingSchedule: string | null;
  editingSheet: ServiceType | null;
}
```

## API Contract

### Request Format
```typescript
// POST /credentials/save
{
  service: 'google_sheets' | 'meta' | 'ga4' | 'shopify';
  credentialName: string;
  credentialJson: string; // JSON string of credentials
}
```

### Response Format (New Standard)
```typescript
// Success
{
  success: true,
  data: {
    id: string;
    user_id: number;
    service: string;
    name: string;
    verified: boolean;
    created_at: string;
    updated_at: string;
  }
}

// Error
{
  success: false,
  error: string;
  data?: null;
}
```

## Auto-Refresh Mechanism

### Onboarding Refresh (Every 5 seconds)
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const creds = await getCredentials();
      const gsCred = creds.find(c => c.service === 'google_sheets' && c.verified);
      if (gsCred && currentStep !== 'google_sheets') {
        setGoogleSheetsCredentialId(gsCred.id);
        setGoogleSheetsVerified(true);
      }
    } catch (err) {
      // Silently fail
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, [getCredentials, currentStep]);
```

**Purpose**: Detect if Google Sheets credential was added in another browser tab/window

### Settings Refresh (After adding)
```typescript
const handleCredentialAdded = useCallback(() => {
  console.log('[Settings] Credential added, refreshing data...');
  setAddingCredential(false);
  
  // Wait 500ms for backend to process
  setTimeout(() => loadData(), 500);
}, [loadData]);
```

**Purpose**: Immediately show newly added credential without manual refresh

## Type Definitions

### Credential Type
```typescript
interface Credential {
  id: string;
  user_id: number;
  service: ServiceType;
  name: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

type ServiceType = 'google_sheets' | 'meta' | 'ga4' | 'shopify';
type CredentialType = 'service_account' | 'oauth_token' | 'api_key';
```

### Verification Response
```typescript
interface CredentialVerificationResponse {
  success: boolean;
  verified: boolean;
  metadata?: {
    email?: string;
    account_name?: string;
    error?: string;
  };
}
```

## Error Handling

### Frontend Error Handling
```typescript
try {
  const credential = await saveCredential({...});
  // Success: show banner
} catch (err) {
  // Error: show error message
  setError(err instanceof Error ? err.message : 'Failed to save credential');
}
```

### Backend Error Handling
```typescript
try {
  // Process credential
  await db.query(...);
  return res.json({ success: true, data: credential });
} catch (error) {
  // Log failure
  await auditLog.log(userId, 'credential_saved', service, 'failed', {
    error: error.message,
  });
  
  // Return error
  return res.status(400).json({
    success: false,
    error: error.message,
  });
}
```

## Performance Optimizations

### 1. Lazy Loading
```typescript
// Only fetch when needed
const [credentials, setCredentials] = useState<Credential[]>([]);
const [loaded, setLoaded] = useState(false);

useEffect(() => {
  if (!loaded) {
    loadData().then(() => setLoaded(true));
  }
}, []);
```

### 2. Request Batching
```typescript
// Load all data in parallel, not sequentially
const [creds, sheets, scheds] = await Promise.all([
  getCredentials(),
  getSheetMappings(),
  getSchedules(),
]);
```

### 3. Debounced Refresh
```typescript
// Only refresh if actually needed
useEffect(() => {
  const timer = setTimeout(() => {
    loadData();
  }, 500); // Wait 500ms after credential added
  
  return () => clearTimeout(timer);
}, [addingCredential]);
```

## Database Schema

### Credentials Table
```sql
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id),
  service VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  credential_data TEXT NOT NULL, -- Encrypted JSON
  credential_type VARCHAR(50),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, service, name)
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  service VARCHAR(50),
  status VARCHAR(20),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Considerations

1. **Encryption at Rest**: Credentials encrypted with AES-256-CBC
2. **Authentication**: All endpoints require Clerk JWT
3. **User Isolation**: Users can only see their own credentials
4. **Audit Trail**: All credential operations logged
5. **No Plaintext**: Credentials never logged in console (except during dev)

## Testing Checklist

- [x] Credential save returns `{ success: true, data: credential }`
- [x] Frontend parses response correctly
- [x] Success banner displays after save
- [x] Verification works after save
- [x] Auto-refresh detects new credentials
- [x] Settings page shows new credential immediately
- [x] Audit logs record the save
- [x] Database shows encrypted credential
- [x] Multiple credentials per service work (if supported)
- [x] Error cases handled gracefully

## Browser Console Output Example

```javascript
[Onboarding] Saving Google Sheets credential: {
  service: "google_sheets",
  name: "Google Sheets Service Account"
}

[useCredentials] Saving credential: {
  service: "google_sheets",
  name: "Google Sheets Service Account"
}

[useCredentials] Response received: {
  success: true,
  data: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    user_id: 1,
    service: "google_sheets",
    name: "Google Sheets Service Account",
    verified: false,
    created_at: "2025-12-22T10:01:24.917682Z",
    updated_at: "2025-12-22T10:01:24.917682Z"
  }
}

[useCredentials] Credential saved successfully: {
  id: "550e8400-e29b-41d4-a716-446655440000",
  user_id: 1,
  service: "google_sheets",
  name: "Google Sheets Service Account",
  verified: false,
  created_at: "2025-12-22T10:01:24.917682Z",
  updated_at: "2025-12-22T10:01:24.917682Z"
}

[Onboarding] Credential saved successfully: {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Google Sheets Service Account"
}

// User sees green banner: ✅ Credential Saved
```

---

**Document Version**: 1.0  
**Last Updated**: December 22, 2025  
**Status**: Implementation Complete ✅
