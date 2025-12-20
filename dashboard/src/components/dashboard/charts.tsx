import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useTheme } from '@/components/theme-provider'

interface ChartData {
  date: string
  [key: string]: string | number
}

interface RevenueChartProps {
  data: ChartData[]
  title: string
  dataKey: string
  color: string
  type?: 'line' | 'area' | 'bar'
}

export function RevenueChart({ data, title, dataKey, color, type = 'area' }: RevenueChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const formattedData = data.map((item) => ({
    ...item,
    dateLabel: formatDate(item.date),
  }))

  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const textColor = isDark ? '#9ca3af' : '#6b7280'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          {type === 'area' ? (
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10, fill: textColor }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: textColor }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#1f2937' : '#ffffff',
                  border: `1px solid ${gridColor}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${dataKey})`}
              />
            </AreaChart>
          ) : type === 'line' ? (
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10, fill: textColor }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: textColor }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#1f2937' : '#ffffff',
                  border: `1px solid ${gridColor}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : (
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10, fill: textColor }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: textColor }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#1f2937' : '#ffffff',
                  border: `1px solid ${gridColor}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
              />
              <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface ComparisonChartProps {
  data: ChartData[]
  title: string
}

export function RevenueComparisonChart({ data, title }: ComparisonChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const formattedData = data.map((item) => ({
    ...item,
    dateLabel: formatDate(item.date),
  }))

  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const textColor = isDark ? '#9ca3af' : '#6b7280'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: textColor }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: textColor }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                border: `1px solid ${gridColor}`,
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              iconType="circle"
            />
            <Line
              type="monotone"
              dataKey="metaRevenue"
              name="Meta Ads"
              stroke="var(--color-meta)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="ga4Revenue"
              name="GA4"
              stroke="var(--color-ga4)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="shopifyRevenue"
              name="Shopify"
              stroke="var(--color-shopify)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface TodayRevenueBarProps {
  metaRevenue: number
  ga4Revenue: number
  shopifyRevenue: number
}

export function TodayRevenueBar({ metaRevenue, ga4Revenue, shopifyRevenue }: TodayRevenueBarProps) {
  const maxRevenue = Math.max(metaRevenue, ga4Revenue, shopifyRevenue)

  const platforms = [
    { name: 'Meta Ads', value: metaRevenue, color: 'var(--color-meta)' },
    { name: 'GA4', value: ga4Revenue, color: 'var(--color-ga4)' },
    { name: 'Shopify', value: shopifyRevenue, color: 'var(--color-shopify)' },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Today's Revenue by Source</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {platforms.map((platform) => (
          <div key={platform.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{platform.name}</span>
              <span className="font-semibold">{formatCurrency(platform.value)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${maxRevenue > 0 ? (platform.value / maxRevenue) * 100 : 0}%`,
                  backgroundColor: platform.color,
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
