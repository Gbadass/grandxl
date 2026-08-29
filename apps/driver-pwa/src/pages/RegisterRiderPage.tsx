import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Bike, Car, AlertCircle, ChevronRight, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { ridersApi, authApi } from '@grandxl/api-client'
import { VehicleType } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useRiderStore } from '../store/rider.store'
import { useAuthStore } from '../store/auth.store'
import { loadRiderToken, saveRiderToken, clearRiderToken } from '../lib/riderAuth'
import { ROUTES } from '../router/routes'

interface VehicleOption {
  type: VehicleType
  label: string
  sub: string
  Icon: React.ElementType
}

const VEHICLES: VehicleOption[] = [
  { type: VehicleType.BICYCLE,    label: 'Bicycle',    sub: 'Eco-friendly short routes',   Icon: Bike },
  { type: VehicleType.MOTORCYCLE, label: 'Motorcycle', sub: 'Fast city deliveries',         Icon: Bike },
  { type: VehicleType.CAR,        label: 'Car',        sub: 'Comfortable all-weather rides', Icon: Car },
]

export default function RegisterRiderPage() {
  const { t } = useTranslation('rider')
  const navigate = useNavigate()
  const { setRider } = useRiderStore()
  const { setAuth, clearAuth } = useAuthStore()

  async function handleSignOut() {
    try {
      await authApi.logout()
    } catch {
      // ignore — clear local state regardless
    }
    clearRiderToken()
    clearAuth()
    void navigate(ROUTES.LOGIN, { replace: true })
  }

  const [vehicle, setVehicle] = useState<VehicleType>(VehicleType.MOTORCYCLE)
  const [plate, setPlate] = useState('')
  const [plateError, setPlateError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!plate.trim()) {
      setPlateError('Plate number is required')
      return
    }
    setPlateError(null)
    setLoading(true)
    try {
      const res = await ridersApi.registerRider({ vehicleType: vehicle, vehiclePlate: plate.trim().toUpperCase() })
      setRider(res.data.data)

      // Refresh the access token so the RIDER role is included in the auth store.
      // Use mobile refresh so we get the new refresh token in the body and can
      // save it to localStorage (cookie refresh only returns the token via cookie).
      const storedToken = loadRiderToken()
      if (storedToken) {
        const refreshRes = await authApi.refreshMobile({ refreshToken: storedToken })
        const d = refreshRes.data.data
        if (d.accessToken && d.user) {
          if (d.refreshToken) saveRiderToken(d.refreshToken)
          setAuth(d.user, d.accessToken)
        }
      } else {
        const refreshRes = await authApi.refresh()
        if (refreshRes.data.data.accessToken && refreshRes.data.data.user) {
          setAuth(refreshRes.data.data.user, refreshRes.data.data.accessToken)
        }
      }

      toast.success(t('register_success'))
      void navigate(ROUTES.KYC_UPLOAD, { replace: true })
    } catch (err) {
      toast.error(parseApiError(err, t('register_error')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 px-5 pt-14 pb-10">
      {/* Sign-out escape hatch */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute top-5 right-5"
      >
        <button
          onClick={() => void handleSignOut()}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
          <Bike size={24} className="text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-zinc-100 leading-tight">
          Become a rider
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Join GrandXL and start earning on your schedule
        </p>
      </motion.div>

      {/* Vehicle type picker */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mb-5"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Your vehicle
        </p>
        <div className="flex flex-col gap-2.5">
          {VEHICLES.map(({ type, label, sub, Icon }, i) => {
            const isSelected = vehicle === type
            return (
              <motion.button
                key={type}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                type="button"
                onClick={() => setVehicle(type)}
                className={`flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ${
                  isSelected ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm transition-colors ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
                </div>
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'border-primary bg-primary' : 'border-zinc-700'
                }`}>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-2 w-2 rounded-full bg-white"
                    />
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* Plate number */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-8"
      >
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Plate number
        </label>
        <input
          type="text"
          value={plate}
          onChange={(e) => { setPlate(e.target.value); setPlateError(null) }}
          placeholder={t('plate_number_placeholder')}
          className={`w-full rounded-2xl border bg-zinc-900 px-4 py-4 font-mono text-sm tracking-widest text-zinc-100 placeholder-zinc-700 outline-none transition-all duration-200 focus:ring-2 ${
            plateError
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-zinc-800 focus:border-primary focus:ring-primary/20'
          }`}
          style={{ fontSize: '16px', touchAction: 'manipulation' }}
          autoCapitalize="characters"
        />
        <AnimatePresence>
          {plateError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 flex items-center gap-1.5 text-xs text-red-400"
            >
              <AlertCircle size={12} />
              {plateError}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Info note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.38 }}
        className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-500 leading-relaxed"
      >
        Your application will be reviewed within 24 hours. We may contact you to verify your vehicle documents.
      </motion.div>

      {/* Submit */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => void handleSubmit()}
        disabled={loading}
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
        style={{ minHeight: '56px', touchAction: 'manipulation' }}
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            Submit application
            <ChevronRight size={18} />
          </>
        )}
      </motion.button>
    </div>
  )
}
