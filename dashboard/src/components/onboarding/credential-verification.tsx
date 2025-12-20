/**
 * Credential Verification Component - Tests and verifies saved credentials
 */

import { useState, useCallback } from 'react';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCredentials } from '@/hooks/useCredentials';

interface CredentialVerificationProps {
  credentialId: string;
  service: string;
  onSuccess: (metadata?: { email?: string; account_name?: string }) => void;
  onError: (error: string) => void;
}

export function CredentialVerification({
  credentialId,
  service,
  onSuccess,
  onError,
}: CredentialVerificationProps) {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');
  const [metadata, setMetadata] = useState<{ email?: string; account_name?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { verifyCredential } = useCredentials();

  const handleVerify = useCallback(async () => {
    setStatus('testing');
    setErrorMessage(null);

    try {
      const result = await verifyCredential(credentialId);

      if (result.verified) {
        setStatus('success');
        setMetadata(result.metadata || null);
        onSuccess(result.metadata);
      } else {
        setStatus('failure');
        const error = result.metadata?.error || 'Verification failed';
        setErrorMessage(error);
        onError(error);
      }
    } catch (err) {
      setStatus('failure');
      const error = err instanceof Error ? err.message : 'Failed to verify credential';
      setErrorMessage(error);
      onError(error);
    }
  }, [credentialId, verifyCredential, onSuccess, onError]);

  const handleRetry = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
    setMetadata(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-lg p-6">
        {status === 'idle' && (
          <div className="text-center space-y-4">
            <div className="text-gray-600">
              Ready to verify your {service} credentials
            </div>
            <Button onClick={handleVerify} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Test Connection
            </Button>
          </div>
        )}

        {status === 'testing' && (
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
            <div className="text-gray-600">Testing connection...</div>
            <div className="text-sm text-gray-500">
              This may take a few seconds
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <div className="text-green-600 font-semibold">
              ✓ Connection Successful!
            </div>
            {metadata?.email && (
              <div className="text-sm text-gray-600">
                Connected as: <span className="font-medium">{metadata.email}</span>
              </div>
            )}
            {metadata?.account_name && (
              <div className="text-sm text-gray-600">
                Account: <span className="font-medium">{metadata.account_name}</span>
              </div>
            )}
            <Button onClick={handleVerify} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Test Again
            </Button>
          </div>
        )}

        {status === 'failure' && (
          <div className="text-center space-y-4">
            <XCircle className="w-12 h-12 mx-auto text-red-500" />
            <div className="text-red-600 font-semibold">
              Connection Failed
            </div>
            {errorMessage && (
              <div className="text-sm text-gray-600 bg-red-50 p-3 rounded-md">
                {errorMessage}
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={handleRetry} variant="outline">
                Try Again
              </Button>
              <Button onClick={handleVerify}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Test
              </Button>
            </div>
          </div>
        )}
      </div>

      {status !== 'idle' && (
        <div className="text-xs text-gray-500 text-center">
          Credential ID: {credentialId.slice(0, 8)}...
        </div>
      )}
    </div>
  );
}
