import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useServiceConfig } from '@/hooks/useServiceConfig'
import * as api from '@/lib/api'
import type { SpreadsheetInfo, SheetInfo } from '@/types'
import {
  Table,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react'

interface SheetData {
  headers: string[]
  rows: string[][]
  rowCount: number
  lastUpdated: Date | null
}

export function SheetViewerDialog() {
  const { sheetConfig, services } = useServiceConfig()
  const [open, setOpen] = useState(false)
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([])
  const [sheets, setSheets] = useState<SheetInfo[]>([])
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string>('')
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [sheetData, setSheetData] = useState<SheetData | null>(null)
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false)
  const [isLoadingSheets, setIsLoadingSheets] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'meta' | 'ga4' | 'shopify'>('meta')
  const cacheRef = useRef<Map<string, SheetData>>(new Map())

  // Initialize selected spreadsheet from config when it loads
  useEffect(() => {
    if (sheetConfig?.spreadsheetId && !selectedSpreadsheet && open) {
      setSelectedSpreadsheet(sheetConfig.spreadsheetId);
    }
  }, [sheetConfig, selectedSpreadsheet, open])

  // Load spreadsheets on open
  useEffect(() => {
    if (open) {
      loadSpreadsheets()
    }
  }, [open])

  // Load sheets when spreadsheet changes
  useEffect(() => {
    if (selectedSpreadsheet && open) {
      loadSheets(selectedSpreadsheet);
    }
  }, [selectedSpreadsheet, open])

  const loadSpreadsheets = async () => {
    setIsLoadingSpreadsheets(true)
    setError(null)
    try {
      // Use the sheets credential if available for authenticated access
      const credentialId = services.sheets?.credentialId
      if (!credentialId) {
        setError('Google Sheets credential is required to list spreadsheets. Please configure a Sheets credential.')
        return
      }
      const response = await api.listSpreadsheets(credentialId)
      if (response.success && response.data) {
        setSpreadsheets(response.data)
      } else {
        setError(response.error || 'Failed to load spreadsheets')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spreadsheets')
    } finally {
      setIsLoadingSpreadsheets(false)
    }
  }

  const loadSheets = async (spreadsheetId: string) => {
    setIsLoadingSheets(true)
    setError(null)
    try {
      // Use the sheets credential if available for authenticated access
      const credentialId = services.sheets?.credentialId
      if (!credentialId) {
        setError('Google Sheets credential is required to get sheet names. Please configure a Sheets credential.')
        return
      }
      const response = await api.getSheetNames(spreadsheetId, credentialId)
      if (response.success && response.data) {
        setSheets(response.data)
        // Auto-select first sheet or the one matching current tab
        const tabSheetMap = {
          meta: sheetConfig?.metaSheetName || 'RawMeta',
          ga4: sheetConfig?.ga4SheetName || 'RawGA',
          shopify: sheetConfig?.shopifySheetName || 'RawShopify',
        }
        const preferredSheet = tabSheetMap[activeTab]
        const matchingSheet = response.data.find(s => s.name === preferredSheet)
        if (matchingSheet) {
          setSelectedSheet(matchingSheet.name)
          const cached = cacheRef.current.get(`${spreadsheetId}:${matchingSheet.name}`)
          setSheetData(cached || null)
        } else if (response.data.length > 0) {
          setSelectedSheet(response.data[0].name)
          const cached = cacheRef.current.get(`${spreadsheetId}:${response.data[0].name}`)
          setSheetData(cached || null)
        }
      } else {
        setError(response.error || 'Failed to load sheets')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sheets')
    } finally {
      setIsLoadingSheets(false)
    }
  }

  const loadSheetData = useCallback(async (forceRefresh = false) => {
    if (!selectedSpreadsheet || !selectedSheet) return

    if (!services.sheets?.credentialId) {
      setError('Google Sheets credential is required to load sheet data. Configure it in Settings.')
      return
    }

    const cacheKey = `${selectedSpreadsheet}:${selectedSheet}`
    const cached = cacheRef.current.get(cacheKey)

    if (cached && !forceRefresh) {
      setSheetData(cached)
      return
    }

    setIsLoadingData(true)
    setError(null)
    try {
      // Use the sheets credential for authenticated access
      const credentialId = services.sheets.credentialId
      const response = await api.getSheetRawData(selectedSpreadsheet, selectedSheet, credentialId)
      if (response.success && response.data) {
        const data = response.data
        const parsed: SheetData = {
          headers: data[0] || [],
          rows: data.slice(1),
          rowCount: Math.max(data.length - 1, 0),
          lastUpdated: new Date(),
        }
        cacheRef.current.set(cacheKey, parsed)
        setSheetData(parsed)
      } else {
        setError(response.error || 'Failed to load sheet data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sheet data')
    } finally {
      setIsLoadingData(false)
    }
  }, [selectedSpreadsheet, selectedSheet, services])

  // Handle tab change - switch to the appropriate sheet
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as 'meta' | 'ga4' | 'shopify')
    const tabSheetMap = {
      meta: sheetConfig?.metaSheetName || 'RawMeta',
      ga4: sheetConfig?.ga4SheetName || 'RawGA',
      shopify: sheetConfig?.shopifySheetName || 'RawShopify',
    }
    const preferredSheet = tabSheetMap[tab as keyof typeof tabSheetMap]
    const matchingSheet = sheets.find(s => s.name === preferredSheet)
    if (matchingSheet) {
      setSelectedSheet(matchingSheet.name)
      const cached = cacheRef.current.get(`${selectedSpreadsheet}:${matchingSheet.name}`)
      setSheetData(cached || null)
    }
  }

  const handleSpreadsheetChange = (value: string) => {
    setSelectedSpreadsheet(value)

    setSelectedSheet('')
    setSheetData(null)
  }

  const handleSheetSelect = async (sheetName: string) => {
    setSelectedSheet(sheetName)
    const cached = cacheRef.current.get(`${selectedSpreadsheet}:${sheetName}`)
    setSheetData(cached || null)
    // Note: Sheet mappings are managed through Settings > Sheet Mappings
    // This viewer is read-only and uses configured mappings
  }

  const formatCellValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '-'
    if (typeof value === 'number') return value.toLocaleString()
    return String(value)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="View Sheets">
          <Table className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-[95vw] !w-[95vw] !h-[90vh] !max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Sheet Viewer
          </DialogTitle>
          <DialogDescription>
            View your Google Sheets data. Uses configured spreadsheet and mappings from Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 py-4 flex flex-col gap-4">
          {/* Spreadsheet & Sheet Selection - Read-only, uses configured spreadsheet */}
          <div className="flex flex-wrap gap-4 items-end shrink-0">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Configured Spreadsheet</label>
              <Select
                value={selectedSpreadsheet}
                onValueChange={handleSpreadsheetChange}
                disabled={isLoadingSpreadsheets || !services.sheets?.credentialId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No spreadsheet configured">
                    {isLoadingSpreadsheets ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      spreadsheets.find(s => s.id === selectedSpreadsheet)?.name || 'No spreadsheet configured'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {spreadsheets.map((spreadsheet) => (
                    <SelectItem key={spreadsheet.id} value={spreadsheet.id}>
                      {spreadsheet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sheetConfig?.spreadsheetId && (
                <p className="text-xs text-muted-foreground">
                  Showing configured spreadsheet from Settings
                </p>
              )}
            </div>

            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Sheet</label>
              <Select
                value={selectedSheet}
                onValueChange={handleSheetSelect}
                disabled={isLoadingSheets || !selectedSpreadsheet}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sheet">
                    {isLoadingSheets ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      selectedSheet || 'Select sheet'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((sheet) => (
                    <SelectItem key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              onClick={() => loadSheetData(true)}
              disabled={isLoadingData || !selectedSheet}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Platform Tabs for Quick Switching */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full shrink-0">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
              <TabsTrigger value="meta" className="flex items-center gap-2">
                <span>📘</span> Meta
              </TabsTrigger>
              <TabsTrigger value="ga4" className="flex items-center gap-2">
                <span>📊</span> GA4
              </TabsTrigger>
              <TabsTrigger value="shopify" className="flex items-center gap-2">
                <span>🏪</span> Shopify
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Data Info */}
          {sheetData && (
            <div className="flex items-center justify-between text-sm text-muted-foreground shrink-0">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  {sheetData.rowCount} rows
                </Badge>
                <span>
                  Last updated: {sheetData.lastUpdated?.toLocaleTimeString() || 'Never'}
                </span>
              </div>
            </div>
          )}

          {/* Sheet Data Table - takes remaining space */}
          <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
            <CardContent className="p-0 flex-1 overflow-hidden">
              {isLoadingData ? (
                <div className="p-8 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : sheetData && sheetData.headers.length > 0 ? (
                <div className="overflow-auto h-full">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/60 z-10">
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-semibold text-muted-foreground w-12 bg-muted/95">
                          #
                        </th>
                        {sheetData.headers.map((header, i) => (
                          <th
                            key={i}
                            className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap bg-muted/95"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheetData.rows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className="border-b last:border-0 transition-colors hover:bg-muted/50"
                        >
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                            {rowIndex + 1}
                          </td>
                          {sheetData.headers.map((_, colIndex) => (
                            <td
                              key={colIndex}
                              className="px-4 py-3 whitespace-nowrap"
                            >
                              {formatCellValue(row[colIndex])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  {selectedSheet
                    ? 'No data available in this sheet'
                    : 'Select a spreadsheet and sheet to view data'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
