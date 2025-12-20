# KPI Dashboard - Onboarding & Settings UI

Complete React implementation for user onboarding and settings management in the KPI ETL SaaS platform.

## 📦 What's Been Implemented

### 1. Type Definitions
- **src/types/api.ts** - Complete API type definitions for credentials, services, schedules, sheets, and activity logs
- **src/types/ui.ts** - UI-specific types for onboarding flow and components

### 2. API Hooks
- **src/hooks/useCredentials.ts** - Manage credentials (CRUD + verification)
- **src/hooks/useServices.ts** - Service management and sheet fetching
- **src/hooks/useSchedules.ts** - Automation schedule management
- **src/hooks/useActivityLog.ts** - Activity log with CSV export and auto-refresh
- **src/hooks/useSheetMappings.ts** - Sheet mapping CRUD operations

### 3. Context & State Management
- **src/contexts/onboarding-context.tsx** - Tracks onboarding progress and service configuration

### 4. Onboarding Components
- **src/components/onboarding/credential-input.tsx** - Reusable credential entry form
  - Text input or file upload
  - Support for Service Account JSON, OAuth tokens, and API keys
  - Real-time validation
  
- **src/components/onboarding/credential-verification.tsx** - Test and verify credentials
  - Loading states
  - Success/failure feedback
  - Retry functionality
  
- **src/components/onboarding/sheet-selector.tsx** - Select Google Spreadsheet and Sheet
  - Auto-loads spreadsheets from credential
  - Cascading dropdowns (Spreadsheet → Sheet)
  
- **src/components/onboarding/service-setup-wizard.tsx** - Complete service setup flow
  - Multi-step wizard with progress indicators
  - Credential → Verification → Sheet Selection → Summary

### 5. Settings Components
- **src/components/settings/credential-edit-form.tsx** - Update existing credentials
  - File upload or text input
  - Test before saving
  - Security warnings
  
- **src/components/settings/schedule-config.tsx** - Configure automation schedules
  - Cron expression editor
  - Preset schedules (hourly, daily, weekly)
  - Enable/disable toggle
  - "Run Now" button
  
- **src/components/settings/activity-log.tsx** - View sync history
  - Filterable table (by service, status)
  - Expandable error details
  - CSV export
  - Auto-refresh option

### 6. Pages
- **src/pages/onboarding.tsx** - Multi-step onboarding wizard
  - Welcome screen
  - Service setup for: Google Sheets, Meta, GA4, Shopify
  - Progress tracking
  - Skip options
  - Completion summary
  
- **src/pages/settings.tsx** - Settings dashboard with tabs
  - **Account** - User info, logout, delete account
  - **Credentials** - View, test, update, delete credentials
  - **Sheet Mappings** - Configure which sheets are used per service
  - **Automation** - Schedule configuration
  - **Activity Log** - Sync history and activity

### 7. Navigation & Routing
- **src/lib/navigation.ts** - Simple client-side routing utilities
- **Updated src/App.tsx** - Route handling for `/`, `/onboarding`, `/settings`
- **Updated src/components/header.tsx** - Added breadcrumbs and settings link

## 🎨 UI/UX Features

### Design Patterns
- Consistent use of Radix UI components
- Tailwind CSS for styling
- Dark/light theme support
- Responsive design (mobile-friendly)
- Accessibility (ARIA labels, keyboard navigation)

### User Experience
- **Progressive Disclosure** - Show complexity only when needed
- **Optimistic UI** - Instant feedback on actions
- **Clear Feedback** - Loading states, success/error messages
- **Confirmation Dialogs** - For destructive actions
- **Real-time Validation** - Immediate feedback on form inputs

### Security Considerations
- Never display actual credentials in UI (masked after saving)
- Secure file upload handling
- Confirmation before deletion
- Encrypted storage messages

## 🚀 Getting Started

### Prerequisites
```bash
# Node.js 18+ and npm/yarn
node --version
npm --version
```

### Installation
```bash
cd dashboard
npm install
```

### Environment Setup
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your API URL
VITE_API_URL=http://localhost:3000/api
```

### Development
```bash
npm run dev
# Open http://localhost:5173
```

### Build for Production
```bash
npm run build
npm run preview
```

## 📡 API Integration

### Expected Backend Endpoints

#### Credentials
- `GET /api/credentials` - List all credentials
- `POST /api/credentials` - Create credential
- `GET /api/credentials/:id` - Get credential details
- `PUT /api/credentials/:id` - Update credential
- `DELETE /api/credentials/:id` - Delete credential
- `POST /api/credentials/:id/verify` - Verify credential

#### Services
- `GET /api/services` - List all services and their status
- `POST /api/services/:service/enable` - Enable service
- `POST /api/services/:service/disable` - Disable service

#### Sheets
- `GET /api/sheets/spreadsheets?credential_id=:id` - List spreadsheets
- `GET /api/sheets/:spreadsheetId/sheets?credential_id=:id` - List sheets
- `GET /api/sheets/mappings` - List all sheet mappings
- `POST /api/sheets/mappings` - Create sheet mapping
- `PUT /api/sheets/mappings/:id` - Update sheet mapping
- `DELETE /api/sheets/mappings/:id` - Delete sheet mapping

#### Schedules
- `GET /api/schedules` - List all schedules
- `PUT /api/schedules/:service` - Update schedule
- `POST /api/schedules/:service/run` - Trigger immediate run

#### Activity Log
- `GET /api/activity-log` - Get activity log (with filters)

### API Request Format

All requests include authentication token:
```typescript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
}
```

### API Response Format
```typescript
{
  success: boolean;
  data?: T;
  error?: {
    error: string;
    message: string;
    statusCode: number;
  };
}
```

## 🔧 Customization

### Add New Service
1. Add service to `ServiceType` in `src/types/api.ts`
2. Add label to `SERVICE_LABELS` in components
3. Service will automatically appear in onboarding and settings

### Modify Onboarding Steps
Edit `src/pages/onboarding.tsx`:
- Adjust `SERVICES` array to change order/services
- Modify step logic in `renderPage()`

### Customize Schedule Presets
Edit `CRON_PRESETS` in `src/components/settings/schedule-config.tsx`

### Change API Base URL
Set in `.env`:
```bash
VITE_API_URL=https://api.yourdomain.com/api
```

## 📝 Component Props Reference

### ServiceSetupWizard
```typescript
interface ServiceSetupWizardProps {
  service: ServiceType;
  onComplete: () => void;
  onSkip?: () => void;
}
```

### CredentialInput
```typescript
interface CredentialInputProps {
  service: ServiceType;
  onSave: (credentialData: {
    name: string;
    type: CredentialType;
    credentials: string;
  }) => void;
  onError: (error: string) => void;
  isLoading?: boolean;
}
```

### SheetSelector
```typescript
interface SheetSelectorProps {
  credentialId: string;
  onSelect: (spreadsheetId: string, sheetName: string, spreadsheetName: string) => void;
  isLoading?: boolean;
}
```

## 🧪 Testing Checklist

### Onboarding Flow
- [ ] Welcome screen displays correctly
- [ ] Can navigate through service setup steps
- [ ] Credential upload (file and text) works
- [ ] Verification shows loading and results
- [ ] Sheet selector loads spreadsheets
- [ ] Can skip services
- [ ] Completion summary shows configured services
- [ ] "Go to Dashboard" navigates correctly

### Settings - Credentials
- [ ] List displays all credentials
- [ ] Verification status shown correctly
- [ ] "Test Connection" works
- [ ] Can update credentials
- [ ] Can delete with confirmation
- [ ] Masked credentials never show actual data

### Settings - Sheets
- [ ] Shows current mappings
- [ ] Can change sheet selection
- [ ] Prevents configuration without credentials

### Settings - Automation
- [ ] Schedule display is correct
- [ ] Can enable/disable schedules
- [ ] Cron presets work
- [ ] Custom cron input works
- [ ] "Run Now" triggers sync
- [ ] Next run time calculated

### Settings - Activity Log
- [ ] Table displays entries
- [ ] Filters work (service, status)
- [ ] Can expand error details
- [ ] CSV export downloads
- [ ] Auto-refresh works

## 🐛 Troubleshooting

### Issue: "Failed to fetch credentials"
- Check API URL in `.env`
- Verify backend is running
- Check authentication token in localStorage

### Issue: Spreadsheets not loading
- Verify credential is verified
- Check credential has Google Sheets API access
- Ensure backend proxy is working

### Issue: Routes not working
- Ensure you're using `navigate()` function, not `window.location.href`
- Check browser console for errors

### Issue: Styles not applying
- Run `npm install` to ensure Tailwind is installed
- Check `tailwind.config.js` is configured
- Verify import order in `main.tsx`

## 🔒 Security Best Practices

1. **Never log credentials** - Avoid console.log with credential data
2. **Use HTTPS** - Always use HTTPS in production
3. **Token expiry** - Implement token refresh logic
4. **Rate limiting** - Backend should rate limit verification attempts
5. **Validate inputs** - Always validate on both client and server
6. **Sanitize errors** - Don't expose internal errors to users

## 📚 Additional Resources

- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)

## 🤝 Contributing

When adding new features:
1. Follow existing component patterns
2. Add TypeScript types
3. Include error handling
4. Add loading states
5. Consider mobile responsiveness
6. Update this README

## 📄 License

Part of the KPI ETL SaaS platform.
