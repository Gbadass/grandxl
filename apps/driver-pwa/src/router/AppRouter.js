import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ROUTES } from './routes';
import { ProtectedRoute, PublicOnlyRoute, RiderRoute } from './ProtectedRoute';
import { AppShell } from '../components/templates/AppShell';
const LoginPage = lazy(() => import('../pages/LoginPage'));
const OtpVerifyPage = lazy(() => import('../pages/OtpVerifyPage'));
const RegisterRiderPage = lazy(() => import('../pages/RegisterRiderPage'));
const RegisterDriverPage = lazy(() => import('../pages/RegisterDriverPage'));
const KycUploadPage = lazy(() => import('../pages/KycUploadPage'));
const PendingVerificationPage = lazy(() => import('../pages/PendingVerificationPage'));
const HomePage = lazy(() => import('../pages/HomePage'));
const AvailableJobsPage = lazy(() => import('../pages/AvailableJobsPage'));
const JobDetailPage = lazy(() => import('../pages/JobDetailPage'));
const ActiveDeliveryPage = lazy(() => import('../pages/ActiveDeliveryPage'));
const ChatPage = lazy(() => import('../pages/ChatPage'));
const EarningsPage = lazy(() => import('../pages/EarningsPage'));
const PayoutsPage = lazy(() => import('../pages/PayoutsPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
function PageLoader() {
    return (_jsx("div", { className: "flex h-screen items-center justify-center bg-zinc-950", children: _jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-primary" }) }));
}
function wrap(el) {
    return _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: el });
}
export function AppRouter() {
    return (_jsxs(Routes, { children: [_jsxs(Route, { element: _jsx(PublicOnlyRoute, {}), children: [_jsx(Route, { path: ROUTES.LOGIN, element: wrap(_jsx(LoginPage, {})) }), _jsx(Route, { path: ROUTES.OTP_VERIFY, element: wrap(_jsx(OtpVerifyPage, {})) })] }), _jsx(Route, { path: ROUTES.REGISTER_DRIVER, element: wrap(_jsx(RegisterDriverPage, {})) }), _jsxs(Route, { element: _jsx(ProtectedRoute, {}), children: [_jsx(Route, { path: ROUTES.REGISTER_RIDER, element: wrap(_jsx(RegisterRiderPage, {})) }), _jsx(Route, { path: ROUTES.KYC_UPLOAD, element: wrap(_jsx(KycUploadPage, {})) }), _jsx(Route, { path: ROUTES.PENDING_VERIFICATION, element: wrap(_jsx(PendingVerificationPage, {})) })] }), _jsx(Route, { element: _jsx(AppShell, {}), children: _jsxs(Route, { element: _jsx(RiderRoute, {}), children: [_jsx(Route, { path: ROUTES.HOME, element: wrap(_jsx(HomePage, {})) }), _jsx(Route, { path: ROUTES.AVAILABLE_JOBS, element: wrap(_jsx(AvailableJobsPage, {})) }), _jsx(Route, { path: ROUTES.JOB_DETAIL, element: wrap(_jsx(JobDetailPage, {})) }), _jsx(Route, { path: ROUTES.ACTIVE_DELIVERY, element: wrap(_jsx(ActiveDeliveryPage, {})) }), _jsx(Route, { path: ROUTES.CHAT, element: wrap(_jsx(ChatPage, {})) }), _jsx(Route, { path: ROUTES.EARNINGS, element: wrap(_jsx(EarningsPage, {})) }), _jsx(Route, { path: ROUTES.PAYOUTS, element: wrap(_jsx(PayoutsPage, {})) }), _jsx(Route, { path: ROUTES.PROFILE, element: wrap(_jsx(ProfilePage, {})) })] }) }), _jsx(Route, { path: ROUTES.UNAUTHORIZED, element: wrap(_jsx(PendingVerificationPage, {})) })] }));
}
//# sourceMappingURL=AppRouter.js.map