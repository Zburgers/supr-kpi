import { useState, useMemo } from 'react'
import { Header } from '@/components/header'
import { EnhancedMetricCard, EnhancedMetricGrid } from '@/components/dashboard/enhanced-metric-card'
import { ServiceStatusCard } from '@/components/dashboard/service-status-card'
import { RevenueChart, RevenueComparisonChart, TodayRevenueBar } from '@/components/dashboard/charts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useDashboardData, useCalculatedMetrics } from '@/hooks/use-dashboard-data'
import { useServiceConfig } from '@/hooks/useServiceConfig'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { navigate } from '@/lib/navigation'
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
  AlertTriangle,
  Settings,
  BarChart4
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
    syncAll,
  } = useDashboardData(dateRange)

  const { isConfigured } = useServiceConfig()
  const metrics = useCalculatedMetrics(meta, ga4, shopify)

  // Get latest raw data for summary
  const latestMeta = meta[meta.length - 1]
  const latestGA4 = ga4[ga4.length - 1]
  const latestShopify = shopify[shopify.length - 1]


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

  // Determine which services are available
  const availableServices = useMemo(() => {
    const services = []
    
    if (isConfigured('meta')) {
      services.push('meta')
    } else {
      services.push('meta-unconfigured')
    }
    
    if (isConfigured('ga4')) {
      services.push('ga4')
    } else {
      services.push('ga4-unconfigured')
    }
    
    if (isConfigured('shopify')) {
      services.push('shopify')
    } else {
      services.push('shopify-unconfigured')
    }
    
    return services
  }, [isConfigured])

  // Calculate cross-platform metrics
  const crossPlatformMetrics = useMemo(() => {
    const totalSessions = latestGA4?.sessions || 0
    const totalPurchases = (latestMeta?.purchases || 0) + (latestGA4?.purchases || 0) + (latestShopify?.total_orders || 0)
    const totalAddToCart = (latestMeta?.add_to_cart || 0) + (latestGA4?.add_to_cart || 0)
    const totalRevenueAll = (latestMeta?.revenue || 0) + (latestGA4?.revenue || 0) + (latestShopify?.total_revenue || 0)
    const totalSpendAll = (latestMeta?.spend || 0)

    return {
      totalTraffic: totalSessions,
      totalConversions: totalPurchases,
      conversionRate: totalSessions > 0 ? (totalPurchases / totalSessions) * 100 : 0,
      totalRevenue: totalRevenueAll,
      totalSpend: totalSpendAll,
      overallROAS: totalSpendAll > 0 ? totalRevenueAll / totalSpendAll : 0,
      addToCartRate: totalSessions > 0 ? (totalAddToCart / totalSessions) * 100 : 0
    }
  }, [latestMeta, latestGA4, latestShopify])

  // Handle service configuration
  const handleConfigureService = (_platform: 'meta' | 'ga4' | 'shopify') => {
    navigate('/settings/credentials')
  }

  // Prepare service status data
  const serviceStatusData = [
    {
      platform: 'meta' as const,
      title: 'Meta Ads',
      description: 'Connect your Facebook Ads account to track ad spend, reach, and conversions',
      icon: <span className="text-blue-500">📘</span>,
      status: isConfigured('meta') ? 'configured' as const : 'unconfigured' as const,
    },
    {
      platform: 'ga4' as const,
      title: 'Google Analytics 4',
      description: 'Connect your GA4 property to track sessions, users, and revenue',
      icon: <span className="text-blue-400">📊</span>,
      status: isConfigured('ga4') ? 'configured' as const : 'unconfigured' as const,
    },
    {
      platform: 'shopify' as const,
      title: 'Shopify',
      description: 'Connect your Shopify store to track orders, revenue, and customer data',
      icon: <span className="text-green-500">🏪</span>,
      status: isConfigured('shopify') ? 'configured' as const : 'unconfigured' as const,
    }
  ]

  return (
    <div className="min-h-screen w-full bg-background">
      <Header
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onSync={syncAll}
        isSyncing={isLoading}
        lastUpdated={lastSynced}
      />

      <main className="w-full max-w-7xl mx-auto px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <h3 className="font-semibold text-red-500 mb-2">Error</h3>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Overview Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Business Overview</h2>
              <p className="text-muted-foreground">
                Your key performance metrics across all platforms
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {dateRange === 'yesterday'
                ? 'Yesterday'
                : dateRange === '7d'
                ? 'Last 7 Days'
                : dateRange === '30d'
                ? 'Last 30 Days'
                : 'Month to Date'}
            </Badge>
          </div>

          {isLoading ? (
            <EnhancedMetricGrid cols="4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </EnhancedMetricGrid>
          ) : (
            <EnhancedMetricGrid cols="4">
              <EnhancedMetricCard
                label="Total Revenue"
                value={crossPlatformMetrics.totalRevenue}
                change={metrics.shopify?.revenueChange}
                format="currency"
                icon={<DollarSign className="h-4 w-4" />}
                platform="shopify"
              />
              <EnhancedMetricCard
                label="Total Ad Spend"
                value={crossPlatformMetrics.totalSpend}
                change={metrics.meta?.spendChange}
                format="currency"
                icon={<Target className="h-4 w-4" />}
                platform="meta"
              />
              <EnhancedMetricCard
                label="Total Orders"
                value={crossPlatformMetrics.totalConversions}
                change={metrics.shopify?.ordersChange}
                format="number"
                icon={<ShoppingCart className="h-4 w-4" />}
                platform="shopify"
              />
              <EnhancedMetricCard
                label="Overall ROAS"
                value={crossPlatformMetrics.overallROAS}
                change={metrics.meta?.revenueChange}
                format="multiplier"
                icon={<TrendingUp className="h-4 w-4" />}
                platform="meta"
              />
            </EnhancedMetricGrid>
          )}
        </section>

        {/* Cross-Platform Metrics */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight">Cross-Platform Metrics</h2>
          </div>
          
          {isLoading ? (
            <EnhancedMetricGrid cols="3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </EnhancedMetricGrid>
          ) : (
            <EnhancedMetricGrid cols="3">
              <EnhancedMetricCard
                label="Total Traffic"
                value={crossPlatformMetrics.totalTraffic}
                format="number"
                icon={<Users className="h-4 w-4" />}
                platform="ga4"
              />
              <EnhancedMetricCard
                label="Conversion Rate"
                value={crossPlatformMetrics.conversionRate}
                format="percent"
                icon={<BarChart4 className="h-4 w-4" />}
                platform="ga4"
              />
              <EnhancedMetricCard
                label="Add to Cart Rate"
                value={crossPlatformMetrics.addToCartRate}
                format="percent"
                icon={<ShoppingCart className="h-4 w-4" />}
                platform="meta"
              />
            </EnhancedMetricGrid>
          )}
        </section>

        {/* Service Status Section - Only show unconfigured services */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight">Service Status</h2>
          </div>
          
          <EnhancedMetricGrid cols="3">
            {serviceStatusData
              .filter(service => service.status === 'unconfigured')
              .map((service) => (
                <ServiceStatusCard
                  key={service.platform}
                  platform={service.platform}
                  status={service.status}
                  title={service.title}
                  description={service.description}
                  icon={service.icon}
                  onConfigure={() => handleConfigureService(service.platform)}
                />
              ))}
          </EnhancedMetricGrid>
        </section>

        {/* Platform Tabs - Only show configured services */}
        {availableServices.some(s => s !== 'meta-unconfigured' && s !== 'ga4-unconfigured' && s !== 'shopify-unconfigured') && (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
              <TabsTrigger value="all">All</TabsTrigger>
              {isConfigured('meta') && <TabsTrigger value="meta">Meta</TabsTrigger>}
              {isConfigured('ga4') && <TabsTrigger value="ga4">GA4</TabsTrigger>}
              {isConfigured('shopify') && <TabsTrigger value="shopify">Shopify</TabsTrigger>}
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

              {/* Platform Summary Cards - Only show configured platforms */}
              <div className="grid gap-6 md:grid-cols-3">
                {isConfigured('meta') && (
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
                )}

                {isConfigured('ga4') && (
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
                )}

                {isConfigured('shopify') && (
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
                )}
              </div>

              {/* Today's Revenue Bar */}
              <TodayRevenueBar
                metaRevenue={latestMeta?.revenue || 0}
                ga4Revenue={latestGA4?.revenue || 0}
                shopifyRevenue={latestShopify?.total_revenue || 0}
              />
            </TabsContent>

            {/* Meta Tab */}
            {isConfigured('meta') && (
              <TabsContent value="meta" className="space-y-6">
                <EnhancedMetricGrid cols="4">
                  <EnhancedMetricCard
                    label="Ad Spend"
                    value={latestMeta?.spend || 0}
                    change={metrics.meta?.spendChange}
                    format="currency"
                    icon={<DollarSign className="h-4 w-4" />}
                    platform="meta"
                  />
                  <EnhancedMetricCard
                    label="Impressions"
                    value={latestMeta?.impressions || 0}
                    format="number"
                    icon={<Eye className="h-4 w-4" />}
                    platform="meta"
                  />
                  <EnhancedMetricCard
                    label="Clicks"
                    value={latestMeta?.clicks || 0}
                    format="number"
                    icon={<MousePointerClick className="h-4 w-4" />}
                    platform="meta"
                  />
                  <EnhancedMetricCard
                    label="CTR"
                    value={metrics.meta?.ctr || 0}
                    format="percent"
                    icon={<Target className="h-4 w-4" />}
                    platform="meta"
                  />
                </EnhancedMetricGrid>

                <EnhancedMetricGrid cols="4">
                  <EnhancedMetricCard
                    label="Revenue"
                    value={latestMeta?.revenue || 0}
                    change={metrics.meta?.revenueChange}
                    format="currency"
                    icon={<TrendingUp className="h-4 w-4" />}
                    platform="meta"
                  />
                  <EnhancedMetricCard
                    label="ROAS"
                    value={metrics.meta?.roas || 0}
                    format="multiplier"
                    icon={<BarChart3 className="h-4 w-4" />}
                    platform="meta"
                  />
                  <EnhancedMetricCard
                    label="CPM"
                    value={metrics.meta?.cpm || 0}
                    format="currency"
                    icon={<Percent className="h-4 w-4" />}
                    platform="meta"
                  />
                  <EnhancedMetricCard
                    label="CPC"
                    value={metrics.meta?.cpc || 0}
                    format="currency"
                    icon={<MousePointerClick className="h-4 w-4" />}
                    platform="meta"
                  />
                </EnhancedMetricGrid>

                <RevenueChart
                  data={meta.map(m => ({ date: m.date, spend: m.spend }))}
                  title="Meta Ads Spend Over Time"
                  dataKey="spend"
                  color="var(--color-meta)"
                  type="area"
                />
              </TabsContent>
            )}

            {/* GA4 Tab */}
            {isConfigured('ga4') && (
              <TabsContent value="ga4" className="space-y-6">
                <EnhancedMetricGrid cols="4">
                  <EnhancedMetricCard
                    label="Sessions"
                    value={latestGA4?.sessions || 0}
                    change={metrics.ga4?.sessionsChange}
                    format="number"
                    icon={<Users className="h-4 w-4" />}
                    platform="ga4"
                  />
                  <EnhancedMetricCard
                    label="Users"
                    value={latestGA4?.users || 0}
                    format="number"
                    icon={<Users className="h-4 w-4" />}
                    platform="ga4"
                  />
                  <EnhancedMetricCard
                    label="Purchases"
                    value={latestGA4?.purchases || 0}
                    format="number"
                    icon={<ShoppingCart className="h-4 w-4" />}
                    platform="ga4"
                  />
                  <EnhancedMetricCard
                    label="Revenue"
                    value={latestGA4?.revenue || 0}
                    change={metrics.ga4?.revenueChange}
                    format="currency"
                    icon={<DollarSign className="h-4 w-4" />}
                    platform="ga4"
                  />
                </EnhancedMetricGrid>

                <EnhancedMetricGrid cols="4">
                  <EnhancedMetricCard
                    label="Conversion Rate"
                    value={metrics.ga4?.conversionRate || 0}
                    format="percent"
                    icon={<Target className="h-4 w-4" />}
                    platform="ga4"
                  />
                  <EnhancedMetricCard
                    label="Bounce Rate"
                    value={metrics.ga4?.bounceRate || 0}
                    format="percent"
                    icon={<RefreshCw className="h-4 w-4" />}
                    platform="ga4"
                  />
                  <EnhancedMetricCard
                    label="AOV"
                    value={metrics.ga4?.aov || 0}
                    format="currency"
                    icon={<TrendingUp className="h-4 w-4" />}
                    platform="ga4"
                  />
                  <EnhancedMetricCard
                    label="Add to Cart"
                    value={latestGA4?.add_to_cart || 0}
                    format="number"
                    icon={<ShoppingCart className="h-4 w-4" />}
                    platform="ga4"
                  />
                </EnhancedMetricGrid>

                <RevenueChart
                  data={ga4.map(g => ({ date: g.date, sessions: g.sessions }))}
                  title="GA4 Sessions Over Time"
                  dataKey="sessions"
                  color="var(--color-ga4)"
                  type="line"
                />
              </TabsContent>
            )}

            {/* Shopify Tab */}
            {isConfigured('shopify') && (
              <TabsContent value="shopify" className="space-y-6">
                <EnhancedMetricGrid cols="4">
                  <EnhancedMetricCard
                    label="Total Revenue"
                    value={latestShopify?.total_revenue || 0}
                    change={metrics.shopify?.revenueChange}
                    format="currency"
                    icon={<DollarSign className="h-4 w-4" />}
                    platform="shopify"
                  />
                  <EnhancedMetricCard
                    label="Orders"
                    value={latestShopify?.total_orders || 0}
                    change={metrics.shopify?.ordersChange}
                    format="number"
                    icon={<ShoppingCart className="h-4 w-4" />}
                    platform="shopify"
                  />
                  <EnhancedMetricCard
                    label="Net Revenue"
                    value={latestShopify?.net_revenue || 0}
                    format="currency"
                    icon={<TrendingUp className="h-4 w-4" />}
                    platform="shopify"
                  />
                  <EnhancedMetricCard
                    label="Revenue Per Order"
                    value={metrics.shopify?.revPerOrder || 0}
                    format="currency"
                    icon={<BarChart3 className="h-4 w-4" />}
                    platform="shopify"
                  />
                </EnhancedMetricGrid>

                <EnhancedMetricGrid cols="4">
                  <EnhancedMetricCard
                    label="New Customers"
                    value={latestShopify?.new_customers || 0}
                    format="number"
                    icon={<Users className="h-4 w-4" />}
                    platform="shopify"
                  />
                  <EnhancedMetricCard
                    label="Repeat Customers"
                    value={latestShopify?.repeat_customers || 0}
                    format="number"
                    icon={<Users className="h-4 w-4" />}
                    platform="shopify"
                  />
                  <EnhancedMetricCard
                    label="Returns"
                    value={latestShopify?.total_returns || 0}
                    format="number"
                    icon={<RefreshCw className="h-4 w-4" />}
                    platform="shopify"
                  />
                  <EnhancedMetricCard
                    label="Return Rate"
                    value={metrics.shopify?.returnRate || 0}
                    format="percent"
                    icon={<Percent className="h-4 w-4" />}
                    platform="shopify"
                  />
                </EnhancedMetricGrid>

                <RevenueChart
                  data={shopify.map(s => ({ date: s.date, revenue: s.total_revenue }))}
                  title="Shopify Revenue Over Time"
                  dataKey="revenue"
                  color="var(--color-shopify)"
                  type="bar"
                />
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* Show message when no services are configured */}
        {availableServices.every(s => s.includes('unconfigured')) && (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Services Configured</h3>
            <p className="text-muted-foreground mb-4">
              Get started by connecting your marketing and e-commerce platforms
            </p>
            <Button 
              onClick={() => navigate('/settings/credentials')}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configure Services
            </Button>
          </div>
        )}
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
              Pegasus - KPI tracking for modern e-commerce
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}