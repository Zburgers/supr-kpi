import { cn, formatCurrency, formatNumber, formatPercent, getChangeType } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import type { Platform } from '@/types'
import React from 'react'

interface EnhancedMetricCardProps {
  label: string
  value: string | number
  change?: number
  platform: Platform
  icon?: React.ReactNode
  format?: 'currency' | 'number' | 'percent' | 'multiplier'
  trend?: 'up' | 'down' | 'neutral'
  isLoading?: boolean
}

const platformColors: Record<Platform, string> = {
  meta: 'border-l-[var(--color-meta)]',
  ga4: 'border-l-[var(--color-ga4)]',
  shopify: 'border-l-[var(--color-shopify)]',
}

const platformBadgeVariants: Record<Platform, 'meta' | 'ga4' | 'shopify'> = {
  meta: 'meta',
  ga4: 'ga4',
  shopify: 'shopify',
}

const platformGradients: Record<Platform, string> = {
  meta: 'from-[var(--color-meta)]/20 to-[var(--color-meta)]/5',
  ga4: 'from-[var(--color-ga4)]/20 to-[var(--color-ga4)]/5',
  shopify: 'from-[var(--color-shopify)]/20 to-[var(--color-shopify)]/5',
}

export function EnhancedMetricCard({
  label,
  value,
  change,
  platform,
  icon,
  format = 'number',
  isLoading = false,
}: EnhancedMetricCardProps) {
  const changeType = change !== undefined ? getChangeType(change) : 'neutral'
  const isPositive = changeType === 'positive'
  const isNegative = changeType === 'negative'

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

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        damping: 12,
        stiffness: 150,
      },
    },
    hover: {
      y: -4,
      transition: {
        type: 'spring' as const,
        damping: 12,
        stiffness: 200,
      },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="h-full"
    >
      <Card className={cn(
        "relative border-l-4 h-full overflow-hidden bg-gradient-to-br",
        platformColors[platform],
        platformGradients[platform],
        "hover:shadow-lg transition-all duration-300 hover:shadow-xl/20"
      )}>
        {/* Animated background element */}
        <div className="absolute inset-0 opacity-10">
          <div className={`absolute top-0 right-0 w-24 h-24 bg-[var(--color-${platform})] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`}></div>
        </div>
        
        <CardContent className="p-5 relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                {label}
              </span>
              <div className="mt-1 flex items-center gap-1">
                {icon && <span className="text-lg">{icon}</span>}
                {isLoading ? (
                  <div className="h-8 w-24 bg-muted rounded-md animate-pulse"></div>
                ) : (
                  <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
                    {formattedValue}
                  </span>
                )}
              </div>
            </div>
            <Badge 
              variant={platformBadgeVariants[platform]} 
              className="text-[10px] font-bold px-2 py-1"
            >
              {platform.toUpperCase()}
            </Badge>
          </div>

          {change !== undefined && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'flex items-center gap-1 mt-2 text-xs font-medium',
                isPositive && 'text-[var(--color-success)]',
                isNegative && 'text-[var(--color-error)]',
                changeType === 'neutral' && 'text-muted-foreground'
              )}
            >
              {isPositive ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : isNegative ? (
                <ArrowDownRight className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              <span>{Math.abs(change).toFixed(1)}% vs previous</span>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

interface MetricGridProps {
  children: React.ReactNode
  cols?: '2' | '3' | '4'
}

export function EnhancedMetricGrid({ children, cols = '4' }: MetricGridProps) {
  const gridClasses = {
    '2': 'grid-cols-1 sm:grid-cols-2',
    '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    '4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  }
  
  return (
    <div className={cn("grid gap-4", gridClasses[cols])}>
      {children}
    </div>
  )
}