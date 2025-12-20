import { useState, useEffect } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { SettingsProvider } from '@/contexts/settings-context'
import { OnboardingProvider } from '@/contexts/onboarding-context'
import { Dashboard } from '@/pages/dashboard'
import { Onboarding } from '@/pages/onboarding'
import { Settings } from '@/pages/settings'
import './index.css'

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  useEffect(() => {
    // Listen for navigation events
    const handleNavigation = () => {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  // Simple routing based on path
  const renderPage = () => {
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
    <ThemeProvider defaultTheme="dark" storageKey="kpi-dashboard-theme">
      <SettingsProvider>
        <OnboardingProvider>
          {renderPage()}
        </OnboardingProvider>
      </SettingsProvider>
    </ThemeProvider>
  )
}

export default App
