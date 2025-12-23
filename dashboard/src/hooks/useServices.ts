/**
 * Custom hook for managing services
 * 
 * Uses centralized fetchApi for authentication (Clerk JWT)
 * 
 * IMPORTANT: This hook normalizes the backend response format to match
 * what the frontend expects. The backend returns:
 *   { services: [{ name, enabled, credential }] }
 * We transform it to:
 *   [{ service, enabled, configured, credential }]
 */

import { useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import type { ServiceConfig, Spreadsheet, Sheet } from '@/types/api';

// Backend response shape (from /api/services)
interface BackendServiceConfig {
  name: string;
  enabled: boolean;
  credential?: {
    id: number | string;
    name: string;
    verified: boolean;
  };
}

interface BackendServicesResponse {
  services: BackendServiceConfig[];
}

/**
 * Normalize backend response to frontend ServiceConfig format
 */
function normalizeServiceConfig(backend: BackendServiceConfig): ServiceConfig {
  return {
    service: backend.name as ServiceConfig['service'],
    enabled: backend.enabled,
    configured: backend.enabled && backend.credential != null,
    credential: backend.credential
      ? {
          id: String(backend.credential.id),
          service: backend.name as ServiceConfig['service'],
          name: backend.credential.name,
          type: 'service_account' as const, // Default type
          verified: backend.credential.verified,
          verified_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : null,
  };
}

export function useServices() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getServices = useCallback(async (): Promise<ServiceConfig[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<BackendServicesResponse | ServiceConfig[]>('/services');
      
      console.log('[useServices] Raw API response:', result);
      
      // Handle error responses
      if (!result.success && result.error) {
        throw new Error(result.error || 'Failed to fetch services');
      }
      
      // Handle backend response shape: { services: [...] }
      const raw = result as any;
      if (raw.services && Array.isArray(raw.services)) {
        console.log('[useServices] Backend services before normalization:', raw.services);
        const normalized = raw.services.map(normalizeServiceConfig);
        console.log('[useServices] Services after normalization:', normalized);
        return normalized;
      }
      
      // Handle normalized shape: { success: true, data: [...] }
      if (result.success && Array.isArray((result as any).data)) {
        return (result as any).data;
      }
      
      // Handle direct array (shouldn't happen but be safe)
      if (Array.isArray(raw)) {
        return raw.map(normalizeServiceConfig);
      }
      
      // No services configured yet - return empty array
      return [];
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
        const result = await fetchApi<any>(`/services/${service}/enable`, {
          method: 'POST',
          body: JSON.stringify({ credentialId }), // Backend expects credentialId not credential_id
        });
        
        // Handle error response
        if (result.error) {
          throw new Error(result.error || 'Failed to enable service');
        }
        
        // Normalize the response - backend returns { service, enabled, credentialId }
        const raw = result as any;
        const config: ServiceConfig = {
          service: (raw.service || service) as ServiceConfig['service'],
          enabled: raw.enabled ?? true,
          configured: true,
          credential: credentialId
            ? {
                id: String(credentialId),
                service: service as ServiceConfig['service'],
                name: '',
                type: 'service_account' as const,
                verified: false,
                verified_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : null,
        };
        
        return config;
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
      const result = await fetchApi<any>(`/services/${service}/disable`, {
        method: 'POST',
      });
      // Backend returns { service, enabled } - just check for error
      if (result.error) {
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
        // Use authenticated endpoint when a specific credential is provided; fallback to legacy
        const query = credentialId ? `?credential_id=${credentialId}` : '';
        const endpoint = credentialId ? `/sheets/spreadsheets${query}` : `/spreadsheets`;
        const result = await fetchApi<any>(endpoint);
        
        // Handle { success: true, data: [...] } shape
        if (result.success && Array.isArray(result.data)) {
          return result.data.map((s: any) => ({
            id: s.id || s.spreadsheetId,
            name: s.name || s.title || 'Untitled',
            url: s.url || `https://docs.google.com/spreadsheets/d/${s.id || s.spreadsheetId}`,
          }));
        }
        
        // Handle direct array
        if (Array.isArray(result)) {
          return result.map((s: any) => ({
            id: s.id || s.spreadsheetId,
            name: s.name || s.title || 'Untitled',
            url: s.url || `https://docs.google.com/spreadsheets/d/${s.id || s.spreadsheetId}`,
          }));
        }
        
        throw new Error(result.error || 'Failed to fetch spreadsheets');
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
        // Use authenticated endpoint when a specific credential is provided; fallback to legacy
        const query = credentialId ? `?credential_id=${credentialId}` : '';
        const endpoint = credentialId ? `/sheets/${spreadsheetId}/sheets${query}` : `/sheets/${spreadsheetId}`;
        const result = await fetchApi<any>(endpoint);
        
        // Handle { success: true, data: [...] } shape
        if (result.success && Array.isArray(result.data)) {
          return result.data.map((s: any) => ({
            name: s.name || s.title || 'Sheet1',
            index: s.index ?? s.sheetId ?? 0,
            rowCount: s.rowCount ?? 1000,
            columnCount: s.columnCount ?? 26,
          }));
        }
        
        // Handle direct array
        if (Array.isArray(result)) {
          return result.map((s: any) => ({
            name: s.name || s.title || 'Sheet1',
            index: s.index ?? s.sheetId ?? 0,
            rowCount: s.rowCount ?? 1000,
            columnCount: s.columnCount ?? 26,
          }));
        }
        
        throw new Error(result.error || 'Failed to fetch sheets');
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
