'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: 'root', path: window.location.pathname },
      level: 'error',
    })
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 text-center">
      <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-white">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-400 max-w-sm">
        An unexpected error occurred. Your orders and data are safe.
        {error.digest && (
          <span className="block mt-1 font-mono text-xs text-gray-600">Ref: {error.digest}</span>
        )}
      </p>
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={reset}
          className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors cursor-pointer"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-xl border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  )
}
