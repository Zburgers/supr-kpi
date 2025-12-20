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
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
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
