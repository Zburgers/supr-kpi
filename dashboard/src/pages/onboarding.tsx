/**
 * Onboarding Page - Multi-step wizard for setting up data sources
 */

import { useState, useCallback } from 'react';
import { ArrowRight, CheckCircle, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServiceSetupWizard } from '@/components/onboarding/service-setup-wizard';
import { OnboardingProvider, useOnboarding } from '@/contexts/onboarding-context';
import { navigate } from '@/lib/navigation';
import type { ServiceType } from '@/types/api';

const SERVICES: ServiceType[] = ['google_sheets', 'meta', 'ga4', 'shopify'];

const SERVICE_LABELS: Record<ServiceType, string> = {
  google_sheets: 'Google Sheets',
  meta: 'Meta',
  ga4: 'Google Analytics 4',
  shopify: 'Shopify',
};

function OnboardingContent() {
  const { currentStep, completedServices, nextStep } = useOnboarding();
  const [currentService, setCurrentService] = useState<ServiceType | null>(null);

  const handleServiceComplete = useCallback(() => {
    setCurrentService(null);
    nextStep();
  }, [nextStep]);

  const handleSkipService = useCallback(() => {
    setCurrentService(null);
    nextStep();
  }, [nextStep]);

  const handleStartService = useCallback((service: ServiceType) => {
    setCurrentService(service);
  }, []);

  const handleFinish = useCallback(() => {
    // Navigate to dashboard
    navigate('/');
  }, []);

  // Step 0: Welcome
  if (currentStep === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-2xl w-full bg-card rounded-xl shadow-xl p-8 border border-border">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-3">
                Welcome to KPI Dashboard
              </h1>
              <p className="text-xl text-muted-foreground">
                Let's set up your data sources to get started
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              {SERVICES.map((service) => (
                <div
                  key={service}
                  className="p-4 border border-border rounded-lg hover:border-primary transition-colors bg-secondary/30"
                >
                  <div className="font-medium text-foreground">{SERVICE_LABELS[service]}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Connect your {SERVICE_LABELS[service]} account
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-6">
              <Button onClick={nextStep} className="flex-1" size="lg">
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                onClick={handleFinish}
                variant="outline"
                size="lg"
              >
                <SkipForward className="w-5 h-5 mr-2" />
                Skip for Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Steps 1-4: Service Setup
  const serviceIndex = currentStep - 1;
  if (serviceIndex >= 0 && serviceIndex < SERVICES.length) {
    const service = SERVICES[serviceIndex];

    if (currentService === service) {
      return (
        <div className="min-h-screen bg-background p-4 py-12">
          <ServiceSetupWizard
            service={service}
            onComplete={handleServiceComplete}
            onSkip={handleSkipService}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-2xl w-full bg-card rounded-xl shadow-xl p-8 border border-border">
          <div className="space-y-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">
                Step {currentStep} of {SERVICES.length + 1}
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                {SERVICE_LABELS[service]}
              </h2>
              <p className="text-muted-foreground">
                Connect your {SERVICE_LABELS[service]} account to import data
              </p>
            </div>

            {completedServices.includes(service) && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-md flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <div>
                  <div className="font-medium text-green-400">Already Configured</div>
                  <div className="text-sm text-green-500/80">
                    This service has been set up successfully
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => handleStartService(service)}
                className="flex-1"
                size="lg"
              >
                {completedServices.includes(service) ? 'Reconfigure' : 'Set Up'} {SERVICE_LABELS[service]}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                onClick={handleSkipService}
                variant="outline"
                size="lg"
              >
                Skip
              </Button>
            </div>

            <div className="pt-4">
              <div className="text-sm text-muted-foreground mb-2">Progress</div>
              <div className="flex gap-2">
                {SERVICES.map((svc, idx) => (
                  <div
                    key={svc}
                    className={`flex-1 h-2 rounded ${
                      idx < serviceIndex
                        ? 'bg-green-500'
                        : idx === serviceIndex
                        ? 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Final Step: Complete
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full bg-card rounded-xl shadow-xl p-8 border border-border">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-3">
              You're All Set!
            </h2>
            <p className="text-xl text-muted-foreground">
              Your dashboard is ready to use
            </p>
          </div>

          <div className="bg-secondary/30 rounded-lg p-6">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              Configured Services:
            </div>
            <div className="space-y-2">
              {SERVICES.map((service) => (
                <div
                  key={service}
                  className="flex items-center justify-between p-3 bg-card rounded border border-border"
                >
                  <span className="font-medium text-foreground">{SERVICE_LABELS[service]}</span>
                  {completedServices.includes(service) ? (
                    <span className="flex items-center gap-1 text-green-500 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Configured
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Not configured</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleFinish} className="flex-1" size="lg">
              Go to Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              onClick={() => setCurrentService(SERVICES[0])}
              variant="outline"
              size="lg"
            >
              Configure More Services
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Onboarding() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}
