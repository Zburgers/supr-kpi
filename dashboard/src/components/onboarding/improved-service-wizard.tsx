/**
 * Service Setup Wizard - Improved flow for configuring analytics services
 * 
 * Flow:
 * 1. First configure Google Sheets (required - this is where data is stored)
 * 2. Then configure analytics services (Meta, GA4, Shopify)
 * 3. Each analytics service needs:
 *    a. Credentials for the API
 *    b. Sheet selection for storing data
 * 
 * Schemas:
 * - Meta: id, date, spend, reach, impressions, clicks, landing_page_views, add_to_cart, initiate_checkout, purchases, revenue
 * - GA4: id, date, sessions, users, add_to_cart, purchases, revenue, bounce_rate
 * - Shopify: id, date, total_orders, total_revenue, net_revenue, total_returns, new_customers, repeat_customers
 */

import { useState, useEffect } from 'react';
import { CheckCircle, ArrowRight, ArrowLeft, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCredentials } from '@/hooks/useCredentials';
import { useSheetMappings } from '@/hooks/useSheetMappings';
import { CredentialInput } from './credential-input';
import { CredentialVerification } from './credential-verification';
import { SheetSelector } from './sheet-selector';
import type { ServiceType, CredentialType } from '@/types/api';

interface ImprovedServiceWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const ANALYTICS_SERVICES: { value: ServiceType; label: string; description: string }[] = [
  {
    value: 'meta',
    label: 'Meta (Facebook Ads)',
    description: 'Import ad spend, reach, impressions, and conversions',
  },
  {
    value: 'ga4',
    label: 'Google Analytics 4',
    description: 'Import sessions, users, and e-commerce data',
  },
  {
    value: 'shopify',
    label: 'Shopify',
    description: 'Import orders, revenue, and customer data',
  },
];

const SCHEMA_INFO: Record<ServiceType, { columns: string[]; defaultSheet: string }> = {
  google_sheets: {
    columns: [],
    defaultSheet: '',
  },
  meta: {
    columns: ['id', 'date', 'spend', 'reach', 'impressions', 'clicks', 'landing_page_views', 'add_to_cart', 'initiate_checkout', 'purchases', 'revenue'],
    defaultSheet: 'meta_raw_daily',
  },
  ga4: {
    columns: ['id', 'date', 'sessions', 'users', 'add_to_cart', 'purchases', 'revenue', 'bounce_rate'],
    defaultSheet: 'ga4_raw_daily',
  },
  shopify: {
    columns: ['id', 'date', 'total_orders', 'total_revenue', 'net_revenue', 'total_returns', 'new_customers', 'repeat_customers'],
    defaultSheet: 'shopify_raw_daily',
  },
};

type WizardStep = 'google_sheets' | 'service_select' | 'service_config' | 'complete';

export function ImprovedServiceWizard({ onComplete, onSkip }: ImprovedServiceWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('google_sheets');
  const [googleSheetsCredentialId, setGoogleSheetsCredentialId] = useState<string | null>(null);
  const [googleSheetsVerified, setGoogleSheetsVerified] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [configuredServices, setConfiguredServices] = useState<ServiceType[]>([]);

  const { saveCredential, verifyCredential, getCredentials } = useCredentials();
  const { saveSheetMapping } = useSheetMappings();

  // Check for existing Google Sheets credential
  useEffect(() => {
    async function checkExisting() {
      try {
        const creds = await getCredentials();
        const gsCred = creds.find(c => c.service === 'google_sheets' && c.verified);
        if (gsCred) {
          setGoogleSheetsCredentialId(gsCred.id);
          setGoogleSheetsVerified(true);
          setCurrentStep('service_select');
        }
      } catch (err) {
        console.warn('Failed to check existing credentials:', err);
        // Ignore - no existing credentials
      }
    }
    checkExisting();
  }, [getCredentials]);

  // Render based on current step
  if (currentStep === 'google_sheets') {
    return (
      <GoogleSheetsSetup
        onComplete={(credId) => {
          setGoogleSheetsCredentialId(credId);
          setGoogleSheetsVerified(true);
          setCurrentStep('service_select');
        }}
        onSkip={onSkip}
        saveCredential={saveCredential}
        verifyCredential={verifyCredential}
      />
    );
  }

  if (currentStep === 'service_select') {
    return (
      <ServiceSelection
        configuredServices={configuredServices}
        onSelect={(service) => {
          setSelectedService(service);
          setCurrentStep('service_config');
        }}
        onComplete={() => setCurrentStep('complete')}
        onBack={() => setCurrentStep('google_sheets')}
        googleSheetsVerified={googleSheetsVerified}
      />
    );
  }

  if (currentStep === 'service_config' && selectedService) {
    return (
      <AnalyticsServiceSetup
        service={selectedService}
        googleSheetsCredentialId={googleSheetsCredentialId!}
        onComplete={() => {
          setConfiguredServices(prev => [...prev, selectedService]);
          setSelectedService(null);
          setCurrentStep('service_select');
        }}
        onBack={() => {
          setSelectedService(null);
          setCurrentStep('service_select');
        }}
        saveCredential={saveCredential}
        verifyCredential={verifyCredential}
        saveSheetMapping={saveSheetMapping}
      />
    );
  }

  if (currentStep === 'complete') {
    return (
      <SetupComplete
        configuredServices={configuredServices}
        onFinish={onComplete}
        onConfigureMore={() => setCurrentStep('service_select')}
      />
    );
  }

  return null;
}

// Google Sheets Setup Component
interface GoogleSheetsSetupProps {
  onComplete: (credentialId: string) => void;
  onSkip?: () => void;
  saveCredential: (data: any) => Promise<any>;
  verifyCredential: (id: string) => Promise<any>;
}

function GoogleSheetsSetup({ onComplete, onSkip, saveCredential }: GoogleSheetsSetupProps) {
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [credentialName, setCredentialName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState<string>('');

  const handleCredentialSave = async (data: { name: string; type: CredentialType; credentials: string }) => {
    setError(null);
    setSavingProgress('Saving credentials...');
    try {
      console.log('[Onboarding] Saving Google Sheets credential:', { service: 'google_sheets', name: data.name });
      const credential = await saveCredential({
        service: 'google_sheets' as ServiceType,
        name: data.name,
        type: data.type,
        credentials: data.credentials,
      });
      console.log('[Onboarding] Credential saved successfully:', credential);
      setCredentialId(credential.id);
      setCredentialName(credential.name);
      setSavingProgress('Credential saved! Verifying...');
      setStep('verify');
    } catch (err) {
      console.error('[Onboarding] Failed to save credential:', err);
      setSavingProgress('');
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    }
  };

  const handleVerified = () => {
    if (credentialId) {
      console.log('[Onboarding] Google Sheets credential verified, completing setup');
      onComplete(credentialId);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Connect Google Sheets</h2>
        <p className="text-muted-foreground">
          First, let's connect Google Sheets where your analytics data will be stored
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {savingProgress && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-md flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-500">{savingProgress}</span>
          </div>
        )}

        {step === 'input' && (
          <>
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-medium text-blue-400 mb-2">What you'll need:</h4>
              <ul className="text-sm text-blue-300/80 space-y-1 list-disc list-inside">
                <li>A Google Cloud project with Sheets API enabled</li>
                <li>A service account with Sheets & Drive access</li>
                <li>The service account JSON key file</li>
              </ul>
            </div>
            <CredentialInput
              service="google_sheets"
              onSave={handleCredentialSave}
              onError={setError}
            />
          </>
        )}

        {step === 'verify' && credentialId && (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-green-600">Credential Saved</h4>
                  <p className="text-sm text-green-500/80 mt-1">
                    {credentialName}
                  </p>
                </div>
              </div>
            </div>
            <CredentialVerification
              credentialId={credentialId}
              service="google_sheets"
              onSuccess={handleVerified}
              onError={setError}
            />
          </div>
        )}

        {onSkip && step === 'input' && (
          <div className="mt-4 text-center">
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Service Selection Component
interface ServiceSelectionProps {
  configuredServices: ServiceType[];
  onSelect: (service: ServiceType) => void;
  onComplete: () => void;
  onBack: () => void;
  googleSheetsVerified: boolean;
}

function ServiceSelection({ configuredServices, onSelect, onComplete, onBack, googleSheetsVerified }: ServiceSelectionProps) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Configure Analytics Services</h2>
        <p className="text-muted-foreground">
          Choose which analytics services you want to connect
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {ANALYTICS_SERVICES.map((service) => {
          const isConfigured = configuredServices.includes(service.value);
          const schema = SCHEMA_INFO[service.value];
          
          return (
            <div
              key={service.value}
              className={`bg-card rounded-lg border ${isConfigured ? 'border-green-500/50' : 'border-border'} p-5`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {service.label}
                    {isConfigured && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                </div>
                <Button
                  size="sm"
                  variant={isConfigured ? 'outline' : 'default'}
                  onClick={() => onSelect(service.value)}
                  disabled={!googleSheetsVerified}
                >
                  {isConfigured ? 'Reconfigure' : 'Configure'}
                </Button>
              </div>
              
              {/* Schema preview */}
              <div className="mt-3 p-3 bg-secondary/30 rounded text-xs">
                <span className="text-muted-foreground">Data schema: </span>
                <span className="font-mono text-foreground/70">
                  {schema.columns.join(', ')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {!googleSheetsVerified && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-amber-500">Configure Google Sheets first to enable analytics services</span>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button className="flex-1" onClick={onComplete}>
          Continue to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Analytics Service Setup Component
interface AnalyticsServiceSetupProps {
  service: ServiceType;
  googleSheetsCredentialId: string;
  onComplete: () => void;
  onBack: () => void;
  saveCredential: (data: any) => Promise<any>;
  verifyCredential: (id: string) => Promise<any>;
  saveSheetMapping: (data: any) => Promise<any>;
}

function AnalyticsServiceSetup({
  service,
  googleSheetsCredentialId,
  onComplete,
  onBack,
  saveCredential,
  saveSheetMapping,
}: AnalyticsServiceSetupProps) {
  const [step, setStep] = useState<'credentials' | 'verify' | 'sheet'>('credentials');
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [credentialName, setCredentialName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState('');

  const serviceLabel = ANALYTICS_SERVICES.find(s => s.value === service)?.label || service;
  const schema = SCHEMA_INFO[service];

  const handleCredentialSave = async (data: { name: string; type: CredentialType; credentials: string }) => {
    setError(null);
    setSavingProgress('Saving credentials...');
    try {
      console.log(`[Onboarding] Saving ${service} credential:`, { name: data.name });
      const credential = await saveCredential({
        service,
        name: data.name,
        type: data.type,
        credentials: data.credentials,
      });
      console.log(`[Onboarding] ${service} credential saved:`, credential);
      setCredentialId(credential.id);
      setCredentialName(credential.name);
      setSavingProgress('Credential saved! Verifying...');
      setStep('verify');
    } catch (err) {
      console.error(`[Onboarding] Failed to save ${service} credential:`, err);
      setSavingProgress('');
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    }
  };

  const handleVerified = () => {
    setSavingProgress('');
    setStep('sheet');
  };

  const handleSheetSelect = async (spreadsheetId: string, sheetName: string) => {
    if (!credentialId) return;
    
    setSaving(true);
    setError(null);
    setSavingProgress('Saving sheet configuration...');
    
    try {
      console.log(`[Onboarding] Saving sheet mapping for ${service}:`, { spreadsheetId, sheetName });
      await saveSheetMapping({
        service,
        credential_id: credentialId,
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
      });
      console.log(`[Onboarding] Sheet mapping saved for ${service}`);
      setSavingProgress('');
      onComplete();
    } catch (err) {
      console.error(`[Onboarding] Failed to save sheet mapping for ${service}:`, err);
      setSavingProgress('');
      setError(err instanceof Error ? err.message : 'Failed to save sheet mapping');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          <StepDot active={step === 'credentials'} completed={!!credentialId} label="Credentials" />
          <StepDot active={step === 'verify'} completed={step === 'sheet'} label="Verify" />
          <StepDot active={step === 'sheet'} completed={false} label="Sheet" />
        </div>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Configure {serviceLabel}</h2>
        <p className="text-muted-foreground">
          {step === 'credentials' && 'Enter your API credentials'}
          {step === 'verify' && 'Verify your credentials work'}
          {step === 'sheet' && 'Select the Google Sheet to store data'}
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {savingProgress && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-md flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-500">{savingProgress}</span>
          </div>
        )}

        {step === 'credentials' && (
          <>
            <ServiceCredentialHelp service={service} />
            <CredentialInput
              service={service}
              onSave={handleCredentialSave}
              onError={setError}
            />
          </>
        )}

        {step === 'verify' && credentialId && (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-green-600">Credential Saved</h4>
                  <p className="text-sm text-green-500/80 mt-1">
                    {credentialName}
                  </p>
                </div>
              </div>
            </div>
            <CredentialVerification
              credentialId={credentialId}
              service={service}
              onSuccess={handleVerified}
              onError={setError}
            />
          </div>
        )}

        {step === 'sheet' && (
          <>
            <div className="mb-6 p-4 bg-secondary/50 rounded-lg">
              <h4 className="font-medium text-foreground mb-2">Expected Data Schema</h4>
              <p className="text-xs text-muted-foreground mb-2">
                The sheet will be validated/created with these columns:
              </p>
              <div className="font-mono text-xs text-foreground/70 bg-background p-2 rounded">
                {schema.columns.join(' | ')}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Suggested sheet name: <span className="font-mono">{schema.defaultSheet}</span>
              </p>
            </div>
            <SheetSelector
              credentialId={googleSheetsCredentialId}
              onSelect={handleSheetSelect}
            />
            {saving && (
              <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving configuration...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Helper Components
function StepDot({ active, completed, label }: { active: boolean; completed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className={`w-2 h-2 rounded-full ${
          completed ? 'bg-green-500' : active ? 'bg-primary' : 'bg-muted'
        }`}
      />
      <span className={`text-xs ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

function ServiceCredentialHelp({ service }: { service: ServiceType }) {
  const help: Record<ServiceType, { title: string; steps: string[] }> = {
    google_sheets: { title: '', steps: [] },
    meta: {
      title: 'Meta API Setup',
      steps: [
        'Go to Meta Business Suite → Settings',
        'Navigate to Users → System Users',
        'Create or select a system user',
        'Generate an access token with ads_read permission',
        'Find your Ad Account ID in Ads Manager',
      ],
    },
    ga4: {
      title: 'Google Analytics 4 Setup',
      steps: [
        'Go to Google Analytics Admin',
        'Copy your Property ID from Property Settings',
        'For OAuth: Create OAuth credentials in Google Cloud',
        'For Service Account: Share GA4 property with service account',
      ],
    },
    shopify: {
      title: 'Shopify API Setup',
      steps: [
        'Go to Shopify Admin → Settings → Apps',
        'Click "Develop apps" → Create an app',
        'Configure Admin API scopes: read_orders, read_customers, read_reports',
        'Install the app and copy the access token',
      ],
    },
  };

  const serviceHelp = help[service];
  if (!serviceHelp.title) return null;

  return (
    <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
      <h4 className="font-medium text-blue-400 mb-2">{serviceHelp.title}</h4>
      <ol className="text-sm text-blue-300/80 space-y-1 list-decimal list-inside">
        {serviceHelp.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

// Setup Complete Component
interface SetupCompleteProps {
  configuredServices: ServiceType[];
  onFinish: () => void;
  onConfigureMore: () => void;
}

function SetupComplete({ configuredServices, onFinish, onConfigureMore }: SetupCompleteProps) {
  return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-white" />
      </div>
      
      <h2 className="text-2xl font-bold text-foreground mb-2">Setup Complete!</h2>
      <p className="text-muted-foreground mb-8">
        Your analytics dashboard is ready
      </p>

      {configuredServices.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <h3 className="font-medium text-foreground mb-4">Configured Services:</h3>
          <div className="space-y-2">
            {configuredServices.map(service => (
              <div key={service} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-foreground">
                  {ANALYTICS_SERVICES.find(s => s.value === service)?.label || service}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onConfigureMore}>
          Configure More Services
        </Button>
        <Button className="flex-1" onClick={onFinish}>
          Go to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
