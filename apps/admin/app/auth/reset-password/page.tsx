'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AxiosError } from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { authApi } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import '../../../src/lib/axios'

function ResetPasswordInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token') ?? ''

  const [password,       setPassword]       = useState('')
  const [confirm,        setConfirm]        = useState('')
  const [showPass,       setShowPass]       = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [done,           setDone]           = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords don’t match.'); return }
    if (!token) { setError('This reset link is missing its token. Request a new one.'); return }

    setLoading(true)
    try {
      await authApi.resetPassword({ token, newPassword: password })
      setDone(true)
      // Brief celebration, then redirect to login.
      setTimeout(() => router.replace('/auth/login'), 1800)
    } catch (err) {
      if (err instanceof AxiosError) {
        const data = err.response?.data as ApiError | undefined
        setError(data?.message ?? 'This link is invalid or has expired. Request a new one.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Token missing entirely — link is broken or visited directly.
  if (!token && !done) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-7 w-7 text-red-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Invalid reset link</h1>
          <p className="mt-3 text-sm text-gray-500">
            This link doesn&apos;t carry a valid token. Request a new reset email to continue.
          </p>
          <Link
            href="/auth/forgot-password"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-zinc-700"
          >
            Request new link
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-7 w-7 text-emerald-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Password updated</h1>
            <p className="mt-3 text-sm text-gray-500">
              Sending you to the sign-in page…
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-[1.85rem] font-extrabold leading-tight tracking-tight text-gray-900">
              Set a new password
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Choose something secure — 8 characters minimum. You&apos;ll be signed out of all sessions.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
              {/* New password */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">New password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    autoFocus
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 pr-14 text-base text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-gray-700"
                  >
                    {showPass ? (
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Confirm new password</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type it again"
                  autoComplete="new-password"
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
                {loading ? 'Updating…' : 'Update password'}
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
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
        {children}
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  // useSearchParams must be wrapped in Suspense per Next.js app-router rules.
  return (
    <Suspense fallback={<Shell><p className="text-center text-sm text-gray-400">Loading…</p></Shell>}>
      <ResetPasswordInner />
    </Suspense>
  )
}
