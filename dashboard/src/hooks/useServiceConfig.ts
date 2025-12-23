/**
 * Hook for resolving service configuration from backend
 * 
 * Provides a unified interface for checking if services are configured
 * and getting their associated sheet mappings.
 * 
 * ARCHITECTURE NOTE:
 * - Services are enabled/disabled via /api/services endpoints
 * - Sheet mappings define where each service writes data
 * - A service is "configured" when it's enabled AND has a valid credential
 * - Sheet data flows from: Service API -> Sheet Mapping -> Google Sheets
 */

import { useState, useCallback, useEffect } from 'react';
import { useServices } from './useServices';
import { useSheetMappings } from './useSheetMappings';

export interface ServiceState {
  meta: { configured: boolean; credentialId?: string };
  ga4: { configured: boolean; credentialId?: string };
  shopify: { configured: boolean; credentialId?: string };
  sheets: { configured: boolean; credentialId?: string };
}

export interface SheetConfig {
  spreadsheetId: string;
  metaSheetName: string;
  ga4SheetName: string;
  shopifySheetName: string;
}

export interface ServiceConfigState {
  services: ServiceState;
  sheetConfig: SheetConfig | null;
  googleSheetsCredentialId?: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConfigured: (platform: 'meta' | 'ga4' | 'shopify') => boolean;
}

const DEFAULT_SHEET_CONFIG: SheetConfig = {
  spreadsheetId: '',
  metaSheetName: 'RawMeta',
  ga4SheetName: 'RawGA',
  shopifySheetName: 'RawShopify',
};

export function useServiceConfig(): ServiceConfigState {
  const { getServices, loading: servicesLoading, error: servicesError } = useServices();
  const { getSheetMappings, loading: mappingsLoading, error: mappingsError } = useSheetMappings();

  const [services, setServices] = useState<ServiceState>({
    meta: { configured: false },
    ga4: { configured: false },
    shopify: { configured: false },
    sheets: { configured: false },
  });
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(null);
  const [googleSheetsCredentialId, setGoogleSheetsCredentialId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch services and sheet mappings in parallel
      const [serviceConfigs, mappings] = await Promise.all([
        getServices().catch(() => []), // Don't fail if services fetch fails
        getSheetMappings().catch(() => []), // Don't fail if mappings fetch fails
      ]);

      // Process service configurations
      const newServices: ServiceState = {
        meta: { configured: false },
        ga4: { configured: false },
        shopify: { configured: false },
        sheets: { configured: false },
      };

      console.log('[useServiceConfig] Processing services:', serviceConfigs);

      let googleSheetsId: string | undefined = undefined;
      for (const config of serviceConfigs) {
        // Use the normalized service name from useServices hook
        const serviceName = config.service;
        console.log('[useServiceConfig] Processing service:', serviceName, 'configured:', config.configured, 'credential:', config.credential);
        
        // Track Google Sheets credential separately
        if (serviceName === 'google_sheets') {
          const credentialId = config.credential?.id;
          if (credentialId) {
            googleSheetsId = String(credentialId);
            newServices.sheets = {
              configured: config.configured,
              credentialId: String(credentialId),
            };
          }
        } else if (serviceName === 'meta' || serviceName === 'ga4' || serviceName === 'shopify') {
          const serviceKey = serviceName as keyof Omit<ServiceState, 'sheets'>;
          newServices[serviceKey] = {
            configured: config.configured,
            credentialId: config.credential?.id ? String(config.credential.id) : undefined,
          };
        }
      }

      setServices(newServices);
      setGoogleSheetsCredentialId(googleSheetsId);
      console.log('[useServiceConfig] Final services state:', newServices);
      console.log('[useServiceConfig] Google Sheets credential ID:', googleSheetsId);

      // Process sheet mappings to build sheet config
      const newSheetConfig = { ...DEFAULT_SHEET_CONFIG };
      let hasSpreadsheet = false;

      for (const mapping of mappings) {
        // Use the first spreadsheet we find
        if (!hasSpreadsheet && mapping.spreadsheet_id) {
          newSheetConfig.spreadsheetId = mapping.spreadsheet_id;
          hasSpreadsheet = true;
        }

        // Match sheet names by service
        switch (mapping.service) {
          case 'meta':
            newSheetConfig.metaSheetName = mapping.sheet_name || 'RawMeta';
            break;
          case 'ga4':
            newSheetConfig.ga4SheetName = mapping.sheet_name || 'RawGA';
            break;
          case 'shopify':
            newSheetConfig.shopifySheetName = mapping.sheet_name || 'RawShopify';
            break;
        }
      }

      setSheetConfig(hasSpreadsheet ? newSheetConfig : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load service configuration';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getServices, getSheetMappings]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  const isConfigured = useCallback(
    (platform: 'meta' | 'ga4' | 'shopify'): boolean => {
      return services[platform]?.configured ?? false;
    },
    [services]
  );

  return {
    services,
    sheetConfig,
    googleSheetsCredentialId,
    loading: loading || servicesLoading || mappingsLoading,
    error: error || servicesError || mappingsError,
    refresh,
    isConfigured,
  };
}
