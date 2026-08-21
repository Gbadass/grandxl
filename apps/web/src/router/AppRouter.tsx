import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ROUTES } from './routes'
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'
import { PageErrorBoundary } from '../components/errors/PageErrorBoundary'
import { OfflineBanner } from '../components/organisms/OfflineBanner'
import { AppShell } from '../components/templates/AppShell'

// Auth pages — lean, no shell
const LoginPage           = lazy(() => import('../pages/auth/LoginPage'))
const RegisterPage        = lazy(() => import('../pages/auth/RegisterPage'))
const ForgotPasswordPage  = lazy(() => import('../pages/auth/ForgotPasswordPage'))
const ResetPasswordPage   = lazy(() => import('../pages/auth/ResetPasswordPage'))
const VerifyOtpPage       = lazy(() => import('../pages/auth/VerifyOtpPage'))

// App pages — rendered inside AppShell
const HomePage            = lazy(() => import('../pages/HomePage'))
const RestaurantsPage     = lazy(() => import('../pages/RestaurantsPage'))
const RestaurantPage      = lazy(() => import('../pages/RestaurantPage'))
const CartPage            = lazy(() => import('../pages/CartPage'))
const CheckoutPage        = lazy(() => import('../pages/CheckoutPage'))
const OrdersPage          = lazy(() => import('../pages/OrdersPage'))
const OrderTrackingPage   = lazy(() => import('../pages/OrderTrackingPage'))
const ChatPage            = lazy(() => import('../pages/ChatPage'))
const ProfilePage         = lazy(() => import('../pages/ProfilePage'))
const WalletPage          = lazy(() => import('../pages/WalletPage'))
const NotificationsPage   = lazy(() => import('../pages/NotificationsPage'))
const AddressesPage       = lazy(() => import('../pages/AddressesPage'))
const PaymentCallbackPage = lazy(() => import('../pages/PaymentCallbackPage'))
const FavoritesPage       = lazy(() => import('../pages/FavoritesPage'))
const SearchPage          = lazy(() => import('../pages/SearchPage'))
const NotFoundPage        = lazy(() => import('../components/errors/NotFoundPage'))

function PageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

function wrap(element: React.ReactElement) {
  return <PageErrorBoundary>{element}</PageErrorBoundary>
}

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <OfflineBanner />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Auth pages — no shell, public-only */}
          <Route element={<PublicOnlyRoute />}>
            <Route path={ROUTES.LOGIN}           element={wrap(<LoginPage />)} />
            <Route path={ROUTES.REGISTER}        element={wrap(<RegisterPage />)} />
            <Route path={ROUTES.FORGOT_PASSWORD} element={wrap(<ForgotPasswordPage />)} />
            <Route path={ROUTES.RESET_PASSWORD}  element={wrap(<ResetPasswordPage />)} />
            <Route path={ROUTES.VERIFY_OTP}      element={wrap(<VerifyOtpPage />)} />
          </Route>

          {/* App pages — wrapped in AppShell (NavBar + BottomNav + CartFab) */}
          <Route element={<AppShell />}>
            {/* Public app pages */}
            <Route path={ROUTES.HOME}             element={wrap(<HomePage />)} />
            <Route path={ROUTES.RESTAURANTS}      element={wrap(<RestaurantsPage />)} />
            <Route path="/restaurants/:id"        element={wrap(<RestaurantPage />)} />
            <Route path={ROUTES.PAYMENT_CALLBACK} element={wrap(<PaymentCallbackPage />)} />
            <Route path={ROUTES.SEARCH}           element={wrap(<SearchPage />)} />

            {/* Protected app pages */}
            <Route element={<ProtectedRoute />}>
              <Route path={ROUTES.FAVORITES}             element={wrap(<FavoritesPage />)} />
              <Route path={ROUTES.CART}                  element={wrap(<CartPage />)} />
              <Route path={ROUTES.CHECKOUT}              element={wrap(<CheckoutPage />)} />
              <Route path={ROUTES.ORDERS}                element={wrap(<OrdersPage />)} />
              <Route path="/orders/:id/tracking"         element={wrap(<OrderTrackingPage />)} />
              <Route path="/orders/:id/chat"             element={wrap(<ChatPage />)} />
              <Route path={ROUTES.PROFILE}               element={wrap(<ProfilePage />)} />
              <Route path={ROUTES.WALLET}                element={wrap(<WalletPage />)} />
              <Route path={ROUTES.NOTIFICATIONS}         element={wrap(<NotificationsPage />)} />
              <Route path={ROUTES.ADDRESSES}             element={wrap(<AddressesPage />)} />
            </Route>
          </Route>

          <Route path="*" element={wrap(<NotFoundPage />)} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
