/**
 * Custom hook for managing credentials
 *
 * Uses centralized fetchApi for authentication (Clerk JWT)
 */

import { useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import type {
  Credential,
  CredentialCreateRequest,
  CredentialVerificationResponse,
} from '@/types/api';

export function useCredentials() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCredentials = useCallback(async (): Promise<Credential[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<Credential[]>('/credentials/list');
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch credentials');
      }
      return (result as { success: true; data: Credential[] }).data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch credentials';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveCredential = useCallback(
    async (request: CredentialCreateRequest): Promise<Credential> => {
      setLoading(true);
      setError(null);
      try {
        // Map frontend fields to backend fields
        const requestBody = {
          service: request.service,
          credentialName: request.name,
          credentialJson: request.credentials,
        };

        const result = await fetchApi<Credential>('/credentials/save', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        if (!result.success) {
          throw new Error(result.error || 'Failed to save credential');
        }
        const data = (result as { success: true; data: Credential }).data;
        if (!data) {
          throw new Error('No credential data returned');
        }
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save credential';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const verifyCredential = useCallback(
    async (credentialId: string): Promise<CredentialVerificationResponse> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchApi<CredentialVerificationResponse>(
          `/credentials/${credentialId}/verify`,
          { method: 'POST' }
        );
        if (!result.success) {
          throw new Error(result.error || 'Failed to verify credential');
        }
        return (result as { success: true; data: CredentialVerificationResponse }).data || { success: false, verified: false };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to verify credential';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateCredential = useCallback(
    async (credentialId: string, request: Partial<CredentialCreateRequest>): Promise<Credential> => {
      setLoading(true);
      setError(null);
      try {
        // Map frontend fields to backend fields (only include fields that are provided)
        const requestBody: any = {};
        if (request.service !== undefined) requestBody.service = request.service;
        if (request.name !== undefined) requestBody.credentialName = request.name;
        if (request.credentials !== undefined) requestBody.credentialJson = request.credentials;

        const result = await fetchApi<Credential>(`/credentials/${credentialId}`, {
          method: 'PUT',
          body: JSON.stringify(requestBody),
        });
        if (!result.success) {
          throw new Error(result.error || 'Failed to update credential');
        }
        const data = (result as { success: true; data: Credential }).data;
        if (!data) {
          throw new Error('No credential data returned');
        }
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update credential';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteCredential = useCallback(async (credentialId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<void>(`/credentials/${credentialId}`, {
        method: 'DELETE',
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete credential');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete credential';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCredentialStatus = useCallback(
    async (credentialId: string): Promise<Credential> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchApi<Credential>(`/credentials/${credentialId}`);
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch credential status');
        }
        const data = (result as { success: true; data: Credential }).data;
        if (!data) {
          throw new Error('No credential data returned');
        }
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch credential status';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    getCredentials,
    saveCredential,
    verifyCredential,
    updateCredential,
    deleteCredential,
    getCredentialStatus,
  };
}
