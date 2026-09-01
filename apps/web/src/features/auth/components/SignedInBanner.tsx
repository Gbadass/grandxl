import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2, LogOut } from 'lucide-react'
import { useAuthStore } from '../../../store/auth.store'
import { useLogout } from '../hooks/useLogout'
import { ROUTES } from '../../../router/routes'

// Rendered at the top of LoginPage + RegisterPage when the visitor is already
// authenticated. Solves the "must sign out first" dead-end: a stale session
// (shared browser, lingering refresh cookie) used to silently redirect new
// visitors home. Now they see who they're signed in as and get an obvious
// exit — Continue as this user, or Sign out and try a different account.
export function SignedInBanner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { mutate: logout, isPending } = useLogout()

  if (!user) return null

  // Honour any returnTo the user was aiming for before landing here; fall back
  // to home so Continue always has a sensible destination.
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? ROUTES.HOME

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">
            You&apos;re signed in as {user.firstName}
          </p>
          <p className="mt-0.5 text-xs text-gray-600">
            Continue to the app, or sign out to use a different account.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => navigate(returnTo, { replace: true })}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 active:scale-[0.98] transition"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => logout()}
          disabled={isPending}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
        >
          <LogOut size={14} />
          {isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
