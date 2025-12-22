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

  const normalizeSheetMapping = useCallback((raw: any): SheetMapping => {
    // Backend currently returns: { id, service, spreadsheetId, sheetName }
    // Dashboard expects: { spreadsheet_id, spreadsheet_name, sheet_name, created_at, updated_at }
    const spreadsheetId = raw?.spreadsheet_id ?? raw?.spreadsheetId ?? '';
    const sheetName = raw?.sheet_name ?? raw?.sheetName ?? '';
    const now = new Date().toISOString();

    return {
      id: String(raw?.id ?? ''),
      service: raw?.service,
      spreadsheet_id: String(spreadsheetId),
      spreadsheet_name: String(raw?.spreadsheet_name ?? raw?.spreadsheetName ?? spreadsheetId ?? ''),
      sheet_name: String(sheetName),
      created_at: String(raw?.created_at ?? raw?.createdAt ?? now),
      updated_at: String(raw?.updated_at ?? raw?.updatedAt ?? now),
    } as SheetMapping;
  }, []);

  const getSheetMappings = useCallback(async (): Promise<SheetMapping[]> => {
    setLoading(true);
    setError(null);
    try {
      const result: any = await fetchApi<any>('/sheet-mappings');

      // Preferred normalized shape: { success: true, data: SheetMapping[] }
      if (result && typeof result === 'object' && 'success' in result) {
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch sheet mappings');
        }
        const data = (result as { success: true; data: any[] }).data || [];
        return data.map(normalizeSheetMapping);
      }

      // Current backend shape: { mappings: [...] }
      if (result && typeof result === 'object' && Array.isArray(result.mappings)) {
        return result.mappings.map(normalizeSheetMapping);
      }

      throw new Error('Unexpected sheet mappings response');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sheet mappings';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [normalizeSheetMapping]);

  const saveSheetMapping = useCallback(
    async (request: SheetMappingRequest): Promise<SheetMapping> => {
      setLoading(true);
      setError(null);
      try {
        const result: any = await fetchApi<any>('/sheet-mappings/set', {
          method: 'POST',
          body: JSON.stringify({
            service: request.service,
            spreadsheetId: request.spreadsheet_id,
            sheetName: request.sheet_name,
          }),
        });

        // If backend returns normalized envelope
        if (result && typeof result === 'object' && 'success' in result) {
          if (!result.success) {
            throw new Error(result.error || 'Failed to save sheet mapping');
          }
          const data = (result as { success: true; data: any }).data;
          if (!data) throw new Error('No sheet mapping data returned');
          return normalizeSheetMapping(data);
        }

        // Current backend returns mapping fields directly
        return normalizeSheetMapping(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save sheet mapping';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [normalizeSheetMapping]
  );

  const updateSheetMapping = useCallback(
    async (_mappingId: string, request: Partial<SheetMappingRequest>): Promise<SheetMapping> => {
      setLoading(true);
      setError(null);
      try {
        // Backend doesn't currently support PATCH/PUT by id; treat update as set.
        if (!request.service || !request.spreadsheet_id || !request.sheet_name) {
          throw new Error('Missing required fields to update sheet mapping');
        }
        return await saveSheetMapping(request as SheetMappingRequest);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update sheet mapping';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [saveSheetMapping]
  );

  const deleteSheetMapping = useCallback(async (_mappingId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Backend doesn't currently support deleting sheet mappings.
      throw new Error('Deleting sheet mappings is not supported');
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
