/**
 * Onboarding Page - Multi-step wizard for setting up data sources
 * 
 * Flow:
 * 1. Google Sheets (required) - where data is stored
 * 2. Analytics services (Meta, GA4, Shopify) - where data is fetched from
 */

import { useState, useCallback } from 'react';
import { ArrowRight, CheckCircle, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImprovedServiceWizard } from '@/components/onboarding/improved-service-wizard';
import { OnboardingProvider } from '@/contexts/onboarding-context';
import { useUserStatus } from '@/hooks/useUserStatus';
import { navigate } from '@/lib/navigation';

function OnboardingContent() {
  const { markOnboardingComplete, refetch } = useUserStatus();
  const [showWizard, setShowWizard] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const handleWizardComplete = useCallback(async () => {
    setShowWizard(false);
    setIsFinishing(true);
    try {
      const success = await markOnboardingComplete();
      if (success) {
        await refetch();
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      navigate('/');
    } finally {
      setIsFinishing(false);
    }
  }, [markOnboardingComplete, refetch]);

  const handleSkip = useCallback(async () => {
    setIsFinishing(true);
    try {
      const success = await markOnboardingComplete();
      if (success) {
        await refetch();
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      navigate('/');
    } finally {
      setIsFinishing(false);
    }
  }, [markOnboardingComplete, refetch]);

  // Show the improved wizard
  if (showWizard) {
    return (
      <div className="min-h-screen bg-background p-4 py-12">
        <ImprovedServiceWizard onComplete={handleWizardComplete} />
      </div>
    );
  }

  // Welcome screen
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
              Welcome to Pegasus
            </h1>
            <p className="text-xl text-muted-foreground">
              Let's set up your data sources to get started
            </p>
          </div>
          
          {/* Service hierarchy explanation */}
          <div className="text-left bg-secondary/30 rounded-lg p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-2">📊 Data Storage</h3>
              <p className="text-sm text-muted-foreground">
                <strong>Google Sheets</strong> - Your analytics data will be stored in a Google Spreadsheet
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">📈 Analytics Sources</h3>
              <p className="text-sm text-muted-foreground">
                Connect your analytics services to automatically pull data:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
                <li>• <strong>Meta Ads</strong> - Advertising spend, reach, conversions</li>
                <li>• <strong>Google Analytics 4</strong> - Sessions, users, e-commerce</li>
                <li>• <strong>Shopify</strong> - Orders, revenue, customers</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <Button 
              onClick={() => setShowWizard(true)} 
              className="flex-1" 
              size="lg"
              disabled={isFinishing}
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              size="lg"
              disabled={isFinishing}
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

export function Onboarding() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}
