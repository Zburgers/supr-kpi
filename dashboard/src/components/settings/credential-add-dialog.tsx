/**
 * Credential Add Dialog - Service-specific credential configuration
 * 
 * Supports:
 * - Google Sheets: Service Account JSON
 * - Meta: Access Token + Account ID
 * - GA4: OAuth 2.0 or Service Account
 * - Shopify: Personal Access Token + Store Domain
 */

import { useState, useCallback } from 'react';
import { Upload, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCredentials } from '@/hooks/useCredentials';
import type { ServiceType, CredentialType } from '@/types/api';

interface CredentialAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SERVICE_OPTIONS: { value: ServiceType; label: string; description: string }[] = [
  {
    value: 'google_sheets',
    label: 'Google Sheets',
    description: 'Service account for storing analytics data',
  },
  {
    value: 'meta',
    label: 'Meta (Facebook)',
    description: 'Graph API access for ad insights',
  },
  {
    value: 'ga4',
    label: 'Google Analytics 4',
    description: 'Analytics data for sessions, users, and revenue',
  },
  {
    value: 'shopify',
    label: 'Shopify',
    description: 'GraphQL API for order and customer data',
  },
];

export function CredentialAddDialog({ open, onOpenChange, onSuccess }: CredentialAddDialogProps) {
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);

  const handleClose = () => {
    setSelectedService(null);
    onOpenChange(false);
  };

  const handleServiceComplete = () => {
    setSelectedService(null);
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedService ? `Configure ${SERVICE_OPTIONS.find(s => s.value === selectedService)?.label}` : 'Add New Credential'}
          </DialogTitle>
          <DialogDescription>
            {selectedService 
              ? 'Enter your credentials to connect this service'
              : 'Choose a service to configure'}
          </DialogDescription>
        </DialogHeader>

        {!selectedService ? (
          <ServiceSelector onSelect={setSelectedService} />
        ) : (
          <ServiceCredentialForm
            service={selectedService}
            onBack={() => setSelectedService(null)}
            onSuccess={handleServiceComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Service Selector Component
interface ServiceSelectorProps {
  onSelect: (service: ServiceType) => void;
}

function ServiceSelector({ onSelect }: ServiceSelectorProps) {
  return (
    <div className="grid gap-3 py-4">
      {SERVICE_OPTIONS.map((service) => (
        <button
          key={service.value}
          onClick={() => onSelect(service.value)}
          className="flex flex-col items-start p-4 rounded-lg border border-border bg-card hover:bg-secondary/50 hover:border-primary transition-colors text-left"
        >
          <div className="font-semibold text-foreground">{service.label}</div>
          <div className="text-sm text-muted-foreground mt-1">{service.description}</div>
        </button>
      ))}
    </div>
  );
}

// Service Credential Form Component
interface ServiceCredentialFormProps {
  service: ServiceType;
  onBack: () => void;
  onSuccess: () => void;
}

function ServiceCredentialForm({ service, onBack, onSuccess }: ServiceCredentialFormProps) {
  switch (service) {
    case 'google_sheets':
      return <GoogleSheetsForm onBack={onBack} onSuccess={onSuccess} />;
    case 'meta':
      return <MetaForm onBack={onBack} onSuccess={onSuccess} />;
    case 'ga4':
      return <GA4Form onBack={onBack} onSuccess={onSuccess} />;
    case 'shopify':
      return <ShopifyForm onBack={onBack} onSuccess={onSuccess} />;
    default:
      return null;
  }
}

// Google Sheets Form
interface FormProps {
  onBack: () => void;
  onSuccess: () => void;
}

function GoogleSheetsForm({ onBack, onSuccess }: FormProps) {
  const [name, setName] = useState('Google Sheets Service Account');
  const [jsonContent, setJsonContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { saveCredential, verifyCredential } = useCredentials();

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        JSON.parse(content);
        setJsonContent(content);
        setError(null);
      } catch {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please provide a name');
      return;
    }
    if (!jsonContent.trim()) {
      setError('Please upload or paste service account JSON');
      return;
    }

    try {
      JSON.parse(jsonContent);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const credential = await saveCredential({
        service: 'google_sheets',
        name: name.trim(),
        type: 'service_account',
        credentials: jsonContent.trim(),
      });

      await verifyCredential(credential.id);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h4 className="font-medium text-blue-400 mb-2">Setup Instructions</h4>
        <ol className="text-sm text-blue-300/80 space-y-1 list-decimal list-inside">
          <li>Go to Google Cloud Console</li>
          <li>Create or select a project</li>
          <li>Enable Google Sheets API</li>
          <li>Create a Service Account</li>
          <li>Download the JSON key file</li>
          <li>Share your spreadsheet with the service account email</li>
        </ol>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Credential Name</Label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <Label>Service Account JSON</Label>
        <div className="flex gap-2">
          <input
            type="file"
            id="sa-file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
            disabled={saving}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('sa-file')?.click()}
            disabled={saving}
            className="flex-1"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload JSON File
          </Button>
        </div>
        <textarea
          value={jsonContent}
          onChange={(e) => setJsonContent(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono text-sm min-h-[150px] focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder='{"type": "service_account", ...}'
          disabled={saving}
        />
        {jsonContent && (
          <div className="text-xs text-muted-foreground">
            {jsonContent.length} characters
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save & Verify
        </Button>
      </div>
    </div>
  );
}

// Meta (Facebook) Form
function MetaForm({ onBack, onSuccess }: FormProps) {
  const [name, setName] = useState('Meta Ads Account');
  const [accessToken, setAccessToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { saveCredential, verifyCredential } = useCredentials();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please provide a name');
      return;
    }
    if (!accessToken.trim()) {
      setError('Please enter your access token');
      return;
    }
    if (!accountId.trim()) {
      setError('Please enter your ad account ID');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const credentialJson = JSON.stringify({
        access_token: accessToken.trim(),
        account_id: accountId.trim().replace(/^act_/, ''),
      });

      const credential = await saveCredential({
        service: 'meta',
        name: name.trim(),
        type: 'api_key',
        credentials: credentialJson,
      });

      await verifyCredential(credential.id);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h4 className="font-medium text-blue-400 mb-2">Setup Instructions</h4>
        <ol className="text-sm text-blue-300/80 space-y-1 list-decimal list-inside">
          <li>Go to Meta Business Suite → Settings</li>
          <li>Navigate to Users → System Users</li>
          <li>Create a system user with Admin access</li>
          <li>Generate an access token with ads_read permission</li>
          <li>Find your Ad Account ID in Ads Manager settings</li>
        </ol>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="meta-name">Credential Name</Label>
        <input
          id="meta-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="access-token">Access Token</Label>
        <div className="relative">
          <input
            id="access-token"
            type={showToken ? 'text' : 'password'}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="w-full px-3 py-2 pr-10 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="EAAxxxxxxx..."
            disabled={saving}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="account-id">Ad Account ID</Label>
        <input
          id="account-id"
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="act_123456789 or 123456789"
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">
          The act_ prefix is optional
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save & Verify
        </Button>
      </div>
    </div>
  );
}

// GA4 Form
function GA4Form({ onBack, onSuccess }: FormProps) {
  const [authType, setAuthType] = useState<'oauth' | 'service_account'>('oauth');
  const [name, setName] = useState('Google Analytics 4');
  const [propertyId, setPropertyId] = useState('');
  
  // OAuth fields
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  
  // Service Account fields
  const [jsonContent, setJsonContent] = useState('');
  
  const [showSecrets, setShowSecrets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { saveCredential, verifyCredential } = useCredentials();

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        JSON.parse(content);
        setJsonContent(content);
        setError(null);
      } catch {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please provide a name');
      return;
    }
    if (!propertyId.trim()) {
      setError('Please enter your GA4 Property ID');
      return;
    }

    if (authType === 'oauth') {
      if (!clientId.trim() || !clientSecret.trim() || !refreshToken.trim()) {
        setError('Please fill in all OAuth fields');
        return;
      }
    } else {
      if (!jsonContent.trim()) {
        setError('Please upload service account JSON');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      let credentialJson: string;
      let credentialType: CredentialType;

      if (authType === 'oauth') {
        credentialJson = JSON.stringify({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          refresh_token: refreshToken.trim(),
          property_id: propertyId.trim(),
        });
        credentialType = 'oauth_token';
      } else {
        const parsed = JSON.parse(jsonContent);
        credentialJson = JSON.stringify({
          ...parsed,
          property_id: propertyId.trim(),
        });
        credentialType = 'service_account';
      }

      const credential = await saveCredential({
        service: 'ga4',
        name: name.trim(),
        type: credentialType,
        credentials: credentialJson,
      });

      await verifyCredential(credential.id);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h4 className="font-medium text-blue-400 mb-2">Setup Instructions</h4>
        <ol className="text-sm text-blue-300/80 space-y-1 list-decimal list-inside">
          <li>Go to Google Analytics Admin</li>
          <li>Find your Property ID in Property Settings</li>
          <li>For OAuth: Create OAuth credentials in Google Cloud Console</li>
          <li>For Service Account: Create and share access with GA4 property</li>
        </ol>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      <Tabs value={authType} onValueChange={(v) => setAuthType(v as 'oauth' | 'service_account')}>
        <TabsList className="w-full">
          <TabsTrigger value="oauth" className="flex-1">OAuth 2.0</TabsTrigger>
          <TabsTrigger value="service_account" className="flex-1">Service Account</TabsTrigger>
        </TabsList>

        <TabsContent value="oauth" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="ga4-name-oauth">Credential Name</Label>
            <input
              id="ga4-name-oauth"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="property-id-oauth">GA4 Property ID</Label>
            <input
              id="property-id-oauth"
              type="text"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="123456789"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID</Label>
            <input
              id="client-id"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="xxxxx.apps.googleusercontent.com"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-secret">Client Secret</Label>
            <div className="relative">
              <input
                id="client-secret"
                type={showSecrets ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refresh-token">Refresh Token</Label>
            <input
              id="refresh-token"
              type={showSecrets ? 'text' : 'password'}
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving}
            />
          </div>
        </TabsContent>

        <TabsContent value="service_account" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="ga4-name-sa">Credential Name</Label>
            <input
              id="ga4-name-sa"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="property-id-sa">GA4 Property ID</Label>
            <input
              id="property-id-sa"
              type="text"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="123456789"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label>Service Account JSON</Label>
            <div className="flex gap-2">
              <input
                type="file"
                id="ga4-sa-file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={saving}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('ga4-sa-file')?.click()}
                disabled={saving}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload JSON File
              </Button>
            </div>
            <textarea
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder='{"type": "service_account", ...}'
              disabled={saving}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save & Verify
        </Button>
      </div>
    </div>
  );
}

// Shopify Form
function ShopifyForm({ onBack, onSuccess }: FormProps) {
  const [name, setName] = useState('Shopify Store');
  const [storeDomain, setStoreDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { saveCredential, verifyCredential } = useCredentials();

  const formatStoreDomain = (input: string): string => {
    let domain = input.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//i, '');
    domain = domain.split('/')[0];
    if (!domain.endsWith('.myshopify.com') && !domain.includes('.')) {
      domain = `${domain}.myshopify.com`;
    }
    return domain;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please provide a name');
      return;
    }
    if (!storeDomain.trim()) {
      setError('Please enter your store domain');
      return;
    }
    if (!accessToken.trim()) {
      setError('Please enter your access token');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const credentialJson = JSON.stringify({
        shop_url: formatStoreDomain(storeDomain),
        access_token: accessToken.trim(),
      });

      const credential = await saveCredential({
        service: 'shopify',
        name: name.trim(),
        type: 'api_key',
        credentials: credentialJson,
      });

      await verifyCredential(credential.id);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h4 className="font-medium text-blue-400 mb-2">Setup Instructions</h4>
        <ol className="text-sm text-blue-300/80 space-y-1 list-decimal list-inside">
          <li>Go to Shopify Admin → Settings → Apps and sales channels</li>
          <li>Click "Develop apps" → Create an app</li>
          <li>Configure Admin API scopes: read_orders, read_customers, read_reports</li>
          <li>Install the app and copy the Admin API access token</li>
        </ol>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="shopify-name">Credential Name</Label>
        <input
          id="shopify-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="store-domain">Store Domain</Label>
        <input
          id="store-domain"
          type="text"
          value={storeDomain}
          onChange={(e) => setStoreDomain(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="your-store.myshopify.com"
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">
          Enter your store name or full domain (e.g., my-store or my-store.myshopify.com)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shopify-token">Admin API Access Token</Label>
        <div className="relative">
          <input
            id="shopify-token"
            type={showToken ? 'text' : 'password'}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="w-full px-3 py-2 pr-10 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="shpat_xxxxxxxxxx"
            disabled={saving}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save & Verify
        </Button>
      </div>
    </div>
  );
}
