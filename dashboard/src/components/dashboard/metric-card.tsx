import { cn, formatCurrency, formatNumber, formatPercent, getChangeType } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Platform } from '@/types'

interface MetricCardProps {
  label: string
  value: string | number
  change?: number
  platform: Platform
  icon?: React.ReactNode
  format?: 'currency' | 'number' | 'percent' | 'multiplier'
}

const platformColors: Record<Platform, string> = {
  meta: 'border-t-[var(--color-meta)]',
  ga4: 'border-t-[var(--color-ga4)]',
  shopify: 'border-t-[var(--color-shopify)]',
}

const platformBadgeVariants: Record<Platform, 'meta' | 'ga4' | 'shopify'> = {
  meta: 'meta',
  ga4: 'ga4',
  shopify: 'shopify',
}

export function MetricCard({
  label,
  value,
  change,
  platform,
  icon,
  format = 'number',
}: MetricCardProps) {
  const changeType = change !== undefined ? getChangeType(change) : 'neutral'

  const formattedValue =
    typeof value === 'number'
      ? format === 'currency'
        ? formatCurrency(value)
        : format === 'percent'
          ? formatPercent(value)
          : format === 'multiplier'
            ? `${value.toFixed(2)}x`
            : formatNumber(value)
      : value

  return (
    <Card className={cn('border-t-4 transition-all hover:shadow-md', platformColors[platform])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <Badge variant={platformBadgeVariants[platform]} className="text-[10px]">
            {platform.toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-baseline gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="text-2xl font-bold tracking-tight">{formattedValue}</span>
        </div>

        {change !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 mt-2 text-xs font-medium',
              changeType === 'positive' && 'text-[var(--color-success)]',
              changeType === 'negative' && 'text-[var(--color-error)]',
              changeType === 'neutral' && 'text-muted-foreground'
            )}
          >
            {changeType === 'positive' ? (
              <TrendingUp className="w-3 h-3" />
            ) : changeType === 'negative' ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            <span>{Math.abs(change).toFixed(1)}% vs previous</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface MetricGridProps {
  children: React.ReactNode
}

export function MetricGrid({ children }: MetricGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
      {children}
    </div>
  )
}
