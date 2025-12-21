/**
 * Custom hook for managing services
 * 
 * Uses centralized fetchApi for authentication (Clerk JWT)
 */

import { useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import type { ServiceConfig, Spreadsheet, Sheet } from '@/types/api';

export function useServices() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getServices = useCallback(async (): Promise<ServiceConfig[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<ServiceConfig[]>('/services');
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch services');
      }
      return (result as { success: true; data: ServiceConfig[] }).data || [];
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
        const result = await fetchApi<ServiceConfig>(`/services/${service}/enable`, {
          method: 'POST',
          body: JSON.stringify({ credential_id: credentialId }),
        });
        if (!result.success) {
          throw new Error(result.error || 'Failed to enable service');
        }
        const data = (result as { success: true; data: ServiceConfig }).data;
        if (!data) {
          throw new Error('No service data returned');
        }
        return data;
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
      const result = await fetchApi<void>(`/services/${service}/disable`, {
        method: 'POST',
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to disable service');
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
        const result = await fetchApi<Spreadsheet[]>(
          `/sheets/spreadsheets?credential_id=${credentialId}`
        );
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch spreadsheets');
        }
        return (result as { success: true; data: Spreadsheet[] }).data || [];
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
        const result = await fetchApi<Sheet[]>(
          `/sheets/${spreadsheetId}/sheets?credential_id=${credentialId}`
        );
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch sheets');
        }
        return (result as { success: true; data: Sheet[] }).data || [];
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
