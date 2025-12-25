/**
 * Sheet Validation Alert Component
 * 
 * Displays validation status and guidance for sheet setup
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import type { HeaderValidationResult } from '@/lib/sheet-validation'
import type { Platform } from '@/types'

interface SheetValidationAlertProps {
  validation: HeaderValidationResult
  service: Platform
  onDismiss?: () => void
}

export function SheetValidationAlert({ validation, service }: SheetValidationAlertProps) {
  if (!validation) return null

  // Valid sheet - show success
  if (validation.valid) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900 dark:text-green-100">Sheet Ready</AlertTitle>
        <AlertDescription className="text-green-800 dark:text-green-200">
          {validation.message}
        </AlertDescription>
      </Alert>
    )
  }

  // Headers need to be created
  if (validation.requiresHeaderCreation) {
    return (
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">Empty Sheet Detected</AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200 space-y-2">
          <p>{validation.message}</p>
          <p className="text-sm font-medium">
            When you sync, these headers will be automatically created:
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {validation.missingHeaders ? (
              validation.missingHeaders.map((header) => (
                <Badge key={header} variant="outline" className="text-xs">
                  {header}
                </Badge>
              ))
            ) : (
              <span className="text-sm">Check sheet configuration</span>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Schema mismatch - show critical error
  if (validation.detectedSchema && validation.detectedSchema !== service) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>⚠️ Schema Mismatch - Data Loss Risk</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{validation.message}</p>
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900 rounded text-sm">
            <p className="font-semibold">Detected Schema: <Badge variant="destructive">{validation.detectedSchema.toUpperCase()}</Badge></p>
            <p className="font-semibold">Expected Schema: <Badge variant="outline">{service.toUpperCase()}</Badge></p>
          </div>
          <p className="text-sm font-medium">❌ Sync is blocked to protect your data</p>
        </AlertDescription>
      </Alert>
    )
  }

  // Generic header mismatch
  if (validation.headerMatch === 'mismatch') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Invalid Sheet Headers</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{validation.message}</p>
          {validation.missingHeaders && validation.missingHeaders.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium">Missing columns:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {validation.missingHeaders.map((header) => (
                  <Badge key={header} variant="destructive" className="text-xs">
                    {header}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // Partial match (has extra columns)
  if (validation.headerMatch === 'partial') {
    return (
      <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-900 dark:text-yellow-100">Extra Columns Detected</AlertTitle>
        <AlertDescription className="text-yellow-800 dark:text-yellow-200 space-y-2">
          <p>{validation.message}</p>
          {validation.extraHeaders && validation.extraHeaders.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium">Extra columns (will be ignored):</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {validation.extraHeaders.map((header) => (
                  <Badge key={header} variant="outline" className="text-xs">
                    {header}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

/**
 * Sheet Schema Reference Component
 * Shows the expected schema for a service
 */
interface SheetSchemaReferenceProps {
  service: Platform
  headers: string[]
  compact?: boolean
}

export function SheetSchemaReference({ service, headers, compact = false }: SheetSchemaReferenceProps) {
  if (compact) {
    return (
      <div className="text-xs text-muted-foreground">
        <p className="font-semibold">{service.toUpperCase()} Schema:</p>
        <p>{headers.join(', ')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="font-semibold">{service.toUpperCase()} Sheet Schema</p>
      <p className="text-sm text-muted-foreground">
        Your sheet must have these columns in any order:
      </p>
      <div className="flex flex-wrap gap-2">
        {headers.map((header, idx) => (
          <div key={header} className="flex items-center gap-2">
            <Badge variant="secondary">{header}</Badge>
            {idx < headers.length - 1 && <span className="text-muted-foreground">•</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
