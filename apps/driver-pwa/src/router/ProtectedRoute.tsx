import { Navigate, Outlet } from 'react-router-dom'
import { authApi } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'
import { useRiderStore } from '../store/rider.store'
import { clearRiderToken } from '../lib/riderAuth'
import { ROUTES } from './routes'
import { UserRole } from '@grandxl/types'

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-primary" />
    </div>
  )
}

// Shown when the refresh token cookie belongs to a non-rider account (dev: shared localhost cookies)
function WrongAccountScreen() {
  const { user, clearAuth } = useAuthStore()

  async function handleSwitch() {
    try { await authApi.logout() } catch { /* ignore */ }
    clearRiderToken()
    clearAuth()
    window.location.replace(ROUTES.LOGIN)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
        <span className="text-2xl">🔑</span>
      </div>
      <div>
        <h2 className="font-display text-lg font-bold text-zinc-100">Wrong account</h2>
        <p className="mt-1 text-sm text-zinc-500 max-w-xs">
          You're signed in as <span className="text-zinc-300">{user?.firstName ?? 'another user'}</span> who
          doesn't have rider access. Please sign out and log in with your rider account.
        </p>
      </div>
      <button
        onClick={() => void handleSwitch()}
        className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold cursor-pointer"
        style={{ touchAction: 'manipulation' }}
      >
        Sign out &amp; switch account
      </button>
    </div>
  )
}

export function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuthStore()
  if (isInitializing) return <Spinner />
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isInitializing } = useAuthStore()
  if (isInitializing) return <Spinner />
  if (isAuthenticated) return <Navigate to={ROUTES.HOME} replace />
  return <Outlet />
}

// Requires the user to have the RIDER role AND a verified rider profile
export function RiderRoute() {
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const { rider } = useRiderStore()

  if (isInitializing) return <Spinner />
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />
  // Authenticated but no RIDER role — likely wrong cookie in dev (all localhost apps share cookies).
  // Show a clear prompt to switch accounts rather than silently dropping them on the register form.
  if (!user?.roles.includes(UserRole.RIDER)) return <WrongAccountScreen />
  if (!rider?.isVerified) return <Navigate to={ROUTES.PENDING_VERIFICATION} replace />
  return <Outlet />
}
