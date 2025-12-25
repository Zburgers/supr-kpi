import { cn, formatCurrency, formatNumber, formatPercent, formatCompact, getChangeType } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Platform } from '@/types'

interface MetricCardProps {
  label: string
  value: string | number
  change?: number
  platform: Platform
  icon?: React.ReactNode
  format?: 'currency' | 'number' | 'percent' | 'multiplier'
  tooltip?: string
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
  tooltip,
}: MetricCardProps) {
  const changeType = change !== undefined && change !== 0 ? getChangeType(change) : 'neutral'

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

  // For large numbers, show compact version with tooltip for full value
  const numericValue = typeof value === 'number' ? value : 0
  const isLargeNumber = numericValue >= 100000 && format === 'number'
  const displayValue = isLargeNumber ? formatCompact(numericValue) : formattedValue

  const changeDisplay = change !== undefined && change !== 0 ? (
    <div
      className={cn(
        'flex items-center gap-1 mt-2 text-xs font-medium',
        changeType === 'positive' && 'text-emerald-500',
        changeType === 'negative' && 'text-red-500',
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
      <span>
        {changeType === 'positive' ? '+' : ''}{change.toFixed(1)}% vs prev day
      </span>
    </div>
  ) : null

  const card = (
    <Card className={cn('border-t-4 transition-all hover:shadow-md hover:scale-[1.02]', platformColors[platform])}>
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
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-2xl font-bold tracking-tight">{displayValue}</span>
        </div>

        {changeDisplay}
      </CardContent>
    </Card>
  )

  // Wrap with tooltip if needed
  if (tooltip || isLargeNumber) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip || formattedValue}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return card
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
