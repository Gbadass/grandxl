'use client'

import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '../store/auth.store'
import { useWebPush } from '../hooks/useWebPush'
import axiosInstance from '../lib/axios'
import type { User } from '@grandxl/types'

interface RefreshResponse {
  data: {
    accessToken: string
    user: User
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useWebPush()

  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await axiosInstance.post<RefreshResponse>('/auth/refresh')
        const { accessToken, user } = response.data.data
        useAuthStore.getState().setAuth(user, accessToken)
      } catch {
        useAuthStore.getState().clearAuth()
      } finally {
        useAuthStore.getState().setInitializing(false)
      }
    }

    void initAuth()
  }, []) // empty — runs once on mount; getState() avoids stale-closure issues

  return <>{children}</>
}
