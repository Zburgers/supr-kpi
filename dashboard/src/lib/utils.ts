import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { DateRange } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(value))
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value)
}

export function getChangeType(change: number): 'positive' | 'negative' | 'neutral' {
  if (change > 0) return 'positive'
  if (change < 0) return 'negative'
  return 'neutral'
}

export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Calculate percentage change with proper handling of edge cases
 */
export function calculateAccurateChange(current: number, previous: number): number {
  // Handle identical values
  if (current === previous) return 0
  
  // Handle zero previous (can't divide)
  if (previous === 0) {
    return current > 0 ? 100 : -100
  }
  
  // Standard percentage change calculation
  return ((current - previous) / Math.abs(previous)) * 100
}

export function getDateRange(range: DateRange): { startDate: string; endDate: string } {
  const now = new Date()

  const start = new Date(now)
  const end = new Date(now)

  switch (range) {
    case 'yesterday':
      end.setDate(end.getDate() - 1)
      start.setTime(end.getTime())
      break
    case '7d':
      end.setDate(end.getDate() - 1)
      start.setTime(end.getTime())
      start.setDate(start.getDate() - 6)
      break
    case '30d':
      end.setDate(end.getDate() - 1)
      start.setTime(end.getTime())
      start.setDate(start.getDate() - 29)
      break
    case 'mtd':
    default:
      start.setDate(1)
      break
  }

  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  }
  
  // If same day, just show one date
  if (startDate === endDate) {
    return start.toLocaleDateString('en-US', formatOptions)
  }
  
  // If same month, show "Dec 18-24"
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}-${end.getDate()}`
  }
  
  // Different months: "Nov 25 - Dec 24"
  return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`
}

/**
 * Get a human-readable label for a date range
 */
export function getDateRangeLabel(range: DateRange): string {
  switch (range) {
    case 'yesterday':
      return 'Yesterday'
    case '7d':
      return 'Last 7 Days'
    case '30d':
      return 'Last 30 Days'
    case 'mtd':
      return 'Month to Date'
    default:
      return 'Custom Range'
  }
}
