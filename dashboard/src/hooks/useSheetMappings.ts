/**
 * Custom hook for managing sheet mappings
 * 
 * Uses centralized fetchApi for authentication (Clerk JWT)
 */

import { useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import type { SheetMapping, SheetMappingRequest } from '@/types/api';

export function useSheetMappings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSheetMappings = useCallback(async (): Promise<SheetMapping[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<SheetMapping[]>('/sheets/mappings');
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch sheet mappings');
      }
      return (result as { success: true; data: SheetMapping[] }).data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sheet mappings';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSheetMapping = useCallback(
    async (request: SheetMappingRequest): Promise<SheetMapping> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchApi<SheetMapping>('/sheets/mappings', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        if (!result.success) {
          throw new Error(result.error || 'Failed to save sheet mapping');
        }
        const data = (result as { success: true; data: SheetMapping }).data;
        if (!data) {
          throw new Error('No sheet mapping data returned');
        }
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save sheet mapping';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateSheetMapping = useCallback(
    async (mappingId: string, request: Partial<SheetMappingRequest>): Promise<SheetMapping> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchApi<SheetMapping>(`/sheets/mappings/${mappingId}`, {
          method: 'PUT',
          body: JSON.stringify(request),
        });
        if (!result.success) {
          throw new Error(result.error || 'Failed to update sheet mapping');
        }
        const data = (result as { success: true; data: SheetMapping }).data;
        if (!data) {
          throw new Error('No sheet mapping data returned');
        }
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update sheet mapping';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteSheetMapping = useCallback(async (mappingId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<void>(`/sheets/mappings/${mappingId}`, {
        method: 'DELETE',
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete sheet mapping');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete sheet mapping';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getSheetMappings,
    saveSheetMapping,
    updateSheetMapping,
    deleteSheetMapping,
  };
}
