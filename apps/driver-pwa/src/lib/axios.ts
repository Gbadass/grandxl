import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import * as Sentry from '@sentry/react'
import { setClient } from '@grandxl/api-client'
import type { User } from '@grandxl/types'
import { useAuthStore } from '../store/auth.store'
import { loadRiderToken, saveRiderToken, clearRiderToken } from './riderAuth'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // sends httpOnly refresh-token cookie on every request
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

instance.interceptors.response.use(
  (res) => {
    const requestId = res.headers['x-request-id'] as string | undefined
    if (requestId) Sentry.setTag('lastRequestId', requestId)
    return res
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status   = error.response?.status
    const errMessage = (error.response?.data as { message?: string } | undefined)?.message

    // ACCOUNT_DELETED comes back with any status — check it BEFORE the auth
    // branch so we never try to refresh a token for an account that's gone.
    if (errMessage === 'ACCOUNT_DELETED') {
      clearRiderToken()
      useAuthStore.getState().clearAuth()
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error('This account has been removed. Contact support if you believe this is a mistake.', {
          id: 'account-deleted',
          duration: 6000,
        })
        setTimeout(() => { window.location.href = '/login' }, 1500)
      }).catch(() => { window.location.href = '/login' })
      return Promise.reject(error)
    }

    // Only 401 means "expired token — try refresh". 403 means "authenticated
    // but not authorized for this specific resource" (e.g. the rider is NOT
    // this order's assigned rider). Refreshing wouldn't change permissions;
    // retrying just doubles the traffic and — with concurrent 403s — trips
    // the short-window throttler on /auth/refresh, which then 429s and
    // force-logs-the-rider-out. The 403 should be surfaced to the caller so
    // the page can react (e.g. redirect to home with a "not your delivery"
    // toast) instead of thrashing the auth flow.
    const isAuthError = status === 401 && !original._retry

    if (isAuthError) {
      if (isRefreshing) {
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
      isRefreshing = true

      try {
        const storedRefreshToken = loadRiderToken()
        let newToken = ''
        let refreshedUser: User | null = null

        if (storedRefreshToken) {
          // Use mobile-style refresh to stay independent of the shared httpOnly cookie
          const res = await axios.post<{
            data: { accessToken: string; refreshToken?: string; user: User }
          }>(
            `${import.meta.env.VITE_API_URL}/auth/refresh/mobile`,
            { refreshToken: storedRefreshToken },
          )
          newToken = res.data.data.accessToken
          refreshedUser = res.data.data.user
          if (res.data.data.refreshToken) saveRiderToken(res.data.data.refreshToken)
        } else {
          // Fallback: cookie-based refresh (used before first localStorage token is set)
          const res = await axios.post<{ data: { accessToken: string; user?: User } }>(
            `${import.meta.env.VITE_API_URL}/auth/refresh`,
            {},
            { withCredentials: true },
          )
          newToken = res.data.data.accessToken
          refreshedUser = res.data.data.user ?? null
        }

        const currentUser = useAuthStore.getState().user
        useAuthStore.getState().setAuth(refreshedUser ?? currentUser!, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        return instance(original)
      } catch (err) {
        processQueue(err)
        clearRiderToken()
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    const requestId = (error.response?.headers as Record<string, string> | undefined)?.[
      'x-request-id'
    ]
    if (requestId) Sentry.setTag('requestId', requestId)

    return Promise.reject(error)
  },
)

setClient(instance)

export default instance
