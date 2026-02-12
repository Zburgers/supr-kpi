import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { ThemeProvider } from '@/components/theme-provider'
import { OnboardingProvider } from '@/contexts/onboarding-context'
import { AuthGuard } from '@/components/auth'
import { Dashboard } from '@/components/dashboard/dashboard'
import { Onboarding } from '@/pages/onboarding'
import { Settings } from '@/pages/settings'
import { PrivacyPolicy } from '@/pages/privacy-policy'
import { LandingPage } from '@/components/landing/landing-page'
import { useAuthenticatedApi } from '@/hooks/use-authenticated-api'
import { useUserStatus } from '@/hooks/useUserStatus'
import { navigate } from '@/lib/navigation'
import './index.css'

function AppContent() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const { isLoaded: clerkLoaded } = useUser()

  // Set up authenticated API calls
  useAuthenticatedApi()

  // Get user status from our backend (includes onboarding status)
  const { loading: statusLoading, needsOnboarding } = useUserStatus()

  useEffect(() => {
    // Listen for navigation events
    const handleNavigation = () => {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  // Show loading state while checking auth and status
  if (!clerkLoaded || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Simple routing based on path
  const renderPage = () => {
    // If onboarding is complete but URL is still /onboarding, send user to dashboard
    if (!needsOnboarding && currentPath === '/onboarding') {
      navigate('/dashboard')
      return <Dashboard />
    }

    // Force onboarding for new users (status exists but onboarding not complete)
    if (needsOnboarding && currentPath !== '/onboarding') {
      window.history.pushState({}, '', '/onboarding')
      return <Onboarding />
    }

    switch (currentPath) {
      case '/onboarding':
        return <Onboarding />
      case '/settings':
      case '/settings/account':
      case '/settings/credentials':
      case '/settings/automation':
      case '/settings/activity':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <OnboardingProvider>
      <div className="min-h-screen w-full flex flex-col">
        {renderPage()}
      </div>
    </OnboardingProvider>
  )
}

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  useEffect(() => {
    const handleNavigation = () => {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  // Public pages that don't require authentication
  if (currentPath === '/privacy-policy') {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="kpi-dashboard-theme">
        <PrivacyPolicy />
      </ThemeProvider>
    )
  }

  // Landing page for unauthenticated visitors on "/"
  if (currentPath === '/') {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="kpi-dashboard-theme">
        <LandingOrDashboard />
      </ThemeProvider>
    )
  }

  // /login and /signup routes show the AuthGuard (Clerk sign-in/sign-up)
  if (currentPath === '/login' || currentPath === '/signup') {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="kpi-dashboard-theme">
        <AuthGuard defaultMode={currentPath === '/signup' ? 'sign-up' : 'sign-in'}>
          <AppContent />
        </AuthGuard>
      </ThemeProvider>
    )
  }

  // All other pages (dashboard, settings, onboarding) require authentication
  return (
    <ThemeProvider defaultTheme="dark" storageKey="kpi-dashboard-theme">
      <AuthGuard>
        <AppContent />
      </AuthGuard>
    </ThemeProvider>
  )
}

/**
 * For the "/" route: if user is signed in, show dashboard. Otherwise, show landing page.
 */
function LandingOrDashboard() {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (isSignedIn) {
    return (
      <AuthGuard>
        <AppContent />
      </AuthGuard>
    )
  }

  return <LandingPage />
}

export default App
