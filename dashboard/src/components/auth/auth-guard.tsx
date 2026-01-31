import { useAuth, SignIn, SignUp } from '@clerk/clerk-react'
import { useState } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Pegasus</h1>
            <p className="text-muted-foreground">
              {mode === 'sign-in' 
                ? 'Sign in to access your analytics dashboard' 
                : 'Create an account to get started'}
            </p>
          </div>
          
          <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
            {mode === 'sign-in' ? (
              <SignIn 
                routing="hash"
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'shadow-none border-0 bg-transparent',
                    headerTitle: 'hidden',
                    headerSubtitle: 'hidden',
                    socialButtonsBlockButton: 'bg-secondary hover:bg-secondary/80 text-foreground border border-border',
                    formButtonPrimary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
                    formFieldInput: 'bg-background border-input text-foreground',
                    formFieldLabel: 'text-foreground',
                    footerActionLink: 'text-primary hover:text-primary/80',
                    identityPreviewText: 'text-foreground',
                    identityPreviewEditButton: 'text-primary',
                    dividerLine: 'bg-border',
                    dividerText: 'text-muted-foreground',
                  }
                }}
              />
            ) : (
              <SignUp 
                routing="hash"
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'shadow-none border-0 bg-transparent',
                    headerTitle: 'hidden',
                    headerSubtitle: 'hidden',
                    socialButtonsBlockButton: 'bg-secondary hover:bg-secondary/80 text-foreground border border-border',
                    formButtonPrimary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
                    formFieldInput: 'bg-background border-input text-foreground',
                    formFieldLabel: 'text-foreground',
                    footerActionLink: 'text-primary hover:text-primary/80',
                    identityPreviewText: 'text-foreground',
                    identityPreviewEditButton: 'text-primary',
                    dividerLine: 'bg-border',
                    dividerText: 'text-muted-foreground',
                  }
                }}
              />
            )}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {mode === 'sign-in' 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
