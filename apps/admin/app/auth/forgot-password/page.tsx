'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { authApi } from '@grandxl/api-client'
import '../../../src/lib/axios'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) { setError('Enter your email address.'); return }

    setLoading(true)
    try {
      await authApi.forgotPassword({ email: trimmed })
      // Backend always succeeds — it never reveals whether the email exists.
      setSent(true)
    } catch {
      // Even on network error, show the same confirmation — don't leak info.
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-10 shadow-xl shadow-orange-500/5"
      >
        <div className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GrandXL" className="h-12 w-auto object-contain" />
        </div>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-7 w-7 text-emerald-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75l-10.5 10.5L4.5 12.75M21.75 12a9.75 9.75 0 11-19.5 0 9.75 9.75 0 0119.5 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Check your email</h1>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                If an account exists for <strong className="text-gray-900">{email.trim().toLowerCase()}</strong>,
                we&apos;ve sent a reset link. It expires in <strong>15 minutes</strong>.
              </p>
              <p className="mt-4 text-xs text-gray-400">
                Didn&apos;t get the email? Check your spam folder, or{' '}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="font-semibold text-orange-600 underline-offset-2 hover:underline"
                >
                  try a different email
                </button>.
              </p>

              <Link
                href="/auth/login"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to sign in
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-[1.85rem] font-extrabold leading-tight tracking-tight text-gray-900">
                Forgot password?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Enter the email tied to your partner account and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </motion.p>
                )}

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.015 }}
                  whileTap={{   scale: loading ? 1 : 0.985 }}
                  className="w-full rounded-full bg-gray-900 py-4 text-base font-bold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
                >
                  {loading ? 'Sending link…' : 'Send reset link'}
                </motion.button>
              </form>

              <div className="mt-8 text-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 transition hover:text-orange-600"
                >
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Back to sign in
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
