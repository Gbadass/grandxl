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

// On app load, recover from abandoned Paystack sessions.
// Paystack keeps payment status as "pending" for minutes after the user cancels —
// so polling Paystack is useless. Instead we check the ORDER's own payment record:
// if payment.status is still PENDING, no webhook arrived → user abandoned → cancel.
function usePaystackRecovery() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const clearCart = useCartStore((s) => s.clearCart)

  useEffect(() => {
    // The callback page handles its own cleanup
    if (location.pathname === '/payment/callback') return
    if (!isAuthenticated) return

    const orderId = sessionStorage.getItem('pendingPaystackOrderId')
    if (!orderId) return

    ordersApi.getById(orderId)
      .then((res) => {
        const order = res.data.data
        if (order.payment.status === PaymentStatus.COMPLETED) {
          // Webhook already arrived and processed — clear the cart
          clearCart()
        } else {
          // Payment never completed — cancel the ghost order
          void ordersApi.cancel(orderId, 'Payment abandoned by user').catch(() => undefined)
        }
        sessionStorage.removeItem('pendingPaystackOrderId')
        sessionStorage.removeItem('pendingPaystackReference')
      })
      .catch(() => undefined) // silent — don't disrupt the app
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
