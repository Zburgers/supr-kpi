import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type {
  MetaRawDaily,
  GA4RawDaily,
  ShopifyRawDaily,
  MetaMetrics,
  GA4Metrics,
  ShopifyMetrics,
  DateRange,
} from '@/types'
import { calculateChange, getDateRange } from '@/lib/utils'
import { useServiceConfig } from '@/hooks/useServiceConfig'
import * as api from '@/lib/api'

interface DashboardData {
  meta: MetaRawDaily[]
  ga4: GA4RawDaily[]
  shopify: ShopifyRawDaily[]
  isLoading: boolean
  error: string | null
  lastSynced: Date | null
}

interface CalculatedMetrics {
  meta: MetaMetrics | null
  ga4: GA4Metrics | null
  shopify: ShopifyMetrics | null
}

export function useDashboardData(dateRange: DateRange) {
  const { services: serviceConfig, sheetConfig, googleSheetsCredentialId, isConfigured, loading: configLoading } = useServiceConfig()
  const [data, setData] = useState<DashboardData>({
    meta: [],
    ga4: [],
    shopify: [],
    isLoading: true,
    error: null,
    lastSynced: null,
  })

  const [rawMeta, setRawMeta] = useState<string[][]>([])
  const [rawGa4, setRawGa4] = useState<string[][]>([])
  const [rawShopify, setRawShopify] = useState<string[][]>([])
  const cacheRef = useRef<{
    data: { meta: string[][]; ga4: string[][]; shopify: string[][] }
    fetchedAt: number
  } | null>(null)
  const CACHE_TTL_MS = 5 * 60 * 1000

  const toNumber = (value: unknown): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }

  const normalizeHeaders = (row: string[]): string[] => row.map((h) => h?.toString().trim().toLowerCase())

  const normalizeDate = (value: string): number | null => {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
  }

  const dateBounds = useMemo(() => {
    const { startDate, endDate } = getDateRange(dateRange)
    return {
      start: normalizeDate(startDate),
      end: normalizeDate(endDate),
    }
  }, [dateRange])

  const filterByDateRange = useCallback(
    <T extends { date: string }>(rows: T[]): T[] => {
      if (!rows.length) return []

      return rows
        .map((row) => ({ row, ts: normalizeDate(row.date) }))
        .filter(({ ts }) => ts !== null && dateBounds.start !== null && dateBounds.end !== null
          ? ts >= dateBounds.start && ts <= dateBounds.end
          : ts !== null)
        .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
        .map(({ row }) => row)
    },
    [dateBounds.start, dateBounds.end]
  )

  const parseMetaRows = (rows: string[][]): MetaRawDaily[] => {
    if (!rows?.length) return []
    const headers = normalizeHeaders(rows[0] as string[])
    const idx = (key: string) => headers.indexOf(key)

    return rows.slice(1).map((row) => ({
      id: idx('id') >= 0 ? toNumber(row[idx('id')]) : undefined,
      date: String(row[idx('date')] ?? ''),
      spend: toNumber(row[idx('spend')]),
      reach: toNumber(row[idx('reach')]),
      impressions: toNumber(row[idx('impressions')]),
      clicks: toNumber(row[idx('clicks')]),
      landing_page_views: toNumber(row[idx('landing_page_views')]),
      add_to_cart: toNumber(row[idx('add_to_cart')]),
      initiate_checkout: toNumber(row[idx('initiate_checkout')]),
      purchases: toNumber(row[idx('purchases')]),
      revenue: toNumber(row[idx('revenue')]),
    })).filter((r) => r.date)
  }

  const parseGa4Rows = (rows: string[][]): GA4RawDaily[] => {
    if (!rows?.length) return []
    const headers = normalizeHeaders(rows[0] as string[])
    const idx = (key: string) => headers.indexOf(key)

    return rows.slice(1).map((row) => ({
      id: idx('id') >= 0 ? toNumber(row[idx('id')]) : undefined,
      date: String(row[idx('date')] ?? ''),
      sessions: toNumber(row[idx('sessions')]),
      users: toNumber(row[idx('users')]),
      add_to_cart: toNumber(row[idx('add_to_cart')]),
      purchases: toNumber(row[idx('purchases')]),
      revenue: toNumber(row[idx('revenue')]),
      bounce_rate: toNumber(row[idx('bounce_rate')]),
    })).filter((r) => r.date)
  }

  const parseShopifyRows = (rows: string[][]): ShopifyRawDaily[] => {
    if (!rows?.length) return []
    const headers = normalizeHeaders(rows[0] as string[])
    const idx = (key: string) => headers.indexOf(key)

    return rows.slice(1).map((row) => ({
      id: idx('id') >= 0 ? toNumber(row[idx('id')]) : undefined,
      date: String(row[idx('date')] ?? ''),
      total_orders: toNumber(row[idx('total_orders')]),
      total_revenue: toNumber(row[idx('total_revenue')]),
      net_revenue: toNumber(row[idx('net_revenue')]),
      total_returns: toNumber(row[idx('total_returns')]),
      new_customers: toNumber(row[idx('new_customers')]),
      repeat_customers: toNumber(row[idx('repeat_customers')]),
    })).filter((r) => r.date)
  }

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      // Wait for config to load
      if (configLoading) {
        setData((prev) => ({ 
          ...prev, 
          isLoading: true,
          error: null 
        }))
        return
      }
      
      // Check if we have a spreadsheet configured
      if (!sheetConfig?.spreadsheetId) {
        setData((prev) => ({ 
          ...prev, 
          isLoading: false,
          error: 'No spreadsheet configured. Please configure your Google Sheets in Settings > Sheet Mappings.' 
        }))
        return
      }

      // Require a Google Sheets credential for authenticated access
      if (!googleSheetsCredentialId) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Missing Google Sheets credential. Please add a Sheets credential in Settings.',
        }))
        return
      }

      setData((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const now = Date.now()
        const cached = cacheRef.current
        const isFresh = cached && now - cached.fetchedAt < CACHE_TTL_MS

        if (cached && isFresh && !forceRefresh) {
          setRawMeta(cached.data.meta)
          setRawGa4(cached.data.ga4)
          setRawShopify(cached.data.shopify)
          setData((prev) => ({ ...prev, isLoading: false, error: null, lastSynced: new Date(cached.fetchedAt) }))
          return
        }

        const spreadsheetId = sheetConfig.spreadsheetId
        
        // Fetch data from each sheet independently - don't fail if one sheet is missing
        const results = await Promise.allSettled([
          api.getSheetRawData(spreadsheetId, sheetConfig.metaSheetName, googleSheetsCredentialId),
          api.getSheetRawData(spreadsheetId, sheetConfig.ga4SheetName, googleSheetsCredentialId),
          api.getSheetRawData(spreadsheetId, sheetConfig.shopifySheetName, googleSheetsCredentialId),
        ])

        // Extract data from settled promises, defaulting to empty arrays for failures
        const metaData = results[0].status === 'fulfilled' && results[0].value.success && results[0].value.data 
          ? results[0].value.data 
          : []
        const ga4Data = results[1].status === 'fulfilled' && results[1].value.success && results[1].value.data 
          ? results[1].value.data 
          : []
        const shopifyData = results[2].status === 'fulfilled' && results[2].value.success && results[2].value.data 
          ? results[2].value.data 
          : []

        // Collect any errors for display (but don't block)
        const errors: string[] = []
        if (results[0].status === 'rejected' || (results[0].status === 'fulfilled' && !results[0].value.success)) {
          const err = results[0].status === 'rejected' 
            ? results[0].reason?.message 
            : results[0].value.error
          if (err && !err.includes('not found') && !err.includes('404')) {
            errors.push(`Meta: ${err}`)
          }
        }
        if (results[1].status === 'rejected' || (results[1].status === 'fulfilled' && !results[1].value.success)) {
          const err = results[1].status === 'rejected' 
            ? results[1].reason?.message 
            : results[1].value.error
          if (err && !err.includes('not found') && !err.includes('404')) {
            errors.push(`GA4: ${err}`)
          }
        }
        if (results[2].status === 'rejected' || (results[2].status === 'fulfilled' && !results[2].value.success)) {
          const err = results[2].status === 'rejected' 
            ? results[2].reason?.message 
            : results[2].value.error
          if (err && !err.includes('not found') && !err.includes('404')) {
            errors.push(`Shopify: ${err}`)
          }
        }

        // Cache the results
        cacheRef.current = {
          data: { meta: metaData, ga4: ga4Data, shopify: shopifyData },
          fetchedAt: now,
        }

        setRawMeta(metaData)
        setRawGa4(ga4Data)
        setRawShopify(shopifyData)

        setData({
          meta: [],
          ga4: [],
          shopify: [],
          isLoading: false,
          error: errors.length > 0 ? errors.join('; ') : null,
          lastSynced: new Date(now),
        })
      } catch (error) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load data',
        }))
      }
    },
    [sheetConfig, configLoading, googleSheetsCredentialId]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const meta = useMemo(() => filterByDateRange(parseMetaRows(rawMeta)), [rawMeta, filterByDateRange])
  const ga4 = useMemo(() => filterByDateRange(parseGa4Rows(rawGa4)), [rawGa4, filterByDateRange])
  const shopify = useMemo(() => filterByDateRange(parseShopifyRows(rawShopify)), [rawShopify, filterByDateRange])

  const syncPlatform = useCallback(
    async (platform: 'meta' | 'ga4' | 'shopify') => {
      if (!isConfigured(platform)) {
        return { success: false, error: `${platform} is not configured. Please configure it in Settings.` }
      }

      setData((prev) => ({ ...prev, isLoading: true }))

      try {
        // For GA4, we need to get the credentialId from service configuration
        let result;
        if (platform === 'ga4') {
          const ga4CredentialId = serviceConfig.services.ga4.credentialId;
          if (!ga4CredentialId) {
            return { success: false, error: 'GA4 credential ID not found. Please reconfigure GA4 in Settings.' };
          }

          // Use modern syncService which uses stored credentials from backend
          result = await api.syncService(platform, { credentialId: ga4CredentialId })
        } else {
          // Use modern syncService which uses stored credentials from backend
          result = await api.syncService(platform)
        }

        if (result.success) {
          cacheRef.current = null
          await fetchData(true)
        } else {
          setData((prev) => ({ ...prev, isLoading: false }))
        }
        return result
      } catch (error) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Sync failed',
        }))
        return { success: false, error: 'Sync failed' }
      }
    },
    [isConfigured, serviceConfig, fetchData]
  )

  const syncAll = useCallback(async () => {
    setData((prev) => ({ ...prev, isLoading: true }))

    const results = await Promise.all([
      isConfigured('meta') ? syncPlatform('meta') : Promise.resolve({ success: false }),
      isConfigured('ga4') ? syncPlatform('ga4') : Promise.resolve({ success: false }),
      isConfigured('shopify') ? syncPlatform('shopify') : Promise.resolve({ success: false }),
    ])

    cacheRef.current = null
    await fetchData(true)
    return results
  }, [syncPlatform, isConfigured, fetchData])

  const refresh = useCallback(() => {
    cacheRef.current = null
    fetchData(true)
  }, [fetchData])

  return {
    ...data,
    meta,
    ga4,
    shopify,
    syncPlatform,
    syncAll,
    refresh,
  }
}

export function useCalculatedMetrics(
  meta: MetaRawDaily[],
  ga4: GA4RawDaily[],
  shopify: ShopifyRawDaily[]
): CalculatedMetrics {
  const hasMeta = meta.length > 0
  const hasGA4 = ga4.length > 0
  const hasShopify = shopify.length > 0

  const latestMeta = hasMeta ? meta[meta.length - 1] : null
  const previousMeta = hasMeta && meta.length > 1 ? meta[meta.length - 2] : latestMeta

  const latestGA4 = hasGA4 ? ga4[ga4.length - 1] : null
  const previousGA4 = hasGA4 && ga4.length > 1 ? ga4[ga4.length - 2] : latestGA4

  const latestShopify = hasShopify ? shopify[shopify.length - 1] : null
  const previousShopify = hasShopify && shopify.length > 1 ? shopify[shopify.length - 2] : latestShopify

  return {
    meta: latestMeta && previousMeta
      ? {
          cpm: latestMeta.impressions > 0 ? (latestMeta.spend / latestMeta.impressions) * 1000 : 0,
          ctr: latestMeta.impressions > 0 ? (latestMeta.clicks / latestMeta.impressions) * 100 : 0,
          cpc: latestMeta.clicks > 0 ? latestMeta.spend / latestMeta.clicks : 0,
          cac: latestMeta.purchases > 0 ? latestMeta.spend / latestMeta.purchases : 0,
          roas: latestMeta.spend > 0 ? latestMeta.revenue / latestMeta.spend : 0,
          aov: latestMeta.purchases > 0 ? latestMeta.revenue / latestMeta.purchases : 0,
          spendChange: calculateChange(latestMeta.spend, previousMeta.spend),
          revenueChange: calculateChange(latestMeta.revenue, previousMeta.revenue),
        }
      : null,
    ga4: latestGA4 && previousGA4
      ? {
          conversionRate: latestGA4.sessions > 0 ? (latestGA4.purchases / latestGA4.sessions) * 100 : 0,
          aov: latestGA4.purchases > 0 ? latestGA4.revenue / latestGA4.purchases : 0,
          bounceRate: latestGA4.bounce_rate,
          revenueChange: calculateChange(latestGA4.revenue, previousGA4.revenue),
          sessionsChange: calculateChange(latestGA4.sessions, previousGA4.sessions),
        }
      : null,
    shopify: latestShopify && previousShopify
      ? {
          revPerOrder: latestShopify.total_orders > 0 ? latestShopify.total_revenue / latestShopify.total_orders : 0,
          newCustomerPercent: latestShopify.total_orders > 0 ? (latestShopify.new_customers / latestShopify.total_orders) * 100 : 0,
          returnRate: latestShopify.total_orders > 0 ? (latestShopify.total_returns / latestShopify.total_orders) * 100 : 0,
          revenueChange: calculateChange(latestShopify.total_revenue, previousShopify.total_revenue),
          ordersChange: calculateChange(latestShopify.total_orders, previousShopify.total_orders),
        }
      : null,
  }
}
