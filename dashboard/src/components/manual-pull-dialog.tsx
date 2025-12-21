import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useServiceConfig } from '@/hooks/useServiceConfig'
import * as api from '@/lib/api'
import { Download, Loader2, CheckCircle, XCircle, Calendar, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

interface PullResult {
  platform: string
  success: boolean
  message: string
  data?: unknown
}

export function ManualPullDialog() {
  const { isConfigured, loading: configLoading } = useServiceConfig()
  const [open, setOpen] = useState(false)
  const [targetDate, setTargetDate] = useState<string>(() => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  })
  const [isPulling, setIsPulling] = useState<Record<string, boolean>>({
    meta: false,
    ga4: false,
    shopify: false,
    all: false,
  })
  const [results, setResults] = useState<PullResult[]>([])

  const pullPlatform = async (platform: 'meta' | 'ga4' | 'shopify') => {
    const platformName = platform === 'meta' ? 'Meta' : platform === 'ga4' ? 'GA4' : 'Shopify'
    
    if (!isConfigured(platform)) {
      setResults(prev => [...prev, {
        platform: platformName,
        success: false,
        message: `${platformName} is not configured. Please configure it in Settings.`,
      }])
      return
    }

    setIsPulling(prev => ({ ...prev, [platform]: true }))
    try {
      // Use modern syncService which uses stored credentials from backend
      const response = await api.syncService(platform, { targetDate })

      setResults(prev => [...prev, {
        platform: platformName,
        success: response.success,
        message: response.success
          ? `${platformName} data for ${targetDate} synced successfully!`
          : response.error || `Failed to sync ${platformName} data`,
        data: response.success ? (response as { success: true; data: unknown }).data : undefined,
      }])
    } catch (error) {
      setResults(prev => [...prev, {
        platform: platformName,
        success: false,
        message: error instanceof Error ? error.message : `Failed to sync ${platformName} data`,
      }])
    } finally {
      setIsPulling(prev => ({ ...prev, [platform]: false }))
    }
  }

  const pullAll = async () => {
    setResults([])
    setIsPulling(prev => ({ ...prev, all: true }))

    await Promise.all([
      pullPlatform('meta'),
      pullPlatform('ga4'),
      pullPlatform('shopify'),
    ])

    setIsPulling(prev => ({ ...prev, all: false }))
  }

  const clearResults = () => {
    setResults([])
  }

  const isPullingAny = Object.values(isPulling).some(Boolean)

  // Check if any service needs configuration
  const needsConfiguration = !isConfigured('meta') && !isConfigured('ga4') && !isConfigured('shopify')

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) {
        clearResults()
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Manual Data Pull">
          <Download className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Manual Data Pull
          </DialogTitle>
          <DialogDescription>
            Manually fetch data from Meta, GA4, and Shopify APIs and append to your sheets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Configuration Warning */}
          {needsConfiguration && !configLoading && (
            <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <Settings className="h-5 w-5" />
                <span className="font-medium">Services Not Configured</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                No services are configured yet. Please configure your API credentials first.
              </p>
              <Link to="/settings">
                <Button variant="outline" size="sm" className="mt-3">
                  <Settings className="h-4 w-4 mr-2" />
                  Go to Settings
                </Button>
              </Link>
            </div>
          )}

          {/* Date Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Target Date
            </Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              Data will be fetched for this date (defaults to yesterday)
            </p>
          </div>

          {/* Platform Pull Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span>📘</span> Meta Ads
                </CardTitle>
                <CardDescription className="text-xs">
                  {configLoading ? (
                    <Badge variant="secondary" className="text-xs">Loading...</Badge>
                  ) : isConfigured('meta') ? (
                    <Badge variant="success" className="text-xs">Configured</Badge>
                  ) : (
                    <Badge variant="error" className="text-xs">Not Configured</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => pullPlatform('meta')}
                  disabled={isPullingAny || !isConfigured('meta') || configLoading}
                  className="w-full"
                  variant="outline"
                >
                  {isPulling.meta ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Pulling...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Pull Meta
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span>📊</span> GA4
                </CardTitle>
                <CardDescription className="text-xs">
                  {configLoading ? (
                    <Badge variant="secondary" className="text-xs">Loading...</Badge>
                  ) : isConfigured('ga4') ? (
                    <Badge variant="success" className="text-xs">Configured</Badge>
                  ) : (
                    <Badge variant="error" className="text-xs">Not Configured</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => pullPlatform('ga4')}
                  disabled={isPullingAny || !isConfigured('ga4') || configLoading}
                  className="w-full"
                  variant="outline"
                >
                  {isPulling.ga4 ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Pulling...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Pull GA4
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span>🏪</span> Shopify
                </CardTitle>
                <CardDescription className="text-xs">
                  {configLoading ? (
                    <Badge variant="secondary" className="text-xs">Loading...</Badge>
                  ) : isConfigured('shopify') ? (
                    <Badge variant="success" className="text-xs">Configured</Badge>
                  ) : (
                    <Badge variant="error" className="text-xs">Not Configured</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => pullPlatform('shopify')}
                  disabled={isPullingAny || !isConfigured('shopify') || configLoading}
                  className="w-full"
                  variant="outline"
                >
                  {isPulling.shopify ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Pulling...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Pull Shopify
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Pull All Button */}
          <Button
            onClick={pullAll}
            disabled={isPullingAny || configLoading}
            className="w-full"
          >
            {isPulling.all ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pulling All Platforms...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Pull All Platforms
              </>
            )}
          </Button>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Results</Label>
                <Button variant="ghost" size="sm" onClick={clearResults}>
                  Clear
                </Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      result.success
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-red-500/10 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium">{result.platform}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
