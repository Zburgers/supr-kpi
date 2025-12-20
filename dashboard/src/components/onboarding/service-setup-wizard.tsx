/**
 * Service Setup Wizard - Complete flow for setting up a single service
 */

import { useState, useCallback } from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CredentialInput } from './credential-input';
import { CredentialVerification } from './credential-verification';
import { SheetSelector } from './sheet-selector';
import { useCredentials } from '@/hooks/useCredentials';
import { useSheetMappings } from '@/hooks/useSheetMappings';
import { useOnboarding } from '@/contexts/onboarding-context';
import type { ServiceType } from '@/types/api';

interface ServiceSetupWizardProps {
  service: ServiceType;
  onComplete: () => void;
  onSkip?: () => void;
}

type SetupStep = 'credential' | 'verification' | 'sheet' | 'summary';

export function ServiceSetupWizard({ service, onComplete, onSkip }: ServiceSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('credential');
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [sheetInfo, setSheetInfo] = useState<{
    spreadsheetId: string;
    sheetName: string;
    spreadsheetName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { saveCredential } = useCredentials();
  const { saveSheetMapping } = useSheetMappings();
  const { saveCredential: saveToContext, saveSheet: saveSheetToContext, completeService } = useOnboarding();

  const handleCredentialSave = useCallback(
    async (credentialData: { name: string; type: any; credentials: string }) => {
      setError(null);
      try {
        const credential = await saveCredential({
          service,
          name: credentialData.name,
          type: credentialData.type,
          credentials: credentialData.credentials,
        });

        setCredentialId(credential.id);
        saveToContext(service, credential.id);
        setCurrentStep('verification');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save credential');
      }
    },
    [service, saveCredential, saveToContext]
  );

  const handleVerificationSuccess = useCallback(() => {
    setVerified(true);
    // Google Sheets needs sheet selection
    if (service === 'google_sheets') {
      setCurrentStep('sheet');
    } else {
      setCurrentStep('summary');
    }
  }, [service]);

  const handleSheetSelect = useCallback(
    async (spreadsheetId: string, sheetName: string, spreadsheetName: string) => {
      if (!credentialId) return;

      setError(null);
      try {
        await saveSheetMapping({
          service,
          credential_id: credentialId,
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
        });

        setSheetInfo({ spreadsheetId, sheetName, spreadsheetName });
        saveSheetToContext(service, spreadsheetId, sheetName);
        setCurrentStep('summary');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save sheet mapping');
      }
    },
    [service, credentialId, saveSheetMapping, saveSheetToContext]
  );

  const handleComplete = useCallback(() => {
    completeService(service);
    onComplete();
  }, [service, completeService, onComplete]);

  const getServiceLabel = (svc: ServiceType): string => {
    const labels: Record<ServiceType, string> = {
      google_sheets: 'Google Sheets',
      meta: 'Meta',
      ga4: 'Google Analytics 4',
      shopify: 'Shopify',
    };
    return labels[svc];
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <StepIndicator
            label="Credentials"
            active={currentStep === 'credential'}
            completed={credentialId !== null}
          />
          <div className="flex-1 h-0.5 bg-gray-200 mx-2" />
          <StepIndicator
            label="Verify"
            active={currentStep === 'verification'}
            completed={verified}
          />
          {service === 'google_sheets' && (
            <>
              <div className="flex-1 h-0.5 bg-gray-200 mx-2" />
              <StepIndicator
                label="Select Sheet"
                active={currentStep === 'sheet'}
                completed={sheetInfo !== null}
              />
            </>
          )}
          <div className="flex-1 h-0.5 bg-gray-200 mx-2" />
          <StepIndicator
            label="Summary"
            active={currentStep === 'summary'}
            completed={false}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-2">{getServiceLabel(service)}</h2>

        {currentStep === 'credential' && (
          <div>
            <p className="text-gray-600 mb-6">
              Enter your {getServiceLabel(service)} credentials to get started.
            </p>
            <CredentialInput
              service={service}
              onSave={handleCredentialSave}
              onError={setError}
            />
            {onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                className="w-full mt-4"
              >
                Skip for now
              </Button>
            )}
          </div>
        )}

        {currentStep === 'verification' && credentialId && (
          <div>
            <p className="text-gray-600 mb-6">
              Let's verify your credentials are working correctly.
            </p>
            <CredentialVerification
              credentialId={credentialId}
              service={service}
              onSuccess={handleVerificationSuccess}
              onError={setError}
            />
          </div>
        )}

        {currentStep === 'sheet' && credentialId && (
          <div>
            <p className="text-gray-600 mb-6">
              Select which Google Sheet you want to use for storing {getServiceLabel(service)} data.
            </p>
            <SheetSelector
              credentialId={credentialId}
              onSelect={handleSheetSelect}
            />
          </div>
        )}

        {currentStep === 'summary' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle className="w-8 h-8" />
              <div>
                <h3 className="font-semibold text-lg">Setup Complete!</h3>
                <p className="text-sm text-gray-600">
                  Your {getServiceLabel(service)} integration is ready.
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between">
                <span className="text-gray-600">Service:</span>
                <span className="font-medium">{getServiceLabel(service)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium text-green-600">✓ Verified</span>
              </div>
              {sheetInfo && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Spreadsheet:</span>
                    <span className="font-medium">{sheetInfo.spreadsheetName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sheet:</span>
                    <span className="font-medium">{sheetInfo.sheetName}</span>
                  </div>
                </>
              )}
            </div>

            <Button onClick={handleComplete} className="w-full">
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  label: string;
  active: boolean;
  completed: boolean;
}

function StepIndicator({ label, active, completed }: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          completed
            ? 'bg-green-500 text-white'
            : active
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 text-gray-600'
        }`}
      >
        {completed ? <CheckCircle className="w-5 h-5" /> : null}
      </div>
      <div
        className={`text-xs mt-1 ${
          active ? 'text-blue-600 font-medium' : 'text-gray-500'
        }`}
      >
        {label}
      </div>
    </div>
  );
}
