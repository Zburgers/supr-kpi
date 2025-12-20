/**
 * Onboarding Context - Manages state during the onboarding flow
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { OnboardingState, OnboardingAction } from '@/types/ui';
import type { ServiceType } from '@/types/api';

interface OnboardingContextType extends OnboardingState {
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
  completeService: (service: ServiceType) => void;
  saveCredential: (service: ServiceType, credentialId: string) => void;
  saveSheet: (service: ServiceType, spreadsheetId: string, sheetName: string) => void;
  reset: () => void;
  isServiceCompleted: (service: ServiceType) => boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const initialState: OnboardingState = {
  currentStep: 0,
  completedServices: [],
  credentials: {
    google_sheets: null,
    meta: null,
    ga4: null,
    shopify: null,
  },
  sheetMappings: {
    google_sheets: null,
    meta: null,
    ga4: null,
    shopify: null,
  },
};

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'NEXT_STEP':
      return { ...state, currentStep: state.currentStep + 1 };

    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(0, state.currentStep - 1) };

    case 'SET_STEP':
      return { ...state, currentStep: action.step };

    case 'COMPLETE_SERVICE':
      if (state.completedServices.includes(action.service)) {
        return state;
      }
      return {
        ...state,
        completedServices: [...state.completedServices, action.service],
      };

    case 'SAVE_CREDENTIAL':
      return {
        ...state,
        credentials: {
          ...state.credentials,
          [action.service]: action.credentialId,
        },
      };

    case 'SAVE_SHEET':
      return {
        ...state,
        sheetMappings: {
          ...state.sheetMappings,
          [action.service]: {
            spreadsheetId: action.spreadsheetId,
            sheetName: action.sheetName,
          },
        },
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [state, dispatch] = useReducer(onboardingReducer, initialState);

  const nextStep = useCallback(() => {
    dispatch({ type: 'NEXT_STEP' });
  }, []);

  const prevStep = useCallback(() => {
    dispatch({ type: 'PREV_STEP' });
  }, []);

  const setStep = useCallback((step: number) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const completeService = useCallback((service: ServiceType) => {
    dispatch({ type: 'COMPLETE_SERVICE', service });
  }, []);

  const saveCredential = useCallback((service: ServiceType, credentialId: string) => {
    dispatch({ type: 'SAVE_CREDENTIAL', service, credentialId });
  }, []);

  const saveSheet = useCallback(
    (service: ServiceType, spreadsheetId: string, sheetName: string) => {
      dispatch({ type: 'SAVE_SHEET', service, spreadsheetId, sheetName });
    },
    []
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const isServiceCompleted = useCallback(
    (service: ServiceType) => {
      return state.completedServices.includes(service);
    },
    [state.completedServices]
  );

  const value: OnboardingContextType = {
    ...state,
    nextStep,
    prevStep,
    setStep,
    completeService,
    saveCredential,
    saveSheet,
    reset,
    isServiceCompleted,
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
