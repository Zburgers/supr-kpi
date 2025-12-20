/**
 * UI-specific type definitions
 */

import type { ServiceType } from './api';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface OnboardingState {
  currentStep: number;
  completedServices: ServiceType[];
  credentials: Record<ServiceType, string | null>; // credential IDs
  sheetMappings: Record<ServiceType, { spreadsheetId: string; sheetName: string } | null>;
}

export interface ServiceSetupStep {
  service: ServiceType;
  step: 'credential' | 'verification' | 'sheet' | 'summary';
}

export type OnboardingAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_STEP'; step: number }
  | { type: 'COMPLETE_SERVICE'; service: ServiceType }
  | { type: 'SAVE_CREDENTIAL'; service: ServiceType; credentialId: string }
  | { type: 'SAVE_SHEET'; service: ServiceType; spreadsheetId: string; sheetName: string }
  | { type: 'RESET' };

export interface CronPreset {
  label: string;
  value: string;
  description: string;
}
