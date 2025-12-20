import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

// Get the Clerk publishable key from environment variables
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  console.error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable')
  // Show a helpful error in development
  if (import.meta.env.DEV) {
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: #f1f5f9; font-family: system-ui;">
        <div style="text-align: center; max-width: 600px; padding: 2rem;">
          <h1 style="color: #ef4444; margin-bottom: 1rem;">⚠️ Missing Clerk Configuration</h1>
          <p style="margin-bottom: 1rem;">Please create a <code style="background: #1e293b; padding: 0.25rem 0.5rem; border-radius: 0.25rem;">.env</code> file in the <code style="background: #1e293b; padding: 0.25rem 0.5rem; border-radius: 0.25rem;">dashboard</code> folder with:</p>
          <pre style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; text-align: left; overflow-x: auto;">VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here</pre>
          <p style="margin-top: 1rem; color: #94a3b8;">Get your key from <a href="https://dashboard.clerk.com" target="_blank" style="color: #60a5fa;">dashboard.clerk.com</a></p>
        </div>
      </div>
    `
  }
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)
