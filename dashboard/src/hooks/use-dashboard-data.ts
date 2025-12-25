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
import { calculateAccurateChange, getDateRange } from '@/lib/utils'
import { useServiceConfig } from '@/hooks/useServiceConfig'
import * as api from '@/lib/api'
import { checkSheetHeaders, createSheetHeaders } from '@/lib/sheet-validation'

interface DashboardData {
  meta: MetaRawDaily[]
  ga4: GA4RawDaily[]
  shopify: ShopifyRawDaily[]
  isLoading: boolean
  error: string | null
  lastSynced: Date | null
  dataDateRange: { start: string; end: string } | null
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
    dataDateRange: null,
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

  /**
   * Normalize a date string to a timestamp for comparison
   * Handles various date formats and ensures timezone-safe comparison
   */
  const normalizeDate = (value: string): number | null => {
    if (!value) return null
    
    // Handle YYYY-MM-DD format explicitly to avoid timezone issues
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
      const [, year, month, day] = isoMatch
      // Create date in local timezone
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime()
    }
    
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
  }

  // Get the requested date range bounds
  const requestedRange = useMemo(() => getDateRange(dateRange), [dateRange])

  const dateBounds = useMemo(() => {
    const bounds = {
      start: normalizeDate(requestedRange.startDate),
      end: normalizeDate(requestedRange.endDate),
    }
    
    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log(`📅 Date Range [${dateRange}]:`, {
        requested: { start: requestedRange.startDate, end: requestedRange.endDate },
        bounds: { 
          start: bounds.start ? new Date(bounds.start).toLocaleDateString() : null,
          end: bounds.end ? new Date(bounds.end).toLocaleDateString() : null
        }
      })
    }
    
    return bounds
  }, [requestedRange, dateRange])

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
      id: idx('id') >= 0 ? String(row[idx('id')] ?? '') : undefined,
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
      id: idx('id') >= 0 ? String(row[idx('id')] ?? '') : undefined,
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
      id: idx('id') >= 0 ? String(row[idx('id')] ?? '') : undefined,
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
          dataDateRange: null, // Will be computed from filtered data
        })
      } catch (error) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load data',
          dataDateRange: null,
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

  // Compute actual data date range from filtered data
  const actualDataDateRange = useMemo(() => {
    const allDates: string[] = [
      ...meta.map(m => m.date),
      ...ga4.map(g => g.date),
      ...shopify.map(s => s.date),
    ].filter(Boolean)

    if (allDates.length === 0) return null

    const sortedDates = allDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    return {
      start: sortedDates[0],
      end: sortedDates[sortedDates.length - 1],
    }
  }, [meta, ga4, shopify])

  const syncPlatform = useCallback(
    async (platform: 'meta' | 'ga4' | 'shopify') => {
      if (!isConfigured(platform)) {
        return { success: false, error: `${platform} is not configured. Please configure it in Settings.` }
      }

      setData((prev) => ({ ...prev, isLoading: true }))

      try {
        // Get the credential ID for this platform
        let credentialId: string | undefined
        if (platform === 'ga4') {
          credentialId = serviceConfig.ga4.credentialId
        } else if (platform === 'shopify') {
          credentialId = serviceConfig.shopify.credentialId
        } else if (platform === 'meta') {
          credentialId = serviceConfig.meta.credentialId
        }

        if (!credentialId) {
          return { 
            success: false, 
            error: `${platform.toUpperCase()} credential ID not found. Please reconfigure in Settings.` 
          }
        }

        // Before syncing, validate sheet headers
        if (sheetConfig?.spreadsheetId) {
          const sheetName = platform === 'meta' 
            ? sheetConfig.metaSheetName 
            : platform === 'ga4' 
            ? sheetConfig.ga4SheetName 
            : sheetConfig.shopifySheetName

          const validation = await checkSheetHeaders(
            platform,
            sheetConfig.spreadsheetId,
            sheetName,
            googleSheetsCredentialId || credentialId
          )

          // If headers are missing, create them first
          if (validation.requiresHeaderCreation) {
            const headerCreationResult = await createSheetHeaders(
              platform,
              sheetConfig.spreadsheetId,
              sheetName,
              googleSheetsCredentialId || credentialId
            )

            if (!headerCreationResult.success) {
              return { 
                success: false, 
                error: `Failed to create headers: ${headerCreationResult.error}` 
              }
            }
          }

          // If headers don't match and it's not just empty, refuse to sync
          if (!validation.valid && !validation.requiresHeaderCreation) {
            return { 
              success: false, 
              error: validation.message 
            }
          }

          if (import.meta.env.DEV && validation.message) {
            console.log(`📋 Sheet Validation [${platform}]:`, validation)
          }
        }

        // Proceed with sync
        const result = await api.syncService(platform, { credentialId })

        if (result.success) {
          cacheRef.current = null
          await fetchData(true)
        } else {
          setData((prev) => ({ ...prev, isLoading: false }))
        }
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Sync failed'
        setData((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }))
        return { success: false, error: errorMessage }
      }
    },
    [isConfigured, serviceConfig, fetchData, sheetConfig, googleSheetsCredentialId]
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
    // Requested date range (what we're querying for)
    requestedDateRange: {
      start: requestedRange.startDate,
      end: requestedRange.endDate,
    },
    // Actual data date range (what we found in the data)
    dataDateRange: actualDataDateRange,
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

  // For period comparison, compare totals for the period vs previous equal period
  // If we have 7 days of data, compare sum of those 7 days vs the prior 7 days
  
  const latestMeta = hasMeta ? meta[meta.length - 1] : null
  const previousMeta = hasMeta && meta.length > 1 ? meta[meta.length - 2] : null

  const latestGA4 = hasGA4 ? ga4[ga4.length - 1] : null
  const previousGA4 = hasGA4 && ga4.length > 1 ? ga4[ga4.length - 2] : null

  const latestShopify = hasShopify ? shopify[shopify.length - 1] : null
  const previousShopify = hasShopify && shopify.length > 1 ? shopify[shopify.length - 2] : null

  // Calculate totals for multi-day periods
  const metaTotals = meta.reduce((acc, m) => ({
    spend: acc.spend + m.spend,
    revenue: acc.revenue + m.revenue,
    impressions: acc.impressions + m.impressions,
    clicks: acc.clicks + m.clicks,
    purchases: acc.purchases + m.purchases,
  }), { spend: 0, revenue: 0, impressions: 0, clicks: 0, purchases: 0 })

  const ga4Totals = ga4.reduce((acc, g) => ({
    sessions: acc.sessions + g.sessions,
    users: acc.users + g.users,
    purchases: acc.purchases + g.purchases,
    revenue: acc.revenue + g.revenue,
  }), { sessions: 0, users: 0, purchases: 0, revenue: 0 })

  const shopifyTotals = shopify.reduce((acc, s) => ({
    total_orders: acc.total_orders + s.total_orders,
    total_revenue: acc.total_revenue + s.total_revenue,
    net_revenue: acc.net_revenue + s.net_revenue,
    new_customers: acc.new_customers + s.new_customers,
    total_returns: acc.total_returns + s.total_returns,
  }), { total_orders: 0, total_revenue: 0, net_revenue: 0, new_customers: 0, total_returns: 0 })

  return {
    meta: latestMeta
      ? {
          cpm: metaTotals.impressions > 0 ? (metaTotals.spend / metaTotals.impressions) * 1000 : 0,
          ctr: metaTotals.impressions > 0 ? (metaTotals.clicks / metaTotals.impressions) * 100 : 0,
          cpc: metaTotals.clicks > 0 ? metaTotals.spend / metaTotals.clicks : 0,
          cac: metaTotals.purchases > 0 ? metaTotals.spend / metaTotals.purchases : 0,
          roas: metaTotals.spend > 0 ? metaTotals.revenue / metaTotals.spend : 0,
          aov: metaTotals.purchases > 0 ? metaTotals.revenue / metaTotals.purchases : 0,
          spendChange: previousMeta ? calculateAccurateChange(latestMeta.spend, previousMeta.spend) : 0,
          revenueChange: previousMeta ? calculateAccurateChange(latestMeta.revenue, previousMeta.revenue) : 0,
        }
      : null,
    ga4: latestGA4
      ? {
          conversionRate: ga4Totals.sessions > 0 ? (ga4Totals.purchases / ga4Totals.sessions) * 100 : 0,
          aov: ga4Totals.purchases > 0 ? ga4Totals.revenue / ga4Totals.purchases : 0,
          bounceRate: latestGA4.bounce_rate,
          revenueChange: previousGA4 ? calculateAccurateChange(latestGA4.revenue, previousGA4.revenue) : 0,
          sessionsChange: previousGA4 ? calculateAccurateChange(latestGA4.sessions, previousGA4.sessions) : 0,
        }
      : null,
    shopify: latestShopify
      ? {
          revPerOrder: shopifyTotals.total_orders > 0 ? shopifyTotals.total_revenue / shopifyTotals.total_orders : 0,
          newCustomerPercent: shopifyTotals.total_orders > 0 ? (shopifyTotals.new_customers / shopifyTotals.total_orders) * 100 : 0,
          returnRate: shopifyTotals.total_orders > 0 ? (shopifyTotals.total_returns / shopifyTotals.total_orders) * 100 : 0,
          revenueChange: previousShopify ? calculateAccurateChange(latestShopify.total_revenue, previousShopify.total_revenue) : 0,
          ordersChange: previousShopify ? calculateAccurateChange(latestShopify.total_orders, previousShopify.total_orders) : 0,
        }
      : null,
  }
}
