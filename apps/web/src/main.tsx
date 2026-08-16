// Sentry MUST be initialized before any other imports
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN_WEB,
  environment: import.meta.env.MODE,
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  enabled: import.meta.env.MODE !== 'test',
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from './lib/queryClient'
import { RootErrorBoundary } from './components/errors/RootErrorBoundary'
import { AuthProvider } from './features/auth/AuthProvider'
import { AppRouter } from './router/AppRouter'

// Initialize i18n
import './i18n'
// Initialize axios (registers the instance with api-client)
import './lib/axios'
// Global styles
import './styles/globals.css'
import './styles/animations.css'

const root = document.getElementById('root')!

createRoot(root).render(
  <StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRouter />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              success: { duration: 3000 },
              error:   { duration: 5000 },
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>,
)
