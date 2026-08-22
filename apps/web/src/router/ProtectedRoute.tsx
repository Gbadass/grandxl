import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from './routes'
import type { UserRole } from '@grandxl/types'

// Requires authentication — redirects to /login with returnTo so the login page
// sends the user back to the page they were trying to reach after they sign in.
export function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()
  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        state={{ returnTo: location.pathname + location.search }}
        replace
      />
    )
  }
  return <Outlet />
}

// Only for unauthenticated users — redirects logged-in users away from login/register
export function PublicOnlyRoute() {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to={ROUTES.HOME} replace />
  return <Outlet />
}

// Requires a specific role — redirects to /unauthorized if role doesn't match
interface RoleRouteProps {
  role: UserRole
}

export function RoleRoute({ role }: RoleRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />
  if (!user?.roles.includes(role)) return <Navigate to={ROUTES.UNAUTHORIZED} replace />
  return <Outlet />
}
