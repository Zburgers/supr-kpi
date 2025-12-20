import { ThemeProvider } from '@/components/theme-provider'
import { SettingsProvider } from '@/contexts/settings-context'
import { Dashboard } from '@/pages/dashboard'
import './index.css'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="kpi-dashboard-theme">
      <SettingsProvider>
        <Dashboard />
      </SettingsProvider>
    </ThemeProvider>
  )
}

export default App
