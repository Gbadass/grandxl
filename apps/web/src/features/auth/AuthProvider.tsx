import { useEffect, type ReactNode } from 'react'
import axios from 'axios'
import { useAuthStore } from '../../store/auth.store'

interface Props {
  children: ReactNode
}

// Runs once on every page load / browser refresh.
// Silently restores the user's session using the httpOnly refresh token cookie.
// While checking: renders <AppSkeleton /> to prevent flash of wrong UI state.
export function AuthProvider({ children }: Props) {
  const { setAuth, clearAuth, setInitializing, isInitializing } = useAuthStore()

  useEffect(() => {
    async function restoreSession(): Promise<void> {
      try {
        // Browser automatically sends the httpOnly cookie — no token in code needed
        const res = await axios.post<{
          data: { accessToken: string; user: import('@grandxl/types').User }
        }>(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        setAuth(res.data.data.user, res.data.data.accessToken)
      } catch (err: unknown) {
        clearAuth()
        // Show a single, non-looping message for permanently removed accounts
        const message = (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message
        if (message === 'ACCOUNT_DELETED') {
          const { default: toast } = await import('react-hot-toast')
          toast.error(
            'This account has been removed. Contact support if you believe this is a mistake.',
            { id: 'account-deleted', duration: 8000 },
          )
        }
      } finally {
        setInitializing(false)
      }
    }

    restoreSession()
  }, [])

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
