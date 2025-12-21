import { UserButton } from '@clerk/clerk-react'
import { SheetViewerDialog } from './sheet-viewer-dialog'
import { ManualPullDialog } from './manual-pull-dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/components/theme-provider'
import { RefreshCw, Moon, Sun, Monitor, Zap, Settings, ChevronRight } from 'lucide-react'
import type { DateRange } from '@/types'

interface HeaderProps {
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  onSync: () => void
  isSyncing: boolean
  lastUpdated: Date | null
  showNavigation?: boolean
  breadcrumbs?: Array<{ label: string; href?: string }>
}

export function Header({
  dateRange,
  onDateRangeChange,
  onSync,
  isSyncing,
  lastUpdated,
  showNavigation = true,
  breadcrumbs,
}: HeaderProps) {
  const { theme, setTheme } = useTheme()

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never'
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-7xl mx-auto flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">KPI Command Center</h1>
          </div>
          
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" />
                  {crumb.href ? (
                    <a href={crumb.href} className="hover:text-foreground transition-colors">
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-foreground">{crumb.label}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {lastUpdated && !breadcrumbs && (
            <span className="hidden sm:inline text-xs text-muted-foreground">
              Last updated: {formatLastUpdated(lastUpdated)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {showNavigation && (
            <>
              {/* Date Range Selector */}
              <Select value={dateRange} onValueChange={(v) => onDateRangeChange(v as DateRange)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="mtd">Month to Date</SelectItem>
                </SelectContent>
              </Select>

              {/* Sync Button */}
              <Button onClick={onSync} disabled={isSyncing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync All'}</span>
              </Button>

              {/* Sheet Viewer */}
              <SheetViewerDialog />

              {/* Manual Data Pull */}
              <ManualPullDialog />
            </>
          )}

          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                {theme === 'light' ? (
                  <Sun className="h-4 w-4" />
                ) : theme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Monitor className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings Link */}
          {showNavigation && (
            <Button variant="outline" size="icon" asChild>
              <a href="/settings">
                <Settings className="h-4 w-4" />
              </a>
            </Button>
          )}

          {/* Removed legacy popup Settings dialog; use Settings page link instead */}
          
          {/* User Menu */}
          <UserButton 
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: 'h-9 w-9',
              }
            }}
          />
        </div>
      </div>
    </header>
  )
}
