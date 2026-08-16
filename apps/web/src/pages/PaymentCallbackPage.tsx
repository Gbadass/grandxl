import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { paymentsApi } from '@grandxl/api-client'
import { formatMoney } from '@grandxl/utils'

type VerifyState = 'verifying' | 'success' | 'failed'

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')
  const [state, setState] = useState<VerifyState>('verifying')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [amount, setAmount] = useState<number | null>(null)

  useEffect(() => {
    if (!reference) {
      setState('failed')
      return
    }

    let cancelled = false

    async function verify() {
      try {
        const res = await paymentsApi.verify(reference!)
        if (cancelled) return

        const data = res.data.data
        if (data.verified) {
          setOrderId(data.orderId)
          setAmount(data.amount)
          setState('success')
          toast.success('Payment confirmed!')
          // Auto-navigate to tracking after a short celebration delay
          if (data.orderId) {
            setTimeout(() => {
              void navigate(`/orders/${data.orderId}/tracking`, { replace: true })
            }, 2200)
          }
        } else {
          setState('failed')
        }
      } catch {
        if (!cancelled) setState('failed')
      }
    }

    void verify()
    return () => { cancelled = true }
  }, [reference, navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {state === 'verifying' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-gray-600 font-medium">Verifying your payment…</p>
          <p className="text-xs text-gray-400">This only takes a moment</p>
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
          <h1 className="text-xl font-display font-bold text-gray-900">Payment successful!</h1>
          {amount !== null && (
            <p className="text-gray-500 text-sm">{formatMoney(amount, 'NGN')} paid</p>
          )}
          {orderId && (
            <p className="text-xs text-gray-400 animate-pulse">Taking you to your order…</p>
          )}
          <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
            {orderId && (
              <button
                onClick={() => void navigate(`/orders/${orderId}/tracking`, { replace: true })}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
                style={{ minHeight: '48px', touchAction: 'manipulation' }}
              >
                Track your order
              </button>
            )}
            <button
              onClick={() => void navigate('/', { replace: true })}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium cursor-pointer hover:border-gray-300 transition-colors"
            >
              Back to home
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
          <h1 className="text-xl font-display font-bold text-gray-900">Payment failed</h1>
          <p className="text-gray-500 text-sm max-w-xs">
            We could not confirm your payment. Your order has not been placed.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
            <button
              onClick={() => void navigate('/', { replace: true })}
              className="w-full py-3.5 rounded-2xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
              style={{ minHeight: '48px', touchAction: 'manipulation' }}
            >
              Browse restaurants
            </button>
            <button
              onClick={() => void navigate('/orders', { replace: true })}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium cursor-pointer hover:border-gray-300 transition-colors"
            >
              View my orders
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
