/**
 * Custom hook for managing credentials
 */

import { useState, useCallback } from 'react';
import type {
  Credential,
  CredentialCreateRequest,
  CredentialVerificationResponse,
  ApiResponse,
} from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function useCredentials() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCredentials = useCallback(async (): Promise<Credential[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/credentials`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch credentials: ${response.statusText}`);
      }

      const data: ApiResponse<Credential[]> = await response.json();
      return data.data || [];
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
        const response = await fetch(`${API_BASE_URL}/credentials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to save credential');
        }

        const data: ApiResponse<Credential> = await response.json();
        if (!data.data) {
          throw new Error('No credential data returned');
        }
        return data.data;
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
        const response = await fetch(`${API_BASE_URL}/credentials/${credentialId}/verify`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to verify credential');
        }

        const data: ApiResponse<CredentialVerificationResponse> = await response.json();
        return data.data || { success: false, verified: false };
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
        const response = await fetch(`${API_BASE_URL}/credentials/${credentialId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to update credential');
        }

        const data: ApiResponse<Credential> = await response.json();
        if (!data.data) {
          throw new Error('No credential data returned');
        }
        return data.data;
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
      const response = await fetch(`${API_BASE_URL}/credentials/${credentialId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete credential');
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
        const response = await fetch(`${API_BASE_URL}/credentials/${credentialId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch credential status: ${response.statusText}`);
        }

        const data: ApiResponse<Credential> = await response.json();
        if (!data.data) {
          throw new Error('No credential data returned');
        }
        return data.data;
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
