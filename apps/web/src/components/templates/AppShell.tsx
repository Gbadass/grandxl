import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { NavBar } from '../organisms/NavBar'
import { BottomNav } from '../organisms/BottomNav'
import { CartFab } from '../organisms/CartFab'
import { ActiveOrderBanner } from '../organisms/ActiveOrderBanner'
import { useDetectLocation } from '../../hooks/useDetectLocation'
import { useWebPush } from '../../hooks/useWebPush'
import { useSocket } from '../../hooks/useSocket'
import { useThemeStore } from '../../store/theme.store'
import { useCartStore } from '../../features/cart/store/cart.store'
import { useAuthStore } from '../../store/auth.store'
import { ordersApi } from '@grandxl/api-client'
import { PaymentStatus } from '@grandxl/types'

// Recover from abandoned Paystack sessions. Paystack keeps payment status as
// "pending" for minutes after the user cancels — so polling Paystack is useless.
// Instead we check the ORDER's own payment record: if payment.status is COMPLETED
// (webhook arrived while user was away), clear cart. Otherwise leave the order
// alone (do NOT cancel — 30-min server timeout catches truly abandoned orders,
// and cancelling here could nuke an order about to succeed).
//
// Fires on: app mount / auth flip / tab focus / network reconnect. That way if the
// user closes the tab mid-payment then reopens the site 45s later, we detect the
// completed webhook and finish the cart-clear + navigation instead of leaving them
// with a stale cart.
function usePaystackRecovery() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const clearCart = useCartStore((s) => s.clearCart)

  useEffect(() => {
    // The callback page handles its own cleanup
    if (location.pathname === '/payment/callback') return
    if (!isAuthenticated) return

    function checkPending() {
      const orderId = sessionStorage.getItem('pendingPaystackOrderId')
      if (!orderId) return

      ordersApi.getById(orderId)
        .then((res) => {
          const order = res.data.data
          if (order.payment.status === PaymentStatus.COMPLETED) {
            // Webhook already arrived and processed — clear the cart and reap the marker
            clearCart()
            sessionStorage.removeItem('pendingPaystackOrderId')
            sessionStorage.removeItem('pendingPaystackReference')
          }
          // If still pending: leave sessionStorage in place so we retry on next
          // focus/reconnect. If failed/cancelled: same — server-side timeout will
          // eventually clean up; we don't need to be aggressive here.
        })
        .catch(() => undefined) // silent — don't disrupt the app
    }

    // Initial check
    checkPending()

    // Re-check on tab focus (user returns to tab)
    function onFocus() { checkPending() }
    // Re-check on network reconnect (offline → online)
    function onOnline() { checkPending() }

    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])
}

export function AppShell() {
  useDetectLocation()
  useWebPush()
  useSocket()
  usePaystackRecovery()

  const isDark = useThemeStore((s) => s.isDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100">
      <NavBar />
      {/* pt-0 on mobile (no top nav), pt-16 on desktop (top nav h-16) */}
      {/* pb-20 on mobile (bottom nav h-16 + 1rem gap), pb-0 on desktop */}
      <main className="pt-0 md:pt-16 pb-20 md:pb-0">
        <Outlet />
      </main>
      <CartFab />
      <ActiveOrderBanner />
      <BottomNav />
    </div>
  )
}
