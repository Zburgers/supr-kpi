import { useState, useMemo } from 'react'
import { Header } from '@/components/header'
import { MetricCard, MetricGrid } from '@/components/dashboard/metric-card'
import { RevenueChart, RevenueComparisonChart, TodayRevenueBar } from '@/components/dashboard/charts'
import { MetaDataTable, GA4DataTable, ShopifyDataTable } from '@/components/dashboard/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDashboardData, useCalculatedMetrics } from '@/hooks/use-dashboard-data'
import { formatCurrency, formatNumber, getDateRangeLabel } from '@/lib/utils'
import type { DateRange } from '@/types'
import {
  DollarSign,
  TrendingUp,
  MousePointerClick,
  Eye,
  ShoppingCart,
  Users,
  Target,
  BarChart3,
  Percent,
  RefreshCw,
  AlertCircle,
  Info,
} from 'lucide-react'

export function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('yesterday')
  const {
    meta,
    ga4,
    shopify,
    isLoading,
    error,
    lastSynced,
    dataDateRange,
    syncAll,
  } = useDashboardData(dateRange)

  const metrics = useCalculatedMetrics(meta, ga4, shopify)

  // Get latest raw data for summary
  const latestMeta = meta[meta.length - 1]
  const latestGA4 = ga4[ga4.length - 1]
  const latestShopify = shopify[shopify.length - 1]

  // Calculate totals for summary cards (sum all data in range for aggregate view)
  const totalRevenue = shopify.reduce((sum, s) => sum + s.total_revenue, 0)
  const totalSpend = meta.reduce((sum, m) => sum + m.spend, 0)
  const totalOrders = shopify.reduce((sum, s) => sum + s.total_orders, 0)
  const blendedROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0

  // Data availability indicators
  const hasMetaData = meta.length > 0
  const hasGA4Data = ga4.length > 0
  const hasShopifyData = shopify.length > 0
  const hasAnyData = hasMetaData || hasGA4Data || hasShopifyData

  // Prepare chart data
  const combinedChartData = useMemo(() => {
    const map = new Map<string, { date: string; metaRevenue: number; ga4Revenue: number; shopifyRevenue: number }>()

    const ensureEntry = (date: string) => {
      if (!map.has(date)) {
        map.set(date, { date, metaRevenue: 0, ga4Revenue: 0, shopifyRevenue: 0 })
      }
      return map.get(date)!
    }

    meta.forEach((m) => {
      const entry = ensureEntry(m.date)
      entry.metaRevenue = m.revenue
    })

    ga4.forEach((g) => {
      const entry = ensureEntry(g.date)
      entry.ga4Revenue = g.revenue
    })

    shopify.forEach((s) => {
      const entry = ensureEntry(s.date)
      entry.shopifyRevenue = s.total_revenue
    })

    const normalizeDate = (value: string) => {
      const ts = new Date(value).getTime()
      return Number.isNaN(ts) ? 0 : ts
    }

    return Array.from(map.values()).sort(
      (a, b) => normalizeDate(a.date) - normalizeDate(b.date)
    )
  }, [meta, ga4, shopify])

  return (
    <div className="min-h-screen w-full bg-background">
      <Header
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onSync={syncAll}
        isSyncing={isLoading}
        lastUpdated={lastSynced}
        dataDateRange={dataDateRange}
      />

      <main className="w-full max-w-7xl mx-auto px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* No Data Info */}
        {!isLoading && !error && !hasAnyData && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>No Data Available</AlertTitle>
            <AlertDescription>
              No data found for {getDateRangeLabel(dateRange)}. Make sure your Google Sheets are configured and contain data for the selected date range.
            </AlertDescription>
          </Alert>
        )}

        {/* Business Overview Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Business Overview</h2>
              <p className="text-muted-foreground">
                Your key performance metrics across all platforms
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-medium">
              {getDateRangeLabel(dateRange)}
            </Badge>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total Revenue"
                value={totalRevenue}
                change={metrics.shopify?.revenueChange}
                format="currency"
                icon={<DollarSign className="h-4 w-4" />}
                platform="shopify"
              />
              <MetricCard
                label="Ad Spend"
                value={totalSpend}
                change={metrics.meta?.spendChange}
                format="currency"
                icon={<Target className="h-4 w-4" />}
                platform="meta"
              />
              <MetricCard
                label="Total Orders"
                value={totalOrders}
                change={metrics.shopify?.ordersChange}
                format="number"
                icon={<ShoppingCart className="h-4 w-4" />}
                platform="shopify"
              />
              <MetricCard
                label="Blended ROAS"
                value={blendedROAS}
                change={metrics.meta?.revenueChange}
                format="multiplier"
                icon={<TrendingUp className="h-4 w-4" />}
                platform="meta"
              />
            </div>
          )}
        </section>

        {/* Platform Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="meta">Meta</TabsTrigger>
            <TabsTrigger value="ga4">GA4</TabsTrigger>
            <TabsTrigger value="shopify">Shopify</TabsTrigger>
          </TabsList>

          {/* All Platforms View */}
          <TabsContent value="all" className="space-y-6">
            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Revenue Overview
                </CardTitle>
                <CardDescription>
                  Combined revenue across all platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <RevenueComparisonChart
                    data={combinedChartData}
                    title="Revenue by Platform"
                  />
                )}
              </CardContent>
            </Card>

            {/* Platform Summary Cards */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Meta Summary */}
              <Card className="border-l-4 border-l-[var(--color-meta)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>📘</span> Meta Ads
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Spend</span>
                    <span className="font-semibold">{formatCurrency(latestMeta?.spend || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Impressions</span>
                    <span className="font-semibold">{formatNumber(latestMeta?.impressions || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clicks</span>
                    <span className="font-semibold">{formatNumber(latestMeta?.clicks || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CTR</span>
                    <span className="font-semibold">{metrics.meta ? metrics.meta.ctr.toFixed(2) : '0'}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ROAS</span>
                    <span className="font-semibold">{metrics.meta ? metrics.meta.roas.toFixed(2) : '0'}x</span>
                  </div>
                </CardContent>
              </Card>

              {/* GA4 Summary */}
              <Card className="border-l-4 border-l-[var(--color-ga4)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>📊</span> Google Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sessions</span>
                    <span className="font-semibold">{formatNumber(latestGA4?.sessions || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Users</span>
                    <span className="font-semibold">{formatNumber(latestGA4?.users || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bounce Rate</span>
                    <span className="font-semibold">{metrics.ga4 ? metrics.ga4.bounceRate.toFixed(1) : '0'}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conversion Rate</span>
                    <span className="font-semibold">{metrics.ga4 ? metrics.ga4.conversionRate.toFixed(2) : '0'}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-semibold">{formatCurrency(latestGA4?.revenue || 0)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Shopify Summary */}
              <Card className="border-l-4 border-l-[var(--color-shopify)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>🏪</span> Shopify
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Revenue</span>
                    <span className="font-semibold">{formatCurrency(latestShopify?.total_revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Revenue</span>
                    <span className="font-semibold">{formatCurrency(latestShopify?.net_revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Orders</span>
                    <span className="font-semibold">{formatNumber(latestShopify?.total_orders || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AOV</span>
                    <span className="font-semibold">{formatCurrency(metrics.shopify?.revPerOrder || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Customers</span>
                    <span className="font-semibold">{metrics.shopify ? metrics.shopify.newCustomerPercent.toFixed(1) : '0'}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Today's Revenue Bar */}
            <TodayRevenueBar
              metaRevenue={latestMeta?.revenue || 0}
              ga4Revenue={latestGA4?.revenue || 0}
              shopifyRevenue={latestShopify?.total_revenue || 0}
            />
          </TabsContent>

          {/* Meta Tab */}
          <TabsContent value="meta" className="space-y-6">
            <MetricGrid>
              <MetricCard
                label="Ad Spend"
                value={latestMeta?.spend || 0}
                change={metrics.meta?.spendChange}
                format="currency"
                icon={<DollarSign className="h-4 w-4" />}
                platform="meta"
              />
              <MetricCard
                label="Impressions"
                value={latestMeta?.impressions || 0}
                format="number"
                icon={<Eye className="h-4 w-4" />}
                platform="meta"
              />
              <MetricCard
                label="Clicks"
                value={latestMeta?.clicks || 0}
                format="number"
                icon={<MousePointerClick className="h-4 w-4" />}
                platform="meta"
              />
              <MetricCard
                label="CTR"
                value={metrics.meta?.ctr || 0}
                format="percent"
                icon={<Target className="h-4 w-4" />}
                platform="meta"
              />
            </MetricGrid>

            <MetricGrid>
              <MetricCard
                label="Revenue"
                value={latestMeta?.revenue || 0}
                change={metrics.meta?.revenueChange}
                format="currency"
                icon={<TrendingUp className="h-4 w-4" />}
                platform="meta"
              />
              <MetricCard
                label="ROAS"
                value={metrics.meta?.roas || 0}
                format="multiplier"
                icon={<BarChart3 className="h-4 w-4" />}
                platform="meta"
              />
              <MetricCard
                label="CPM"
                value={metrics.meta?.cpm || 0}
                format="currency"
                icon={<Percent className="h-4 w-4" />}
                platform="meta"
              />
              <MetricCard
                label="CPC"
                value={metrics.meta?.cpc || 0}
                format="currency"
                icon={<MousePointerClick className="h-4 w-4" />}
                platform="meta"
              />
            </MetricGrid>

            <RevenueChart
              data={meta.map(m => ({ date: m.date, spend: m.spend }))}
              title="Meta Ads Spend Over Time"
              dataKey="spend"
              color="var(--color-meta)"
              type="area"
            />

            <MetaDataTable data={meta} platform="meta" title="Daily Meta Ads Data" />
          </TabsContent>

          {/* GA4 Tab */}
          <TabsContent value="ga4" className="space-y-6">
            <MetricGrid>
              <MetricCard
                label="Sessions"
                value={latestGA4?.sessions || 0}
                change={metrics.ga4?.sessionsChange}
                format="number"
                icon={<Users className="h-4 w-4" />}
                platform="ga4"
              />
              <MetricCard
                label="Users"
                value={latestGA4?.users || 0}
                format="number"
                icon={<Users className="h-4 w-4" />}
                platform="ga4"
              />
              <MetricCard
                label="Purchases"
                value={latestGA4?.purchases || 0}
                format="number"
                icon={<ShoppingCart className="h-4 w-4" />}
                platform="ga4"
              />
              <MetricCard
                label="Revenue"
                value={latestGA4?.revenue || 0}
                change={metrics.ga4?.revenueChange}
                format="currency"
                icon={<DollarSign className="h-4 w-4" />}
                platform="ga4"
              />
            </MetricGrid>

            <MetricGrid>
              <MetricCard
                label="Conversion Rate"
                value={metrics.ga4?.conversionRate || 0}
                format="percent"
                icon={<Target className="h-4 w-4" />}
                platform="ga4"
              />
              <MetricCard
                label="Bounce Rate"
                value={metrics.ga4?.bounceRate || 0}
                format="percent"
                icon={<RefreshCw className="h-4 w-4" />}
                platform="ga4"
              />
              <MetricCard
                label="AOV"
                value={metrics.ga4?.aov || 0}
                format="currency"
                icon={<TrendingUp className="h-4 w-4" />}
                platform="ga4"
              />
              <MetricCard
                label="Add to Cart"
                value={latestGA4?.add_to_cart || 0}
                format="number"
                icon={<ShoppingCart className="h-4 w-4" />}
                platform="ga4"
              />
            </MetricGrid>

            <RevenueChart
              data={ga4.map(g => ({ date: g.date, sessions: g.sessions }))}
              title="GA4 Sessions Over Time"
              dataKey="sessions"
              color="var(--color-ga4)"
              type="line"
            />

            <GA4DataTable data={ga4} platform="ga4" title="Daily GA4 Data" />
          </TabsContent>

          {/* Shopify Tab */}
          <TabsContent value="shopify" className="space-y-6">
            <MetricGrid>
              <MetricCard
                label="Total Revenue"
                value={latestShopify?.total_revenue || 0}
                change={metrics.shopify?.revenueChange}
                format="currency"
                icon={<DollarSign className="h-4 w-4" />}
                platform="shopify"
              />
              <MetricCard
                label="Orders"
                value={latestShopify?.total_orders || 0}
                change={metrics.shopify?.ordersChange}
                format="number"
                icon={<ShoppingCart className="h-4 w-4" />}
                platform="shopify"
              />
              <MetricCard
                label="Net Revenue"
                value={latestShopify?.net_revenue || 0}
                format="currency"
                icon={<TrendingUp className="h-4 w-4" />}
                platform="shopify"
              />
              <MetricCard
                label="Revenue Per Order"
                value={metrics.shopify?.revPerOrder || 0}
                format="currency"
                icon={<BarChart3 className="h-4 w-4" />}
                platform="shopify"
              />
            </MetricGrid>

            <MetricGrid>
              <MetricCard
                label="New Customers"
                value={latestShopify?.new_customers || 0}
                format="number"
                icon={<Users className="h-4 w-4" />}
                platform="shopify"
              />
              <MetricCard
                label="Repeat Customers"
                value={latestShopify?.repeat_customers || 0}
                format="number"
                icon={<Users className="h-4 w-4" />}
                platform="shopify"
              />
              <MetricCard
                label="Returns"
                value={latestShopify?.total_returns || 0}
                format="number"
                icon={<RefreshCw className="h-4 w-4" />}
                platform="shopify"
              />
              <MetricCard
                label="Return Rate"
                value={metrics.shopify?.returnRate || 0}
                format="percent"
                icon={<Percent className="h-4 w-4" />}
                platform="shopify"
              />
            </MetricGrid>

            <RevenueChart
              data={shopify.map(s => ({ date: s.date, revenue: s.total_revenue }))}
              title="Shopify Revenue Over Time"
              dataKey="revenue"
              color="var(--color-shopify)"
              type="bar"
            />

            <ShopifyDataTable data={shopify} platform="shopify" title="Daily Shopify Data" />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-8">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/pegasus-icon.svg" alt="Pegasus" className="h-5 w-5 opacity-60" />
              <span className="text-sm text-muted-foreground">
                Pegasus Analytics Platform
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Unified KPI tracking for modern e-commerce
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
