import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import type { MetaRawDaily, GA4RawDaily, ShopifyRawDaily, Platform } from '@/types'

interface DataTableProps<T> {
  data: T[]
  platform: Platform
  title: string
}

const platformBadgeVariants: Record<Platform, 'meta' | 'ga4' | 'shopify'> = {
  meta: 'meta',
  ga4: 'ga4',
  shopify: 'shopify',
}

export function MetaDataTable({ data, platform, title }: DataTableProps<MetaRawDaily>) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Badge variant={platformBadgeVariants[platform]}>{platform.toUpperCase()}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Spend</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Reach</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Impressions</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Clicks</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">LPV</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">ATC</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">IC</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Purchases</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().slice(0, 7).map((row, i) => (
                <tr
                  key={row.date}
                  className={cn(
                    'border-b last:border-0 transition-colors hover:bg-muted/50',
                    i === 0 && 'bg-muted/30 font-medium'
                  )}
                >
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.spend)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.reach)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.impressions)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.clicks)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.landing_page_views)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.add_to_cart)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.initiate_checkout)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.purchases)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export function GA4DataTable({ data, platform, title }: DataTableProps<GA4RawDaily>) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Badge variant={platformBadgeVariants[platform]}>{platform.toUpperCase()}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Sessions</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Users</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Add to Cart</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Purchases</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Bounce Rate</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().slice(0, 7).map((row, i) => (
                <tr
                  key={row.date}
                  className={cn(
                    'border-b last:border-0 transition-colors hover:bg-muted/50',
                    i === 0 && 'bg-muted/30 font-medium'
                  )}
                >
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.sessions)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.users)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.add_to_cart)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.purchases)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.revenue)}</td>
                  <td className="px-4 py-3 text-right">{row.bounce_rate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export function ShopifyDataTable({ data, platform, title }: DataTableProps<ShopifyRawDaily>) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Badge variant={platformBadgeVariants[platform]}>{platform.toUpperCase()}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Orders</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Returns</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">New Customers</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Repeat</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().slice(0, 7).map((row, i) => (
                <tr
                  key={row.date}
                  className={cn(
                    'border-b last:border-0 transition-colors hover:bg-muted/50',
                    i === 0 && 'bg-muted/30 font-medium'
                  )}
                >
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.total_orders)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total_revenue)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.net_revenue)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.total_returns)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.new_customers)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.repeat_customers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
