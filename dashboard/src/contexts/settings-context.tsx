import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppSettings, PlatformCredentials, SpreadsheetConfig } from '@/types'

const STORAGE_KEY = 'kpi-dashboard-settings'

const defaultCredentials: PlatformCredentials = {
  meta: {
    accessToken: '',
  },
  ga4: {
    authMethod: 'oauth',
    propertyId: '',
    accessToken: '',
  },
  shopify: {
    storeDomain: '',
    accessToken: '',
  },
}

const defaultSpreadsheet: SpreadsheetConfig = {
  spreadsheetId: '1HlVbOXTfNJjHCt2fzHz8uCkZjUBHxFPRXB-2mcVNvu8',
  metaSheetName: 'RawMeta',
  ga4SheetName: 'RawGA',
  shopifySheetName: 'RawShopify',
}

const defaultSettings: AppSettings = {
  credentials: defaultCredentials,
  spreadsheet: defaultSpreadsheet,
  theme: 'system',
}

interface SettingsContextType {
  settings: AppSettings
  updateCredentials: (platform: keyof PlatformCredentials, credentials: Partial<PlatformCredentials[keyof PlatformCredentials]>) => void
  updateSpreadsheet: (config: Partial<SpreadsheetConfig>) => void
  resetSettings: () => void
  isConfigured: (platform: keyof PlatformCredentials) => boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...defaultSettings, ...parsed }
      }
    } catch {
      // Ignore parsing errors
    }
    return defaultSettings
  })

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const updateCredentials = (
    platform: keyof PlatformCredentials,
    credentials: Partial<PlatformCredentials[keyof PlatformCredentials]>
  ) => {
    setSettings((prev) => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [platform]: {
          ...prev.credentials[platform],
          ...credentials,
        },
      },
    }))
  }

  const updateSpreadsheet = (config: Partial<SpreadsheetConfig>) => {
    setSettings((prev) => ({
      ...prev,
      spreadsheet: {
        ...prev.spreadsheet,
        ...config,
      },
    }))
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
  }

  const isConfigured = (platform: keyof PlatformCredentials): boolean => {
    const creds = settings.credentials[platform]
    switch (platform) {
      case 'meta':
        return Boolean(creds.accessToken)
      case 'ga4': {
        const ga4Creds = creds as PlatformCredentials['ga4']
        if (!ga4Creds.propertyId) return false
        if (ga4Creds.authMethod === 'oauth') {
          return Boolean(ga4Creds.accessToken)
        } else {
          return Boolean(ga4Creds.serviceAccountKey)
        }
      }
      case 'shopify':
        return Boolean((creds as PlatformCredentials['shopify']).storeDomain && (creds as PlatformCredentials['shopify']).accessToken)
      default:
        return false
    }
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateCredentials,
        updateSpreadsheet,
        resetSettings,
        isConfigured,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
