/**
 * Custom hook for managing services
 */

import { useState, useCallback } from 'react';
import type { ServiceConfig, Spreadsheet, Sheet, ApiResponse } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function useServices() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getServices = useCallback(async (): Promise<ServiceConfig[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/services`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch services: ${response.statusText}`);
      }

      const data: ApiResponse<ServiceConfig[]> = await response.json();
      return data.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch services';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const enableService = useCallback(
    async (service: string, credentialId: string): Promise<ServiceConfig> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/services/${service}/enable`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ credential_id: credentialId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to enable service');
        }

        const data: ApiResponse<ServiceConfig> = await response.json();
        if (!data.data) {
          throw new Error('No service data returned');
        }
        return data.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to enable service';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const disableService = useCallback(async (service: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/services/${service}/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to disable service');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disable service';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSpreadsheets = useCallback(
    async (credentialId: string): Promise<Spreadsheet[]> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/sheets/spreadsheets?credential_id=${credentialId}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch spreadsheets: ${response.statusText}`);
        }

        const data: ApiResponse<Spreadsheet[]> = await response.json();
        return data.data || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch spreadsheets';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getSheets = useCallback(
    async (credentialId: string, spreadsheetId: string): Promise<Sheet[]> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/sheets/${spreadsheetId}/sheets?credential_id=${credentialId}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch sheets: ${response.statusText}`);
        }

        const data: ApiResponse<Sheet[]> = await response.json();
        return data.data || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch sheets';
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
    getServices,
    enableService,
    disableService,
    getSpreadsheets,
    getSheets,
  };
}
