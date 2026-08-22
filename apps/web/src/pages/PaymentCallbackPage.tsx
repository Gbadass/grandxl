import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { paymentsApi, ordersApi } from '@grandxl/api-client'
import { formatMoney } from '@grandxl/utils'
import { useCartStore } from '../features/cart/store/cart.store'

type VerifyState = 'verifying' | 'success' | 'pending' | 'failed'

const POLL_INTERVAL_MS  = 4_000
const MAX_POLL_ATTEMPTS = 10 // 40 seconds total — Paystack webhooks arrive within 30s

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation('payment')
  const clearCart = useCartStore((s) => s.clearCart)
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')
  const [state, setState] = useState<VerifyState>('verifying')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const attemptsRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelPendingOrder() {
    const pendingOrderId = sessionStorage.getItem('pendingPaystackOrderId')
    sessionStorage.removeItem('pendingPaystackOrderId')
    sessionStorage.removeItem('pendingPaystackReference')
    if (pendingOrderId) {
      void ordersApi.cancel(pendingOrderId, 'Payment cancelled or failed').catch(() => undefined)
    }
  }

  useEffect(() => {
    if (!reference) {
      cancelPendingOrder()
      setState('failed')
      return
    }

    let cancelled = false

    async function verify() {
      if (cancelled) return
      attemptsRef.current += 1

      try {
        const res = await paymentsApi.verify(reference!)
        if (cancelled) return

        const data = res.data.data

        if (data.verified) {
          // Payment confirmed — safe to clear the cart now
          clearCart()
          sessionStorage.removeItem('pendingPaystackOrderId')
          sessionStorage.removeItem('pendingPaystackReference')
          setOrderId(data.orderId)
          setAmount(data.amount)
          setState('success')
          toast.success(t('confirmed'))
          if (data.orderId) {
            timerRef.current = setTimeout(() => {
              void navigate(`/orders/${data.orderId}/tracking`, { replace: true })
            }, 2200)
          }
          return
        }

        // Payment not yet confirmed — may still be pending (webhook not yet arrived)
        if (data.status === 'pending' && attemptsRef.current < MAX_POLL_ATTEMPTS) {
          if (attemptsRef.current === 1) setState('pending')
          timerRef.current = setTimeout(() => { void verify() }, POLL_INTERVAL_MS)
          return
        }

        // Exhausted retries or payment genuinely failed/cancelled
        cancelPendingOrder()
        setState(data.status === 'pending' ? 'pending' : 'failed')
      } catch {
        if (cancelled) return
        if (attemptsRef.current < MAX_POLL_ATTEMPTS) {
          timerRef.current = setTimeout(() => { void verify() }, POLL_INTERVAL_MS)
        } else {
          // Network error after retries — don't destroy the order, let timeout handle it
          setState('pending')
        }
      }
    }

    void verify()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, navigate, clearCart])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {state === 'verifying' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-gray-600 font-medium">{t('verifying')}</p>
          <p className="text-xs text-gray-400">{t('verifyingDesc')}</p>
        </motion.div>
      )}

      {state === 'pending' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="h-20 w-20 rounded-full bg-amber-50 flex items-center justify-center">
            <Clock size={44} className="text-amber-500" />
          </div>
          <h1 className="text-xl font-display font-bold text-gray-900">{t('pendingTitle')}</h1>
          <p className="text-gray-500 text-sm max-w-xs">
            {t('pendingDesc')}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
            <button
              onClick={() => void navigate('/orders', { replace: true })}
              className="w-full py-3.5 rounded-2xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
              style={{ minHeight: '48px', touchAction: 'manipulation' }}
            >
              {t('checkOrders')}
            </button>
            <button
              onClick={() => void navigate('/', { replace: true })}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium cursor-pointer hover:border-gray-300 transition-colors"
            >
              {t('backToHome')}
            </button>
          </div>
        </motion.div>
      )}

      {state === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 20 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
            className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center"
          >
            <CheckCircle2 size={44} className="text-green-500" />
          </motion.div>
          <h1 className="text-xl font-display font-bold text-gray-900">{t('successTitle')}</h1>
          {amount !== null && (
            <p className="text-gray-500 text-sm">{t('paid', { amount: formatMoney(amount, 'NGN') })}</p>
          )}
          {orderId && (
            <p className="text-xs text-gray-400 animate-pulse">{t('redirecting')}</p>
          )}
          <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
            {orderId && (
              <button
                onClick={() => void navigate(`/orders/${orderId}/tracking`, { replace: true })}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
                style={{ minHeight: '48px', touchAction: 'manipulation' }}
              >
                {t('trackOrder')}
              </button>
            )}
            <button
              onClick={() => void navigate('/', { replace: true })}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium cursor-pointer hover:border-gray-300 transition-colors"
            >
              {t('backToHome')}
            </button>
          </div>
        </motion.div>
      )}

      {state === 'failed' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center">
            <XCircle size={44} className="text-red-400" />
          </div>
          <h1 className="text-xl font-display font-bold text-gray-900">{t('failedTitle')}</h1>
          <p className="text-gray-500 text-sm max-w-xs">
            {t('failedDesc')}
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
            <button
              onClick={() => void navigate('/checkout', { replace: true })}
              className="w-full py-3.5 rounded-2xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
              style={{ minHeight: '48px', touchAction: 'manipulation' }}
            >
              {t('tryAgain', 'Try again')}
            </button>
            <button
              onClick={() => void navigate('/', { replace: true })}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium cursor-pointer hover:border-gray-300 transition-colors"
            >
              {t('backToHome')}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
