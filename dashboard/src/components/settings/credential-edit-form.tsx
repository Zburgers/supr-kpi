/**
 * Credential Edit Form - Update existing credentials
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Save, X, Upload, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCredentials } from '@/hooks/useCredentials';
import type { Credential, CredentialType, ServiceType } from '@/types/api';

interface CredentialEditFormProps {
  credentialId: string;
  service: string;
  onSave: () => void;
  onCancel: () => void;
}

export function CredentialEditForm({
  credentialId,
  service,
  onSave,
  onCancel,
}: CredentialEditFormProps) {
  const isMeta = service === 'meta';
  const isGoogle = service === 'google_sheets';
  const isGA4 = service === 'ga4';
  const isShopify = service === 'shopify';
  const [credential, setCredential] = useState<Credential | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CredentialType>('service_account');
  const [credentials, setCredentials] = useState('');
  // Meta fields
  const [accessToken, setAccessToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Google Sheets fields
  const [jsonContent, setJsonContent] = useState('');

  // GA4 fields
  const [authType, setAuthType] = useState<'oauth' | 'service_account'>('oauth');
  const [propertyId, setPropertyId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [ga4ShowSecrets, setGa4ShowSecrets] = useState(false);

  // Shopify fields
  const [shopDomain, setShopDomain] = useState('');
  const [shopAccessToken, setShopAccessToken] = useState('');
  const [shopShowToken, setShopShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getCredentialStatus, updateCredential, verifyCredential } = useCredentials();

  useEffect(() => {
    const loadCredential = async () => {
      try {
        const data = await getCredentialStatus(credentialId);
        setCredential(data);
        setName(data.name);
        setType(data.type);

        if (data.service === 'meta') {
          const metaAccountId = (data.metadata as Record<string, unknown> | undefined)?.account_id as string | undefined;
          if (metaAccountId) {
            setAccountId(metaAccountId);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load credential');
      }
    };

    loadCredential();
  }, [credentialId, getCredentialStatus]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (isGoogle) {
        setJsonContent(content);
      } else if (isGA4) {
        setJsonContent(content);
      } else {
        setCredentials(content);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, [isGoogle, isGA4]);

  const handleTestAndSave = useCallback(async () => {
    setError(null);

    if (!name.trim()) {
      setError('Please provide a credential name');
      return;
    }

    if (isMeta) {
      if (!accessToken.trim()) {
        setError('Please enter your access token');
        return;
      }
      if (!accountId.trim()) {
        setError('Please enter your ad account ID');
        return;
      }
    }

    if (isGoogle) {
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
    }

    if (isGA4) {
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
        try {
          JSON.parse(jsonContent);
        } catch {
          setError('Invalid JSON format');
          return;
        }
      }
    }

    if (isShopify) {
      if (!shopDomain.trim()) {
        setError('Please enter your store domain');
        return;
      }
      if (!shopAccessToken.trim()) {
        setError('Please enter your access token');
        return;
      }
    }

    setSaving(true);

    try {
      if (isMeta) {
        const normalizedAccountId = accountId.trim().replace(/^act_/, '');
        await updateCredential(credentialId, {
          name: name.trim(),
          service: 'meta' as ServiceType,
          type: 'api_key',
          credentials: JSON.stringify({
            access_token: accessToken.trim(),
            account_id: normalizedAccountId,
          }),
        });
      } else if (isGoogle) {
        await updateCredential(credentialId, {
          name: name.trim(),
          service: 'google_sheets' as ServiceType,
          type: 'service_account',
          credentials: jsonContent.trim(),
        });
      } else if (isGA4) {
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
        await updateCredential(credentialId, {
          name: name.trim(),
          service: 'ga4' as ServiceType,
          type: credentialType,
          credentials: credentialJson,
        });
      } else if (isShopify) {
        const formatStoreDomain = (input: string): string => {
          let domain = input.trim().toLowerCase();
          domain = domain.replace(/^https?:\/\//i, '');
          domain = domain.split('/')[0];
          if (!domain.endsWith('.myshopify.com') && !domain.includes('.')) {
            domain = `${domain}.myshopify.com`;
          }
          return domain;
        };
        await updateCredential(credentialId, {
          name: name.trim(),
          service: 'shopify' as ServiceType,
          type: 'api_key',
          credentials: JSON.stringify({
            shop_url: formatStoreDomain(shopDomain),
            access_token: shopAccessToken.trim(),
          }),
        });
      } else {
        await updateCredential(credentialId, {
          name: name.trim(),
          type,
          credentials: credentials.trim(),
        });
      }

      setTesting(true);
      const result = await verifyCredential(credentialId);
      setTesting(false);

      if (!result.verified) {
        throw new Error(result.metadata?.error || 'Verification failed');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
      setTesting(false);
    }
  }, [
    accountId,
    accessToken,
    credentialId,
    credentials,
    isMeta,
    name,
    type,
    updateCredential,
    verifyCredential,
    onSave,
  ]);

  if (!credential) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-foreground">Update Credential</h3>
        <p className="text-sm text-muted-foreground">
          Update your {service} credentials. The connection will be tested before saving.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Credential Name</Label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            disabled={saving || testing}
          />
        </div>

        {isMeta ? (
          <>
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-medium text-blue-200 mb-2">Setup Instructions</h4>
              <ol className="text-sm text-blue-100/80 space-y-1 list-decimal list-inside">
                <li>Go to Meta Business Suite → Settings</li>
                <li>Navigate to Users → System Users</li>
                <li>Create a system user with Admin access</li>
                <li>Generate an access token with ads_read permission</li>
                <li>Find your Ad Account ID in Ads Manager settings</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-token">Access Token</Label>
              <div className="relative">
                <input
                  id="access-token"
                  type={showToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="EAAxxxxxxx..."
                  disabled={saving || testing}
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
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="act_123456789 or 123456789"
                disabled={saving || testing}
              />
              <p className="text-xs text-muted-foreground">The act_ prefix is optional</p>
            </div>
          </>
        ) : isGoogle ? (
          <>
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <h4 className="font-medium text-green-200 mb-2">Service Account JSON</h4>
              <p className="text-sm text-green-100/80">Upload or paste your Google service account JSON. Ensure the account has access to your spreadsheet.</p>
            </div>

            <div className="space-y-2">
              <Label>Service Account JSON</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="file-upload-edit"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={saving || testing}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload-edit')?.click()}
                  disabled={saving || testing}
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
                placeholder='{"type":"service_account", ...}'
                disabled={saving || testing}
              />
              {jsonContent && <div className="text-xs text-muted-foreground">{jsonContent.length} characters</div>}
            </div>
          </>
        ) : isGA4 ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="property-id">GA4 Property ID</Label>
              <input
                id="property-id"
                type="text"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="123456789"
                disabled={saving || testing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ga4-auth-type">Authentication Type</Label>
              <select
                id="ga4-auth-type"
                value={authType}
                onChange={(e) => setAuthType(e.target.value as 'oauth' | 'service_account')}
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={saving || testing}
              >
                <option value="oauth">OAuth 2.0</option>
                <option value="service_account">Service Account</option>
              </select>
            </div>

            {authType === 'oauth' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="client-id">Client ID</Label>
                  <input
                    id="client-id"
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={saving || testing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-secret">Client Secret</Label>
                  <div className="relative">
                    <input
                      id="client-secret"
                      type={ga4ShowSecrets ? 'text' : 'password'}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="w-full px-3 py-2 pr-10 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={saving || testing}
                    />
                    <button
                      type="button"
                      onClick={() => setGa4ShowSecrets(!ga4ShowSecrets)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {ga4ShowSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refresh-token">Refresh Token</Label>
                  <input
                    id="refresh-token"
                    type={ga4ShowSecrets ? 'text' : 'password'}
                    value={refreshToken}
                    onChange={(e) => setRefreshToken(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={saving || testing}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Service Account JSON</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="ga4-file-upload-edit"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={saving || testing}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('ga4-file-upload-edit')?.click()}
                      disabled={saving || testing}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload JSON File
                    </Button>
                  </div>
                  <textarea
                    value={jsonContent}
                    onChange={(e) => setJsonContent(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder='{"type":"service_account", ...}'
                    disabled={saving || testing}
                  />
                </div>
              </>
            )}
          </>
        ) : isShopify ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="shop-domain">Store Domain</Label>
              <input
                id="shop-domain"
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="your-store.myshopify.com"
                disabled={saving || testing}
              />
              <p className="text-xs text-muted-foreground">Enter your store name or full domain (e.g., my-store or my-store.myshopify.com)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-token">Admin API Access Token</Label>
              <div className="relative">
                <input
                  id="shop-token"
                  type={shopShowToken ? 'text' : 'password'}
                  value={shopAccessToken}
                  onChange={(e) => setShopAccessToken(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-md border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={saving || testing}
                />
                <button
                  type="button"
                  onClick={() => setShopShowToken(!shopShowToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {shopShowToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="type">Credential Type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as CredentialType)}
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                disabled={saving || testing}
              >
                <option value="service_account">Service Account (JSON)</option>
                <option value="oauth_token">OAuth Token</option>
                <option value="api_key">API Key</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Upload New Credentials</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="file-upload-edit"
                  accept=".json,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={saving || testing}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload-edit')?.click()}
                  disabled={saving || testing}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Or paste credentials below</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="credentials">Credentials</Label>
              <textarea
                id="credentials"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground font-mono text-sm min-h-[150px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Paste your credentials here..."
                disabled={saving || testing}
              />
              {credentials && (
                <div className="text-xs text-muted-foreground">{credentials.length} characters</div>
              )}
            </div>
          </>
        )}

        {testing && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-foreground">Verifying credentials...</span>
          </div>
        )}
      </div>

      {(() => {
        const canSave = (() => {
          if (isMeta) {
            return !!(name.trim() && accessToken.trim() && accountId.trim());
          }
          if (isGoogle) {
            return !!(name.trim() && jsonContent.trim());
          }
          if (isGA4) {
            if (!name.trim() || !propertyId.trim()) return false;
            if (authType === 'oauth') {
              return !!(clientId.trim() && clientSecret.trim() && refreshToken.trim());
            }
            return !!jsonContent.trim();
          }
          if (isShopify) {
            return !!(name.trim() && shopDomain.trim() && shopAccessToken.trim());
          }
          return !!(name.trim() && credentials.trim());
        })();

        return (
          <div className="flex gap-3">
            <Button
              onClick={handleTestAndSave}
              disabled={saving || testing || !canSave}
              className="flex-1"
            >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Test & Save
            </>
          )}
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              disabled={saving || testing}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        );
      })()}

      <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-md border border-border/60">
        <strong>Security:</strong> Credentials are encrypted before storage. Your original credentials
        are never displayed in the UI after saving.
      </div>
    </div>
  );
}
