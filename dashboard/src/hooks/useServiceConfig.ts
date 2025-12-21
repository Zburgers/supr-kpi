/**
 * Hook for resolving service configuration from backend
 * 
 * Replaces localStorage-based useSettings with backend credentials.
 * Provides a unified interface for checking if services are configured
 * and getting their associated sheet mappings.
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch services and sheet mappings in parallel
      const [serviceConfigs, mappings] = await Promise.all([
        getServices(),
        getSheetMappings(),
      ]);

      // Process service configurations
      const newServices: ServiceState = {
        meta: { configured: false },
        ga4: { configured: false },
        shopify: { configured: false },
        sheets: { configured: false },
      };

      for (const config of serviceConfigs) {
        const serviceName = config.service as keyof ServiceState;
        if (serviceName in newServices) {
          newServices[serviceName] = {
            configured: config.enabled && config.configured,
            credentialId: config.credential?.id,
          };
        }
      }

      setServices(newServices);

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
    loading: loading || servicesLoading || mappingsLoading,
    error: error || servicesError || mappingsError,
    refresh,
    isConfigured,
  };
}
