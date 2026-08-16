'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../store/auth.store'
import { UserRole } from '@grandxl/types'

export function useRequireAuth(requiredRole: UserRole) {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated) {
      router.replace('/auth/login')
      return
    }
    if (!user?.roles?.includes(requiredRole)) {
      router.replace('/auth/unauthorized')
    }
  }, [isAuthenticated, isInitializing, user, requiredRole, router])

  return { isInitializing, user, isAuthenticated }
}
