'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AxiosError } from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { authApi } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import { UserRole } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import '../../../src/lib/axios'

export default function AdminLoginPage() {
  const router  = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [picker,      setPicker]      = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.portalLogin({ email: email.trim().toLowerCase(), password })
      const { accessToken, user } = res.data.data
      setAuth(user, accessToken)

      const isAdmin = user.roles?.includes(UserRole.SUPER_ADMIN)
      const isOwner = user.roles?.includes(UserRole.RESTAURANT_OWNER)

      if (isAdmin && isOwner) {
        setPicker(true)
      } else if (isOwner) {
        router.replace('/restaurant/dashboard')
      } else {
        router.replace('/dashboard')
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        const data = err.response?.data as ApiError | undefined
        setError(data?.message ?? 'Invalid email or password.')
      } else {
        setError('Something went wrong. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <motion.aside
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-zinc-950 p-12 lg:flex"
      >
        {/* Subtle grid lines */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Orange glow — bottom left */}
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-orange-600/15 blur-3xl" />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative"
        >
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="GrandXL" className="h-12 w-auto object-contain" />
          </Link>
        </motion.div>

        {/* Centre illustration + copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {/* Official logo — transparent PNG shows perfectly on dark bg */}
          <div className="mb-10 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="GrandXL" className="w-52 object-contain opacity-95" />
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-orange-500">Partner portal</p>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight text-white">
            Your restaurant,<br />your dashboard.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Manage orders, track deliveries, and grow your restaurant — all in one place.
          </p>

          {/* Mini stats */}
          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-zinc-800 pt-6">
            {[
              { v: '180+', l: 'Partners'     },
              { v: '24h',  l: 'Go-live time' },
              { v: '0%',   l: 'Commission'   },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-lg font-bold text-white">{s.v}</p>
                <p className="mt-0.5 text-xs text-zinc-600">{s.l}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="relative text-xs text-zinc-700"
        >
          &copy; {new Date().getFullYear()} GrandXL Technologies Ltd.
        </motion.p>
      </motion.aside>

      {/* ── Dashboard picker modal (multi-role users) ─────────────────────────── */}
      <AnimatePresence>
        {picker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0,  scale: 1   }}
              exit={{    opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  Which dashboard?
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Your account has access to both. Pick one to continue — you can switch any time.
                </p>
              </div>

              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => router.replace('/dashboard')}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left transition-all hover:border-orange-300 hover:bg-orange-50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">Admin Dashboard</p>
                    <p className="text-xs text-gray-500">Platform-wide controls, payouts, users, restaurants</p>
                  </div>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-orange-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => router.replace('/restaurant/dashboard')}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left transition-all hover:border-orange-300 hover:bg-orange-50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">Restaurant Dashboard</p>
                    <p className="text-xs text-gray-500">Your menu, orders, reviews, and earnings</p>
                  </div>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-orange-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </motion.button>
              </div>

              <p className="mt-6 text-center text-xs text-gray-400">
                Tip: bookmark each dashboard URL for one-click access next time.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Right panel: form ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-6">
          {/* Mobile logo */}
          <Link href="/" className="lg:invisible">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="GrandXL" className="h-9 w-auto object-contain" />
          </Link>

          <p className="ml-auto text-sm text-gray-500">
            New partner?{' '}
            <Link href="/auth/register" className="font-semibold text-gray-900 hover:text-orange-600 transition-colors">
              Register here
            </Link>
          </p>
        </div>

        {/* Form body — generous whitespace, Uber Eats-style centring */}
        <div className="flex flex-1 items-center justify-center px-8 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="w-full max-w-[420px]"
          >
            {/* Headline — Uber Eats "What's your…" style directness */}
            <div className="mb-10">
              <h1 className="text-[2rem] font-extrabold leading-tight tracking-tight text-gray-900">
                Welcome back
              </h1>
              <p className="mt-2 text-base text-gray-500">
                Sign in to your GrandXL partner dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Email address
                </label>
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

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">Password</label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-semibold text-orange-600 transition hover:text-orange-700"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 pr-14 text-base text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-gray-700 transition-colors"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
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

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0,  scale: 1    }}
                    exit={{    opacity: 0, y: -6,  scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3"
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4 shrink-0 text-red-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <p className="text-sm text-red-700">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit — full width, rounded-full, Uber Eats weight */}
              <div className="pt-2">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.015 }}
                  whileTap={{  scale: loading ? 1 : 0.975 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                  className="w-full rounded-full bg-gray-900 py-4 text-base font-bold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </motion.button>
              </div>
            </form>

            {/* Divider */}
            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-100" />
              <p className="text-xs text-gray-400">or</p>
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            {/* Back to homepage */}
            <Link href="/">
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 py-4 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to homepage
              </motion.div>
            </Link>

            <p className="mt-8 text-center text-xs text-gray-400">
              By signing in you agree to our{' '}
              <a href="#" className="underline underline-offset-2 hover:text-gray-700">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="underline underline-offset-2 hover:text-gray-700">Privacy Policy</a>.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
