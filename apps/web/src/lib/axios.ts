import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import * as Sentry from '@sentry/react'
import { setClient } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'
import { useCartStore } from '../features/cart/store/cart.store'

// Single Axios instance for the entire web app.
// Every API call goes through this — never create a second instance.
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // CRITICAL: sends httpOnly cookie on every request
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// REQUEST INTERCEPTOR — attach access token from memory (Zustand) to every request
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Track concurrent 401s so we only call /auth/refresh once
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

// Refresh loop guard — if a fresh token keeps getting rejected (server race, clock skew,
// bad JWT sig), unlimited refresh attempts on unrelated in-flight requests would spin
// the CPU and hammer the server. Cap refresh attempts within a rolling window.
// Once tripped, force a hard logout — refreshing further won't help.
const REFRESH_COOLDOWN_MS = 500       // minimum gap between refresh calls
const MAX_REFRESHES_PER_WINDOW = 5    // max refresh attempts within window
const REFRESH_WINDOW_MS = 30_000
let lastRefreshStartedAt = 0
let refreshWindowStart = Date.now()
let refreshCountInWindow = 0

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

function forceLogoutFor(reason: string): void {
  useAuthStore.getState().clearAuth()
  useCartStore.getState().clearCart()
  import('react-hot-toast').then(({ default: toast }) => {
    toast.error(reason, { id: 'session-loop', duration: 5000 })
    setTimeout(() => { window.location.href = '/login' }, 1200)
  }).catch(() => { window.location.href = '/login' })
}

// RESPONSE INTERCEPTOR — handle 401 with silent token refresh
instance.interceptors.response.use(
  (res) => {
    // Capture request ID from response headers for Sentry correlation
    const requestId = res.headers['x-request-id'] as string | undefined
    if (requestId) Sentry.setTag('lastRequestId', requestId)
    return res
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !original._retry && useAuthStore.getState().isAuthenticated) {
      // Account was permanently deleted — skip refresh, show proper message and redirect
      const errMessage = (error.response.data as { message?: string } | undefined)?.message
      if (errMessage === 'ACCOUNT_DELETED') {
        useAuthStore.getState().clearAuth()
        useCartStore.getState().clearCart()
        import('react-hot-toast').then(({ default: toast }) => {
          toast.error('This account has been removed. Contact support if you believe this is a mistake.', {
            id: 'account-deleted',
            duration: 6000,
          })
          setTimeout(() => { window.location.href = '/login' }, 1500)
        }).catch(() => { window.location.href = '/login' })
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`
              resolve(instance(original))
            },
            reject,
          })
        })
      }

      original._retry = true

      // Circuit breaker — reset window if it's been long enough since first attempt
      const now = Date.now()
      if (now - refreshWindowStart > REFRESH_WINDOW_MS) {
        refreshWindowStart = now
        refreshCountInWindow = 0
      }
      // Cooldown — even if not looping, don't refresh faster than every 500ms
      if (now - lastRefreshStartedAt < REFRESH_COOLDOWN_MS) {
        // Somebody else just refreshed. If they succeeded, this request wouldn't be here
        // (it'd have used the fresh token). Getting here means the fresh token was already
        // rejected — treat as a session-dead signal.
        forceLogoutFor('Your session could not be renewed. Please log in again.')
        return Promise.reject(error)
      }
      if (refreshCountInWindow >= MAX_REFRESHES_PER_WINDOW) {
        forceLogoutFor('Session refresh failed too many times. Please log in again.')
        return Promise.reject(error)
      }

      lastRefreshStartedAt = now
      refreshCountInWindow += 1
      isRefreshing = true

      try {
        // Browser sends httpOnly cookie automatically — no token in body needed
        const res = await axios.post<{ data: { accessToken: string } }>(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        const newToken = res.data.data.accessToken
        useAuthStore.getState().setAuth(useAuthStore.getState().user!, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        return instance(original)
      } catch (err) {
        processQueue(err)
        forceLogoutFor('Your session expired. Please log in again.')
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    // Attach request ID to Sentry for error correlation
    const requestId = (error.response?.headers as Record<string, string> | undefined)?.[
      'x-request-id'
    ]
    if (requestId) Sentry.setTag('requestId', requestId)

    return Promise.reject(error)
  },
)

// Register with api-client package so all API functions use this instance
setClient(instance)

export default instance
