import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ROUTES } from './routes'
import { ProtectedRoute, PublicOnlyRoute, RiderRoute } from './ProtectedRoute'
import { AppShell } from '../components/templates/AppShell'

const LoginPage = lazy(() => import('../pages/LoginPage'))
const OtpVerifyPage = lazy(() => import('../pages/OtpVerifyPage'))
const RegisterRiderPage = lazy(() => import('../pages/RegisterRiderPage'))
const KycUploadPage = lazy(() => import('../pages/KycUploadPage'))
const PendingVerificationPage = lazy(() => import('../pages/PendingVerificationPage'))
const HomePage = lazy(() => import('../pages/HomePage'))
const AvailableJobsPage = lazy(() => import('../pages/AvailableJobsPage'))
const JobDetailPage = lazy(() => import('../pages/JobDetailPage'))
const ActiveDeliveryPage = lazy(() => import('../pages/ActiveDeliveryPage'))
const ChatPage = lazy(() => import('../pages/ChatPage'))
const EarningsPage = lazy(() => import('../pages/EarningsPage'))
const PayoutsPage = lazy(() => import('../pages/PayoutsPage'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-primary" />
    </div>
  )
}

function wrap(el: React.ReactElement) {
  return <Suspense fallback={<PageLoader />}>{el}</Suspense>
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public-only pages */}
      <Route element={<PublicOnlyRoute />}>
        <Route path={ROUTES.LOGIN} element={wrap(<LoginPage />)} />
        <Route path={ROUTES.OTP_VERIFY} element={wrap(<OtpVerifyPage />)} />
      </Route>

      {/* Auth required — registration + KYC flow (no rider role or verified status required) */}
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.REGISTER_RIDER} element={wrap(<RegisterRiderPage />)} />
        <Route path={ROUTES.KYC_UPLOAD} element={wrap(<KycUploadPage />)} />
        <Route path={ROUTES.PENDING_VERIFICATION} element={wrap(<PendingVerificationPage />)} />
      </Route>

      {/* Rider-only pages inside the AppShell */}
      <Route element={<AppShell />}>
        <Route element={<RiderRoute />}>
          <Route path={ROUTES.HOME} element={wrap(<HomePage />)} />
          <Route path={ROUTES.AVAILABLE_JOBS} element={wrap(<AvailableJobsPage />)} />
          <Route path={ROUTES.JOB_DETAIL} element={wrap(<JobDetailPage />)} />
          <Route path={ROUTES.ACTIVE_DELIVERY} element={wrap(<ActiveDeliveryPage />)} />
          <Route path={ROUTES.CHAT} element={wrap(<ChatPage />)} />
          <Route path={ROUTES.EARNINGS} element={wrap(<EarningsPage />)} />
          <Route path={ROUTES.PAYOUTS} element={wrap(<PayoutsPage />)} />
          <Route path={ROUTES.PROFILE} element={wrap(<ProfilePage />)} />
        </Route>
      </Route>

      <Route path={ROUTES.UNAUTHORIZED} element={wrap(<PendingVerificationPage />)} />
    </Routes>
  )
}
