import { useEffect, type ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '@grandxl/api-client'
import { useAuthStore } from '../../store/auth.store'
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from '../../lib/axios'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useSocket } from '../../hooks/useSocket'

interface Props {
  children: ReactNode
}

export function AuthProvider({ children }: Props) {
  const { setAuth, clearAuth, setInitializing } = useAuthStore()

  useEffect(() => {
    async function restoreSession(): Promise<void> {
      try {
        const refreshToken = await SecureStore.getItemAsync(SECURE_KEY_REFRESH)
        if (!refreshToken) {
          clearAuth()
          return
        }

        const res = await authApi.refreshMobile({ refreshToken })
        const { accessToken, refreshToken: newRefreshToken, user } = res.data.data

        await SecureStore.setItemAsync(SECURE_KEY_ACCESS, accessToken)
        if (newRefreshToken) await SecureStore.setItemAsync(SECURE_KEY_REFRESH, newRefreshToken)
        setAuth(user, accessToken)
      } catch {
        await SecureStore.deleteItemAsync(SECURE_KEY_ACCESS)
        await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH)
        clearAuth()
      } finally {
        setInitializing(false)
      }
    }

    restoreSession()
  }, [])

  // Wire up real-time features once auth state is known
  usePushNotifications()
  useSocket()

  return <>{children}</>
}
