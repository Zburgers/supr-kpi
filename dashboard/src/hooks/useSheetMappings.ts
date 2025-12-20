/**
 * Custom hook for managing sheet mappings
 */

import { useState, useCallback } from 'react';
import type { SheetMapping, SheetMappingRequest, ApiResponse } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function useSheetMappings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSheetMappings = useCallback(async (): Promise<SheetMapping[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/sheets/mappings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sheet mappings: ${response.statusText}`);
      }

      const data: ApiResponse<SheetMapping[]> = await response.json();
      return data.data || [];
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
        const response = await fetch(`${API_BASE_URL}/sheets/mappings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to save sheet mapping');
        }

        const data: ApiResponse<SheetMapping> = await response.json();
        if (!data.data) {
          throw new Error('No sheet mapping data returned');
        }
        return data.data;
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
        const response = await fetch(`${API_BASE_URL}/sheets/mappings/${mappingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to update sheet mapping');
        }

        const data: ApiResponse<SheetMapping> = await response.json();
        if (!data.data) {
          throw new Error('No sheet mapping data returned');
        }
        return data.data;
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
      const response = await fetch(`${API_BASE_URL}/sheets/mappings/${mappingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete sheet mapping');
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
