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
      console.log('[useCredentials] Fetching credentials list...');
      const result = await fetchApi<Credential[]>('/credentials/list');
      console.log('[useCredentials] Response received:', result);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch credentials');
      }
      const credentials = (result as { success: true; data: Credential[] }).data || [];
      console.log('[useCredentials] Fetched credentials:', credentials);
      return credentials;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch credentials';
      console.error('[useCredentials] Error:', message, err);
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

        console.log('[useCredentials] Saving credential:', { service: request.service, name: request.name });
        const result = await fetchApi<any>('/credentials/save', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        console.log('[useCredentials] Save response:', result);
        if (!result.success) {
          throw new Error(result.error || 'Failed to save credential');
        }

        const responseData = (result as { success: true; data: any }).data;
        if (!responseData) {
          throw new Error('No credential data returned');
        }

        // Map backend response format to frontend Credential format
        const credential: Credential = {
          id: responseData.credentialId || responseData.id,
          service: responseData.service,
          name: responseData.name,
          type: responseData.type,
          verified: responseData.verified,
          verified_at: responseData.verified_at || null,
          created_at: responseData.created_at,
          updated_at: responseData.updated_at || responseData.created_at,
          metadata: responseData.metadata,
        };

        console.log('[useCredentials] Credential saved successfully:', credential);
        return credential;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save credential';
        console.error('[useCredentials] Save error:', message, err);
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
      if (!credentialId || credentialId === 'undefined' || credentialId === 'null') {
        throw new Error('Invalid credential ID provided for verification');
      }

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
      if (!credentialId || credentialId === 'undefined' || credentialId === 'null') {
        throw new Error('Invalid credential ID provided for update');
      }

      setLoading(true);
      setError(null);
      try {
        // Map frontend fields to backend fields (only include fields that are provided)
        const requestBody: any = {};
        if (request.service !== undefined) requestBody.service = request.service;
        if (request.name !== undefined) requestBody.credentialName = request.name;
        if (request.credentials !== undefined) requestBody.credentialJson = request.credentials;

        const result = await fetchApi<any>(`/credentials/${credentialId}`, {
          method: 'PUT',
          body: JSON.stringify(requestBody),
        });
        if (!result.success) {
          throw new Error(result.error || 'Failed to update credential');
        }
        const responseData = (result as { success: true; data: any }).data;
        if (!responseData) {
          throw new Error('No credential data returned');
        }

        // Map backend response format to frontend Credential format
        const credential: Credential = {
          id: responseData.id,
          service: responseData.service,
          name: responseData.name,
          type: responseData.type,
          verified: responseData.verified,
          verified_at: responseData.verified_at || null,
          created_at: responseData.created_at,
          updated_at: responseData.updated_at || responseData.created_at,
          metadata: responseData.metadata,
        };

        return credential;
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
    if (!credentialId || credentialId === 'undefined' || credentialId === 'null') {
      throw new Error('Invalid credential ID provided for deletion');
    }

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
      if (!credentialId || credentialId === 'undefined' || credentialId === 'null') {
        throw new Error('Invalid credential ID provided for status check');
      }

      setLoading(true);
      setError(null);
      try {
        const result = await fetchApi<any>(`/credentials/${credentialId}`);
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch credential status');
        }
        const responseData = (result as { success: true; data: any }).data;
        if (!responseData) {
          throw new Error('No credential data returned');
        }

        // Map backend response format to frontend Credential format
        const credential: Credential = {
          id: responseData.id,
          service: responseData.service,
          name: responseData.name,
          type: responseData.type,
          verified: responseData.verified,
          verified_at: responseData.verified_at || null,
          created_at: responseData.created_at,
          updated_at: responseData.updated_at || responseData.created_at,
          expires_at: responseData.expires_at,
          metadata: responseData.metadata,
        };

        return credential;
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
