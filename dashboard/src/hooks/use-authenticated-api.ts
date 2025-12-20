import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setAuthTokenGetter } from '@/lib/api'

/**
 * Hook to set up authenticated API calls
 * Must be used within a Clerk provider
 */
export function useAuthenticatedApi() {
  const { getToken, isSignedIn } = useAuth()

  useEffect(() => {
    if (isSignedIn) {
      // Set the token getter for API calls
      setAuthTokenGetter(async () => {
        try {
          return await getToken()
        } catch (error) {
          console.error('Failed to get auth token:', error)
          return null
        }
      })
    } else {
      // Clear token getter when signed out
      setAuthTokenGetter(async () => null)
    }
  }, [getToken, isSignedIn])
}
