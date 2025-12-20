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
import { useSettings } from '@/contexts/settings-context'
import * as api from '@/lib/api'
import { Download, Loader2, CheckCircle, XCircle, Calendar } from 'lucide-react'

interface PullResult {
  platform: string
  success: boolean
  message: string
  data?: any
}

export function ManualPullDialog() {
  const { settings, isConfigured } = useSettings()
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

  const pullMeta = async () => {
    if (!isConfigured('meta')) {
      setResults(prev => [...prev, {
        platform: 'Meta',
        success: false,
        message: 'Meta is not configured. Please add your access token in Settings.',
      }])
      return
    }

    setIsPulling(prev => ({ ...prev, meta: true }))
    try {
      const response = await api.fetchMetaData({
        accessToken: settings.credentials.meta.accessToken,
        spreadsheetId: settings.spreadsheet.spreadsheetId,
        sheetName: settings.spreadsheet.metaSheetName,
      })

      setResults(prev => [...prev, {
        platform: 'Meta',
        success: response.success,
        message: response.success
          ? `Meta data for ${targetDate} fetched successfully!`
          : response.error || 'Failed to fetch Meta data',
        data: response.data,
      }])
    } catch (error) {
      setResults(prev => [...prev, {
        platform: 'Meta',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch Meta data',
      }])
    } finally {
      setIsPulling(prev => ({ ...prev, meta: false }))
    }
  }

  const pullGA4 = async () => {
    if (!isConfigured('ga4')) {
      setResults(prev => [...prev, {
        platform: 'GA4',
        success: false,
        message: 'GA4 is not configured. Please add your credentials in Settings.',
      }])
      return
    }

    setIsPulling(prev => ({ ...prev, ga4: true }))
    try {
      const response = await api.fetchGA4Data({
        accessToken: settings.credentials.ga4.accessToken || '',
        propertyId: settings.credentials.ga4.propertyId || '',
        spreadsheetId: settings.spreadsheet.spreadsheetId,
        sheetName: settings.spreadsheet.ga4SheetName,
      })

      setResults(prev => [...prev, {
        platform: 'GA4',
        success: response.success,
        message: response.success
          ? `GA4 data for ${targetDate} fetched successfully!`
          : response.error || 'Failed to fetch GA4 data',
        data: response.data,
      }])
    } catch (error) {
      setResults(prev => [...prev, {
        platform: 'GA4',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch GA4 data',
      }])
    } finally {
      setIsPulling(prev => ({ ...prev, ga4: false }))
    }
  }

  const pullShopify = async () => {
    if (!isConfigured('shopify')) {
      setResults(prev => [...prev, {
        platform: 'Shopify',
        success: false,
        message: 'Shopify is not configured. Please add your credentials in Settings.',
      }])
      return
    }

    setIsPulling(prev => ({ ...prev, shopify: true }))
    try {
      const response = await api.fetchShopifyData({
        storeDomain: settings.credentials.shopify.storeDomain,
        accessToken: settings.credentials.shopify.accessToken,
        spreadsheetId: settings.spreadsheet.spreadsheetId,
        sheetName: settings.spreadsheet.shopifySheetName,
      })

      setResults(prev => [...prev, {
        platform: 'Shopify',
        success: response.success,
        message: response.success
          ? `Shopify data for ${targetDate} fetched successfully!`
          : response.error || 'Failed to fetch Shopify data',
        data: response.data,
      }])
    } catch (error) {
      setResults(prev => [...prev, {
        platform: 'Shopify',
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch Shopify data',
      }])
    } finally {
      setIsPulling(prev => ({ ...prev, shopify: false }))
    }
  }

  const pullAll = async () => {
    setResults([])
    setIsPulling(prev => ({ ...prev, all: true }))

    await Promise.all([
      pullMeta(),
      pullGA4(),
      pullShopify(),
    ])

    setIsPulling(prev => ({ ...prev, all: false }))
  }

  const clearResults = () => {
    setResults([])
  }

  const isPullingAny = Object.values(isPulling).some(Boolean)

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
                  {isConfigured('meta') ? (
                    <Badge variant="success" className="text-xs">Configured</Badge>
                  ) : (
                    <Badge variant="error" className="text-xs">Not Configured</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={pullMeta}
                  disabled={isPullingAny || !isConfigured('meta')}
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
                  {isConfigured('ga4') ? (
                    <Badge variant="success" className="text-xs">Configured</Badge>
                  ) : (
                    <Badge variant="error" className="text-xs">Not Configured</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={pullGA4}
                  disabled={isPullingAny || !isConfigured('ga4')}
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
                  {isConfigured('shopify') ? (
                    <Badge variant="success" className="text-xs">Configured</Badge>
                  ) : (
                    <Badge variant="error" className="text-xs">Not Configured</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={pullShopify}
                  disabled={isPullingAny || !isConfigured('shopify')}
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
            disabled={isPullingAny}
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
