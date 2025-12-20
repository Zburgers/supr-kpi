/**
 * Credential Input Component - Reusable form for entering service credentials
 */

import React, { useState, useCallback } from 'react';
import { Upload, FileText, Key } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { ServiceType, CredentialType } from '@/types/api';

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

export function CredentialInput({ service, onSave, onError, isLoading }: CredentialInputProps) {
  const [name, setName] = useState(`${service} Credentials`);
  const [type, setType] = useState<CredentialType>('service_account');
  const [credentials, setCredentials] = useState('');
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCredentials(content);
      };
      reader.onerror = () => {
        onError('Failed to read file');
      };
      reader.readAsText(file);
    },
    [onError]
  );

  const validateCredentials = useCallback((): boolean => {
    if (!name.trim()) {
      onError('Please provide a name for this credential');
      return false;
    }

    if (!credentials.trim()) {
      onError('Please provide credentials');
      return false;
    }

    // Validate JSON for service accounts
    if (type === 'service_account') {
      try {
        JSON.parse(credentials);
      } catch (err) {
        onError('Invalid JSON format for service account credentials');
        return false;
      }
    }

    return true;
  }, [name, credentials, type, onError]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateCredentials()) return;

      onSave({
        name: name.trim(),
        type,
        credentials: credentials.trim(),
      });
    },
    [validateCredentials, onSave, name, type, credentials]
  );

  const getPlaceholder = () => {
    switch (type) {
      case 'service_account':
        return '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}';
      case 'oauth_token':
        return 'Enter OAuth token...';
      case 'api_key':
        return 'Enter API key...';
      default:
        return 'Enter credentials...';
    }
  };

  const getDescription = () => {
    switch (service) {
      case 'google_sheets':
        return 'Enter your Google Service Account JSON or OAuth token';
      case 'meta':
        return 'Enter your Meta API access token';
      case 'ga4':
        return 'Enter your Google Analytics 4 service account JSON';
      case 'shopify':
        return 'Enter your Shopify API access token';
      default:
        return 'Enter your credentials';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="credential-name">Credential Name</Label>
        <input
          id="credential-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`My ${service} Account`}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="credential-type">Credential Type</Label>
        <select
          id="credential-type"
          value={type}
          onChange={(e) => setType(e.target.value as CredentialType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option value="service_account">Service Account (JSON)</option>
          <option value="oauth_token">OAuth Token</option>
          <option value="api_key">API Key</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>Input Method</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={inputMethod === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInputMethod('text')}
            disabled={isLoading}
          >
            <FileText className="w-4 h-4 mr-2" />
            Text Input
          </Button>
          <Button
            type="button"
            variant={inputMethod === 'file' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInputMethod('file')}
            disabled={isLoading}
          >
            <Upload className="w-4 h-4 mr-2" />
            File Upload
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="credentials">{getDescription()}</Label>
        {inputMethod === 'text' ? (
          <div className="relative">
            <textarea
              id="credentials"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm min-h-[200px]"
              placeholder={getPlaceholder()}
              disabled={isLoading}
            />
            {credentials && (
              <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                {credentials.length} characters
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="file"
              id="file-upload"
              accept=".json,.txt"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isLoading}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </Button>
          </div>
        )}
        {credentials && inputMethod === 'file' && (
          <div className="text-sm text-green-600 flex items-center gap-2">
            <Key className="w-4 h-4" />
            File loaded ({credentials.length} characters)
          </div>
        )}
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Saving...' : 'Save Credential'}
      </Button>
    </form>
  );
}
