'use client'

import * as Sentry from '@sentry/nextjs'
import { type ReactNode, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from '../src/lib/queryClient'
import { AuthProvider } from '../src/components/AuthProvider'
import '../src/styles/globals.css'

Sentry.init({
  dsn: process.env['NEXT_PUBLIC_SENTRY_DSN_ADMIN'],
  environment: process.env['NODE_ENV'],
  tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
  enabled: process.env['NODE_ENV'] !== 'test',
})

export default function RootLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster position="top-center" />
        </QueryClientProvider>
      </body>
    </html>
  )
}
