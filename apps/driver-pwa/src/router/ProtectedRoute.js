import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Outlet } from 'react-router-dom';
import { authApi } from '@grandxl/api-client';
import { useAuthStore } from '../store/auth.store';
import { useRiderStore } from '../store/rider.store';
import { clearRiderToken } from '../lib/riderAuth';
import { ROUTES } from './routes';
import { UserRole } from '@grandxl/types';
function Spinner() {
    return (_jsx("div", { className: "flex h-screen items-center justify-center bg-zinc-950", children: _jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-primary" }) }));
}
// Shown when the refresh token cookie belongs to a non-rider account (dev: shared localhost cookies)
function WrongAccountScreen() {
    const { user, clearAuth } = useAuthStore();
    async function handleSwitch() {
        try {
            await authApi.logout();
        }
        catch { /* ignore */ }
        clearRiderToken();
        clearAuth();
        window.location.replace(ROUTES.LOGIN);
    }
    return (_jsxs("div", { className: "flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center", children: [_jsx("div", { className: "h-14 w-14 rounded-2xl bg-amber-500/15 flex items-center justify-center", children: _jsx("span", { className: "text-2xl", children: "\uD83D\uDD11" }) }), _jsxs("div", { children: [_jsx("h2", { className: "font-display text-lg font-bold text-zinc-100", children: "Wrong account" }), _jsxs("p", { className: "mt-1 text-sm text-zinc-500 max-w-xs", children: ["You're signed in as ", _jsx("span", { className: "text-zinc-300", children: user?.firstName ?? 'another user' }), " who doesn't have rider access. Please sign out and log in with your rider account."] })] }), _jsx("button", { onClick: () => void handleSwitch(), className: "mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold cursor-pointer", style: { touchAction: 'manipulation' }, children: "Sign out & switch account" })] }));
}
export function ProtectedRoute() {
    const { isAuthenticated, isInitializing } = useAuthStore();
    if (isInitializing)
        return _jsx(Spinner, {});
    if (!isAuthenticated)
        return _jsx(Navigate, { to: ROUTES.LOGIN, replace: true });
    return _jsx(Outlet, {});
}
export function PublicOnlyRoute() {
    const { isAuthenticated, isInitializing } = useAuthStore();
    if (isInitializing)
        return _jsx(Spinner, {});
    if (isAuthenticated)
        return _jsx(Navigate, { to: ROUTES.HOME, replace: true });
    return _jsx(Outlet, {});
}
// Requires the user to have the RIDER role AND a verified rider profile
export function RiderRoute() {
    const { isAuthenticated, isInitializing, user } = useAuthStore();
    const { rider } = useRiderStore();
    if (isInitializing)
        return _jsx(Spinner, {});
    if (!isAuthenticated)
        return _jsx(Navigate, { to: ROUTES.LOGIN, replace: true });
    // Authenticated but no RIDER role — likely wrong cookie in dev (all localhost apps share cookies).
    // Show a clear prompt to switch accounts rather than silently dropping them on the register form.
    if (!user?.roles.includes(UserRole.RIDER))
        return _jsx(WrongAccountScreen, {});
    if (!rider?.isVerified)
        return _jsx(Navigate, { to: ROUTES.PENDING_VERIFICATION, replace: true });
    return _jsx(Outlet, {});
}
//# sourceMappingURL=ProtectedRoute.js.map