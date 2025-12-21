// Deprecated: Legacy popup SettingsDialog removed in favor of Settings page.
// This stub prevents accidental imports. Do not use.
export function SettingsDialog() {
  if (import.meta.env.DEV) {
    console.warn('SettingsDialog is deprecated. Use the Settings page (/settings).')
  }
  return null
}
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSettings } from '@/contexts/settings-context'
import { Settings, Check, X, Eye, EyeOff, RefreshCw, Loader2, Upload, Info, AlertCircle } from 'lucide-react'
import * as api from '@/lib/api'
import type { SpreadsheetInfo, SheetInfo, GA4AuthMethod } from '@/types'

export function SettingsDialog() {
  const { settings, updateCredentials, updateSpreadsheet, isConfigured } = useSettings()
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({})
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([])
  const [sheets, setSheets] = useState<SheetInfo[]>([])
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false)
  const [isLoadingSheets, setIsLoadingSheets] = useState(false)
  const [open, setOpen] = useState(false)

  const toggleShowToken = (key: string) => {
    setShowTokens((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Load spreadsheets when dialog opens
  useEffect(() => {
    if (open) {
      loadSpreadsheets()
    }
  }, [open])

  // Load sheets when spreadsheet changes
  useEffect(() => {
    if (settings.spreadsheet.spreadsheetId) {
      loadSheets(settings.spreadsheet.spreadsheetId)
    }
  }, [settings.spreadsheet.spreadsheetId])

  const loadSpreadsheets = async () => {
    setIsLoadingSpreadsheets(true)
    try {
      const response = await api.listSpreadsheets()
      if (response.success && response.data) {
        setSpreadsheets(response.data)
      }
    } catch (error) {
      console.error('Failed to load spreadsheets:', error)
    } finally {
      setIsLoadingSpreadsheets(false)
    }
  }

  const loadSheets = async (spreadsheetId: string) => {
    setIsLoadingSheets(true)
    try {
      const response = await api.getSheetNames(spreadsheetId)
      if (response.success && response.data) {
        setSheets(response.data)
      }
    } catch (error) {
      console.error('Failed to load sheets:', error)
    } finally {
      setIsLoadingSheets(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your API credentials and spreadsheet settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="meta" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="meta" className="flex items-center gap-2">
              Meta
              {isConfigured('meta') ? (
                <Check className="w-3 h-3 text-[var(--color-success)]" />
              ) : (
                <X className="w-3 h-3 text-[var(--color-error)]" />
              )}
            </TabsTrigger>
            <TabsTrigger value="ga4" className="flex items-center gap-2">
              GA4
              {isConfigured('ga4') ? (
                <Check className="w-3 h-3 text-[var(--color-success)]" />
              ) : (
                <X className="w-3 h-3 text-[var(--color-error)]" />
              )}
            </TabsTrigger>
            <TabsTrigger value="shopify" className="flex items-center gap-2">
              Shopify
              {isConfigured('shopify') ? (
                <Check className="w-3 h-3 text-[var(--color-success)]" />
              ) : (
                <X className="w-3 h-3 text-[var(--color-error)]" />
              )}
            </TabsTrigger>
            <TabsTrigger value="sheets">Sheets</TabsTrigger>
          </TabsList>

          <TabsContent value="meta" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-lg">📘</span>
                  Meta Ads Configuration
                </CardTitle>
                <CardDescription>
                  Enter your Meta Graph API access token to sync ad performance data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meta-token">Access Token</Label>
                  <div className="flex gap-2">
                    <Input
                      id="meta-token"
                      type={showTokens['meta'] ? 'text' : 'password'}
                      placeholder="Enter your Meta access token"
                      value={settings.credentials.meta.accessToken}
                      onChange={(e) =>
                        updateCredentials('meta', { accessToken: e.target.value })
                      }
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleShowToken('meta')}
                    >
                      {showTokens['meta'] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get your token from the{' '}
                    <a
                      href="https://developers.facebook.com/tools/explorer/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Graph API Explorer
                    </a>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {isConfigured('meta') ? (
                    <Badge variant="success">Configured</Badge>
                  ) : (
                    <Badge variant="error">Not Configured</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ga4" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  Google Analytics 4 Configuration
                </CardTitle>
                <CardDescription>
                  Choose your authentication method and enter GA4 credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Required Scopes Info Box */}
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Required OAuth 2.0 Scopes
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        Your credentials must include these scopes to access GA4 data:
                      </p>
                      <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-4 mt-2">
                        <li className="flex items-start gap-1">
                          <span className="mt-1">•</span>
                          <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                            https://www.googleapis.com/auth/analytics.readonly
                          </code>
                        </li>
                        <li className="flex items-start gap-1">
                          <span className="mt-1">•</span>
                          <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">
                            https://www.googleapis.com/auth/cloud-platform
                          </code>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Authentication Method Selector */}
                <div className="space-y-2">
                  <Label htmlFor="ga4-auth-method">Authentication Method</Label>
                  <Select
                    value={settings.credentials.ga4.authMethod}
                    onValueChange={(value: GA4AuthMethod) =>
                      updateCredentials('ga4', { authMethod: value })
                    }
                  >
                    <SelectTrigger id="ga4-auth-method">
                      <SelectValue placeholder="Select authentication method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oauth">OAuth 2.0 (Client ID & Secret)</SelectItem>
                      <SelectItem value="service-account">Service Account (JSON Key)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {settings.credentials.ga4.authMethod === 'oauth'
                      ? 'Use OAuth for user-based authentication with access tokens'
                      : 'Use Service Account for server-to-server authentication'}
                  </p>
                </div>

                {/* Property ID (Common for both methods) */}
                <div className="space-y-2">
                  <Label htmlFor="ga4-property">Property ID</Label>
                  <Input
                    id="ga4-property"
                    placeholder="e.g., 123456789"
                    value={settings.credentials.ga4.propertyId}
                    onChange={(e) =>
                      updateCredentials('ga4', { propertyId: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Find this in GA4 Admin → Property Settings
                  </p>
                </div>

                {/* OAuth Fields */}
                {settings.credentials.ga4.authMethod === 'oauth' && (
                  <GA4OAuthFields
                    credentials={settings.credentials.ga4}
                    updateCredentials={updateCredentials}
                    showTokens={showTokens}
                    toggleShowToken={toggleShowToken}
                  />
                )}

                {/* Service Account Fields */}
                {settings.credentials.ga4.authMethod === 'service-account' && (
                  <GA4ServiceAccountFields
                    credentials={settings.credentials.ga4}
                    updateCredentials={updateCredentials}
                  />
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {isConfigured('ga4') ? (
                    <Badge variant="success">Configured</Badge>
                  ) : (
                    <Badge variant="error">Not Configured</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shopify" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-lg">🏪</span>
                  Shopify Configuration
                </CardTitle>
                <CardDescription>
                  Enter your Shopify store credentials to sync sales data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shopify-domain">Store Domain</Label>
                  <Input
                    id="shopify-domain"
                    placeholder="your-store.myshopify.com"
                    value={settings.credentials.shopify.storeDomain}
                    onChange={(e) =>
                      updateCredentials('shopify', { storeDomain: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shopify-token">Access Token</Label>
                  <div className="flex gap-2">
                    <Input
                      id="shopify-token"
                      type={showTokens['shopify'] ? 'text' : 'password'}
                      placeholder="shpat_..."
                      value={settings.credentials.shopify.accessToken}
                      onChange={(e) =>
                        updateCredentials('shopify', { accessToken: e.target.value })
                      }
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleShowToken('shopify')}
                    >
                      {showTokens['shopify'] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create a custom app in Shopify Admin → Settings → Apps
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {isConfigured('shopify') ? (
                    <Badge variant="success">Configured</Badge>
                  ) : (
                    <Badge variant="error">Not Configured</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sheets" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-lg">📑</span>
                  Google Sheets Configuration
                </CardTitle>
                <CardDescription>
                  Select the spreadsheet and sheets to read/write data from.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Spreadsheet
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={loadSpreadsheets}
                      disabled={isLoadingSpreadsheets}
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingSpreadsheets ? 'animate-spin' : ''}`} />
                    </Button>
                  </Label>
                  <Select
                    value={settings.spreadsheet.spreadsheetId}
                    onValueChange={(value) => updateSpreadsheet({ spreadsheetId: value })}
                    disabled={isLoadingSpreadsheets}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingSpreadsheets ? "Loading..." : "Select spreadsheet"}>
                        {isLoadingSpreadsheets ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </span>
                        ) : (
                          spreadsheets.find(s => s.id === settings.spreadsheet.spreadsheetId)?.name || 'Select spreadsheet'
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
                  <p className="text-xs text-muted-foreground">
                    Lists all spreadsheets shared with the service account
                  </p>
                </div>

                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    Sheet Names
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => loadSheets(settings.spreadsheet.spreadsheetId)}
                      disabled={isLoadingSheets || !settings.spreadsheet.spreadsheetId}
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoadingSheets ? 'animate-spin' : ''}`} />
                    </Button>
                  </Label>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="meta-sheet" className="flex items-center gap-1 text-sm">
                        <span>📘</span> Meta Sheet
                      </Label>
                      <Select
                        value={settings.spreadsheet.metaSheetName}
                        onValueChange={(value) => updateSpreadsheet({ metaSheetName: value })}
                        disabled={isLoadingSheets || sheets.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sheet" />
                        </SelectTrigger>
                        <SelectContent>
                          {sheets.map((sheet) => (
                            <SelectItem key={sheet.sheetId} value={sheet.name}>
                              {sheet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ga4-sheet" className="flex items-center gap-1 text-sm">
                        <span>📊</span> GA4 Sheet
                      </Label>
                      <Select
                        value={settings.spreadsheet.ga4SheetName}
                        onValueChange={(value) => updateSpreadsheet({ ga4SheetName: value })}
                        disabled={isLoadingSheets || sheets.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sheet" />
                        </SelectTrigger>
                        <SelectContent>
                          {sheets.map((sheet) => (
                            <SelectItem key={sheet.sheetId} value={sheet.name}>
                              {sheet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shopify-sheet" className="flex items-center gap-1 text-sm">
                        <span>🏪</span> Shopify Sheet
                      </Label>
                      <Select
                        value={settings.spreadsheet.shopifySheetName}
                        onValueChange={(value) => updateSpreadsheet({ shopifySheetName: value })}
                        disabled={isLoadingSheets || sheets.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sheet" />
                        </SelectTrigger>
                        <SelectContent>
                          {sheets.map((sheet) => (
                            <SelectItem key={sheet.sheetId} value={sheet.name}>
                              {sheet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Manual ID input fallback */}
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Advanced: Enter IDs manually
                  </summary>
                  <div className="mt-3 space-y-3 p-3 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="spreadsheet-id">Spreadsheet ID</Label>
                      <Input
                        id="spreadsheet-id"
                        placeholder="1HlVbOXTf..."
                        value={settings.spreadsheet.spreadsheetId}
                        onChange={(e) =>
                          updateSpreadsheet({ spreadsheetId: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="meta-sheet-manual">Meta Sheet</Label>
                        <Input
                          id="meta-sheet-manual"
                          placeholder="meta_raw_daily"
                          value={settings.spreadsheet.metaSheetName}
                          onChange={(e) =>
                            updateSpreadsheet({ metaSheetName: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ga4-sheet-manual">GA4 Sheet</Label>
                        <Input
                          id="ga4-sheet-manual"
                          placeholder="Google"
                          value={settings.spreadsheet.ga4SheetName}
                          onChange={(e) =>
                            updateSpreadsheet({ ga4SheetName: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shopify-sheet-manual">Shopify Sheet</Label>
                        <Input
                          id="shopify-sheet-manual"
                          placeholder="Shopify"
                          value={settings.spreadsheet.shopifySheetName}
                          onChange={(e) =>
                            updateSpreadsheet({ shopifySheetName: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </details>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// OAuth Fields Component
function GA4OAuthFields({
  credentials,
  updateCredentials,
  showTokens,
  toggleShowToken,
}: {
  credentials: any
  updateCredentials: (platform: 'meta' | 'ga4' | 'shopify', creds: any) => void
  showTokens: Record<string, boolean>
  toggleShowToken: (key: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClientSecretUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const jsonContent = JSON.parse(e.target?.result as string)
        
        // Try to extract OAuth client credentials from various formats
        let clientId = ''
        let clientSecret = ''
        
        // Format 1: Direct web client
        if (jsonContent.web) {
          clientId = jsonContent.web.client_id || ''
          clientSecret = jsonContent.web.client_secret || ''
        }
        // Format 2: Installed app
        else if (jsonContent.installed) {
          clientId = jsonContent.installed.client_id || ''
          clientSecret = jsonContent.installed.client_secret || ''
        }
        // Format 3: Direct fields
        else {
          clientId = jsonContent.client_id || ''
          clientSecret = jsonContent.client_secret || ''
        }

        if (clientId && clientSecret) {
          updateCredentials('ga4', { clientId, clientSecret })
          alert('✅ Client credentials loaded successfully!')
        } else {
          alert('⚠️ Could not find client_id and client_secret in the JSON file.')
        }
      } catch (error) {
        alert('❌ Invalid JSON file. Please upload a valid OAuth client credentials file.')
      }
    }
    reader.readAsText(file)
    
    // Reset input
    if (event.target) event.target.value = ''
  }

  return (
    <>
      <div className="rounded-lg border bg-amber-50 dark:bg-amber-950 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Upload className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Quick Setup: Upload OAuth Credentials
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
              Upload your OAuth 2.0 client secret JSON file to auto-fill credentials
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleClientSecretUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3 w-3 mr-2" />
              Upload Client Secret JSON
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ga4-client-id">Client ID</Label>
        <Input
          id="ga4-client-id"
          placeholder="Enter your OAuth client ID"
          value={credentials.clientId || ''}
          onChange={(e) =>
            updateCredentials('ga4', { clientId: e.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ga4-client-secret">Client Secret</Label>
        <div className="flex gap-2">
          <Input
            id="ga4-client-secret"
            type={showTokens['ga4-secret'] ? 'text' : 'password'}
            placeholder="Enter your OAuth client secret"
            value={credentials.clientSecret || ''}
            onChange={(e) =>
              updateCredentials('ga4', { clientSecret: e.target.value })
            }
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => toggleShowToken('ga4-secret')}
          >
            {showTokens['ga4-secret'] ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ga4-token">Access Token</Label>
        <div className="flex gap-2">
          <Input
            id="ga4-token"
            type={showTokens['ga4'] ? 'text' : 'password'}
            placeholder="Enter your Google access token"
            value={credentials.accessToken || ''}
            onChange={(e) =>
              updateCredentials('ga4', { accessToken: e.target.value })
            }
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => toggleShowToken('ga4')}
          >
            {showTokens['ga4'] ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Generate using{' '}
          <a
            href="https://developers.google.com/oauthplayground/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            OAuth 2.0 Playground
          </a>
        </p>
      </div>
    </>
  )
}

// Service Account Fields Component
function GA4ServiceAccountFields({
  credentials,
  updateCredentials,
}: {
  credentials: any
  updateCredentials: (platform: 'meta' | 'ga4' | 'shopify', creds: any) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleServiceAccountUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const jsonContent = e.target?.result as string
        const parsed = JSON.parse(jsonContent)
        
        // Validate it's a service account key
        if (parsed.type !== 'service_account') {
          setUploadStatus('error')
          alert('⚠️ This does not appear to be a service account key file.')
          return
        }

        // Extract service account email and store the entire key
        const serviceAccountEmail = parsed.client_email || ''
        
        if (serviceAccountEmail) {
          updateCredentials('ga4', {
            serviceAccountEmail,
            serviceAccountKey: jsonContent, // Store the entire JSON as string
          })
          setUploadStatus('success')
          setTimeout(() => setUploadStatus('idle'), 3000)
        } else {
          setUploadStatus('error')
          alert('⚠️ Could not find service account email in the JSON file.')
        }
      } catch (error) {
        setUploadStatus('error')
        alert('❌ Invalid JSON file. Please upload a valid service account key file.')
      }
    }
    reader.readAsText(file)
    
    // Reset input
    if (event.target) event.target.value = ''
  }

  const hasServiceAccount = Boolean(credentials.serviceAccountKey)

  return (
    <>
      <div className={`rounded-lg border p-4 space-y-3 ${
        uploadStatus === 'success' 
          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
          : uploadStatus === 'error'
          ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
          : 'bg-purple-50 dark:bg-purple-950'
      }`}>
        <div className="flex items-start gap-2">
          {uploadStatus === 'success' ? (
            <Check className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
          ) : uploadStatus === 'error' ? (
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
          ) : (
            <Upload className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {uploadStatus === 'success' 
                ? '✅ Service Account Loaded' 
                : 'Upload Service Account JSON Key'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload your service account key file (.json) from Google Cloud Console
            </p>
            {hasServiceAccount && (
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mt-2">
                📧 {credentials.serviceAccountEmail}
              </p>
            )}
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleServiceAccountUpload}
          className="hidden"
        />
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-2" />
            {hasServiceAccount ? 'Replace Key File' : 'Upload Key File'}
          </Button>
          
          {hasServiceAccount && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateCredentials('ga4', {
                  serviceAccountEmail: '',
                  serviceAccountKey: '',
                })
                setUploadStatus('idle')
              }}
            >
              <X className="h-3 w-3 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-3">
        <p className="text-xs text-blue-900 dark:text-blue-100 font-medium mb-2">
          📝 Important: Grant Service Account Access
        </p>
        <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4">
          <li>1. Copy the service account email above</li>
          <li>2. Go to GA4 Admin → Property Access Management</li>
          <li>3. Add the service account email as a user</li>
          <li>4. Grant it "Viewer" role permissions</li>
        </ol>
      </div>

      {credentials.serviceAccountEmail && (
        <div className="space-y-2">
          <Label>Service Account Email</Label>
          <div className="flex items-center gap-2 p-2 bg-muted rounded border">
            <code className="text-xs flex-1 break-all">
              {credentials.serviceAccountEmail}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(credentials.serviceAccountEmail)
                alert('📋 Copied to clipboard!')
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
