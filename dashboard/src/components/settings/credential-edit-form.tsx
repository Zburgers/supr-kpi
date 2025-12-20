/**
 * Credential Edit Form - Update existing credentials
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Save, X, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCredentials } from '@/hooks/useCredentials';
import type { Credential, CredentialType } from '@/types/api';

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
  const [credential, setCredential] = useState<Credential | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CredentialType>('service_account');
  const [credentials, setCredentials] = useState('');
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
      setCredentials(content);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, []);

  const handleTestAndSave = useCallback(async () => {
    if (!credentials.trim()) {
      setError('Please provide credentials');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      // First, update the credential
      await updateCredential(credentialId, {
        name: name.trim(),
        type,
        credentials: credentials.trim(),
      });

      // Then verify it
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
  }, [credentialId, name, type, credentials, updateCredential, verifyCredential, onSave]);

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
        <h3 className="text-lg font-semibold mb-2">Update Credential</h3>
        <p className="text-sm text-gray-600">
          Update your {service} credentials. The connection will be tested before saving.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={saving || testing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Credential Type</Label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as CredentialType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <p className="text-xs text-gray-500">
            Or paste credentials below
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="credentials">Credentials</Label>
          <textarea
            id="credentials"
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm min-h-[150px]"
            placeholder="Paste your credentials here..."
            disabled={saving || testing}
          />
          {credentials && (
            <div className="text-xs text-gray-500">
              {credentials.length} characters
            </div>
          )}
        </div>

        {testing && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-sm text-blue-700">Verifying credentials...</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleTestAndSave}
          disabled={saving || testing || !credentials.trim()}
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

      <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-md">
        <strong>Security:</strong> Credentials are encrypted before storage. Your original credentials
        are never displayed in the UI after saving.
      </div>
    </div>
  );
}
