import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { ThemeProvider } from '@/components/theme-provider'
import { SettingsProvider } from '@/contexts/settings-context'
import { OnboardingProvider } from '@/contexts/onboarding-context'
import { AuthGuard } from '@/components/auth'
import { Dashboard } from '@/pages/dashboard'
import { Onboarding } from '@/pages/onboarding'
import { Settings } from '@/pages/settings'
import { useAuthenticatedApi } from '@/hooks/use-authenticated-api'
import './index.css'

function AppContent() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const { user, isLoaded } = useUser()
  
  // Set up authenticated API calls
  useAuthenticatedApi()

  useEffect(() => {
    // Listen for navigation events
    const handleNavigation = () => {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  // Check if user needs onboarding (first time user)
  const needsOnboarding = isLoaded && user && !user.publicMetadata?.onboardingComplete

  // Simple routing based on path
  const renderPage = () => {
    // Force onboarding for new users
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
    <SettingsProvider>
      <OnboardingProvider>
        <div className="min-h-screen w-full flex flex-col">
          {renderPage()}
        </div>
      </OnboardingProvider>
    </SettingsProvider>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="kpi-dashboard-theme">
      <AuthGuard>
        <AppContent />
      </AuthGuard>
    </ThemeProvider>
  )
}

export default App
