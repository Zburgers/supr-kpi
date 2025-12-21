/**
 * Hook for managing user status and onboarding
 */

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { getUserStatus, completeOnboarding, resetOnboarding, type UserStatus } from '@/lib/api'

export function useUserStatus() {
  const { isSignedIn, isLoaded } = useAuth()
  const [status, setStatus] = useState<UserStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!isSignedIn) {
      setStatus(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await getUserStatus()
      
      if (response.success && response.data) {
        setStatus(response.data)
      } else {
        // User may not exist yet in DB, that's okay
        setStatus(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get user status')
    } finally {
      setLoading(false)
    }
  }, [isSignedIn])

  useEffect(() => {
    if (isLoaded) {
      fetchStatus()
    }
  }, [isLoaded, fetchStatus])

  const markOnboardingComplete = useCallback(async () => {
    try {
      setError(null)
      const response = await completeOnboarding()
      
      if (response.success && response.data) {
        setStatus(prev => prev ? { ...prev, onboardingComplete: true } : null)
        // Refetch to ensure state is in sync
        await fetchStatus()
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
      return false
    }
  }, [fetchStatus])

  const resetOnboardingStatus = useCallback(async () => {
    try {
      setError(null)
      const response = await resetOnboarding()
      
      if (response.success && response.data) {
        setStatus(prev => prev ? { ...prev, onboardingComplete: false } : null)
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset onboarding')
      return false
    }
  }, [])

  return {
    status,
    loading: loading || !isLoaded,
    error,
    onboardingComplete: status?.onboardingComplete ?? false,
    needsOnboarding: isLoaded && isSignedIn && status !== null && !status.onboardingComplete,
    markOnboardingComplete,
    resetOnboardingStatus,
    refetch: fetchStatus,
  }
}
