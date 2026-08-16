import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Shield, Bell, CheckCircle2, FileText, Upload, LogOut } from 'lucide-react'
import { ridersApi, authApi } from '@grandxl/api-client'
import { useRiderStore } from '../store/rider.store'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from '../router/routes'

export default function PendingVerificationPage() {
  const navigate = useNavigate()
  const { rider, setRider } = useRiderStore()
  const { clearAuth } = useAuthStore()
  const [loading, setLoading] = useState(true)

  async function handleSignOut() {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    void navigate(ROUTES.LOGIN, { replace: true })
  }

  // On mount: fetch latest profile, then decide where the rider is in the flow
  useEffect(() => {
    let cancelled = false

    const fetchAndRoute = async () => {
      try {
        const res = await ridersApi.getProfile()
        if (cancelled) return
        const updated = res.data.data
        setRider(updated)

        if (updated.isVerified) {
          void navigate(ROUTES.HOME, { replace: true })
          return
        }

        const hasDocs =
          updated.documents?.idCard &&
          updated.documents?.driverLicense &&
          updated.documents?.vehiclePhoto

        if (!hasDocs) {
          void navigate(ROUTES.KYC_UPLOAD, { replace: true })
          return
        }
      } catch {
        // network error — stay on this page
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchAndRoute()
    return () => { cancelled = true }
  }, [navigate, setRider])

  // Continue polling every 30s after initial load
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await ridersApi.getProfile()
        const updated = res.data.data
        setRider(updated)
        if (updated.isVerified) {
          void navigate(ROUTES.HOME, { replace: true })
        }
      } catch {
        // silently ignore
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [navigate, setRider])

  const hasDocuments =
    rider?.documents?.idCard &&
    rider?.documents?.driverLicense &&
    rider?.documents?.vehiclePhoto

  const STEPS = [
    { Icon: FileText,     label: 'Documents submitted',  done: !!hasDocuments },
    { Icon: Shield,       label: 'Identity verification', done: false },
    { Icon: CheckCircle2, label: 'Account activated',    done: false },
  ]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-5 pt-16 pb-10">
      {/* Sign-out escape hatch */}
      <button
        onClick={() => void handleSignOut()}
        className="absolute top-5 right-5 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        style={{ touchAction: 'manipulation' }}
      >
        <LogOut size={13} />
        Sign out
      </button>

      {/* Animated clock icon */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="mb-8 relative"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20">
          <Clock size={44} className="text-amber-400" />
        </div>
        <motion.div
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-400"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-8"
      >
        <h1 className="font-display text-2xl font-bold text-zinc-100 mb-2">
          Under review
        </h1>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
          Our team is reviewing your documents. This usually takes up to{' '}
          <span className="text-amber-400 font-semibold">24 hours</span>.
        </p>
      </motion.div>

      {/* Progress steps */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="w-full mb-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 space-y-4"
      >
        {STEPS.map(({ Icon, label, done }, i) => (
          <div key={label} className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
              done
                ? 'bg-green-500 border-green-500'
                : i === 1
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-zinc-700 bg-zinc-800'
            }`}>
              {done ? (
                <CheckCircle2 size={16} className="text-white" />
              ) : i === 1 ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <Icon size={15} className="text-amber-400" />
                </motion.div>
              ) : (
                <Icon size={15} className="text-zinc-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                done ? 'text-green-400' : i === 1 ? 'text-amber-400' : 'text-zinc-600'
              }`}>
                {label}
              </p>
              {i === 1 && (
                <p className="text-xs text-zinc-600 mt-0.5">Checking your documents…</p>
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Info cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="w-full space-y-2.5 mb-8"
      >
        <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Bell size={15} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">We'll notify you</p>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              Once approved, you can log in and start accepting deliveries immediately.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="h-8 w-8 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <Shield size={15} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">Why we verify</p>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              Verification keeps our platform safe for customers, restaurants, and riders alike.
            </p>
          </div>
        </div>

        {/* Manual link to re-upload if needed */}
        <button
          onClick={() => void navigate(ROUTES.KYC_UPLOAD)}
          className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 cursor-pointer hover:border-zinc-700 transition-colors text-left"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Upload size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">Update documents</p>
            <p className="text-xs text-zinc-500 mt-0.5">Re-upload if you need to replace a document</p>
          </div>
        </button>
      </motion.div>

      {/* Refresh hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-xs text-zinc-700 text-center"
      >
        Checks for updates automatically every 30 seconds
      </motion.p>
    </div>
  )
}
