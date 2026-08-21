import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Bike, Car, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi, ridersApi } from '@grandxl/api-client'
import { VehicleType } from '@grandxl/types'
import { useRiderStore } from '../store/rider.store'
import { useAuthStore } from '../store/auth.store'
import { saveRiderToken } from '../lib/riderAuth'
import { ROUTES } from '../router/routes'

interface VehicleOption {
  type: VehicleType
  labelKey: string
  subKey: string
  Icon: React.ElementType
}

const VEHICLES: VehicleOption[] = [
  { type: VehicleType.BICYCLE,    labelKey: 'vehicle_bicycle',    subKey: 'vehicle_bicycle_sub',    Icon: Bike },
  { type: VehicleType.MOTORCYCLE, labelKey: 'vehicle_motorcycle', subKey: 'vehicle_motorcycle_sub', Icon: Bike },
  { type: VehicleType.CAR,        labelKey: 'vehicle_car',        subKey: 'vehicle_car_sub',        Icon: Car },
]

type Step = 'personal' | 'vehicle'

export default function RegisterDriverPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('rider')
  const phone = (location.state as { phone?: string } | null)?.phone ?? ''

  const { setRider } = useRiderStore()
  const { setAuth } = useAuthStore()

  const [step, setStep] = useState<Step>('personal')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [vehicle, setVehicle]     = useState<VehicleType>(VehicleType.MOTORCYCLE)
  const [plate, setPlate]         = useState('')
  const [loading, setLoading]     = useState(false)

  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; plate?: string }>({})

  // Redirect if no phone in state (arrived directly without OTP flow)
  if (!phone) {
    void navigate(ROUTES.LOGIN, { replace: true })
    return null
  }

  function validatePersonal() {
    const e: typeof errors = {}
    if (!firstName.trim()) e.firstName = t('first_name_required')
    if (!lastName.trim())  e.lastName  = t('last_name_required')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateVehicle() {
    const e: typeof errors = {}
    if (!plate.trim()) e.plate = t('plate_required')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function goToVehicle() {
    if (validatePersonal()) {
      setErrors({})
      setStep('vehicle')
    }
  }

  async function handleSubmit() {
    if (!validateVehicle()) return
    setLoading(true)
    try {
      // 1. Create account using the phone-verified Redis flag
      const regRes = await authApi.registerDriver({ phone, firstName: firstName.trim(), lastName: lastName.trim() })
      const { accessToken, refreshToken, user } = regRes.data.data
      if (refreshToken) saveRiderToken(refreshToken)
      setAuth(user!, accessToken!)

      // 2. Create rider profile with vehicle info (now authenticated)
      const riderRes = await ridersApi.registerRider({
        vehicleType: vehicle,
        vehiclePlate: plate.trim().toUpperCase(),
      })
      setRider(riderRes.data.data)

      toast.success(t('app_submitted'))
      void navigate(ROUTES.KYC_UPLOAD, { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      if (msg?.includes('expired')) {
        toast.error(t('expired_error'))
        void navigate(ROUTES.LOGIN, { replace: true })
      } else if (msg) {
        toast.error(msg)
      } else {
        toast.error(t('submit_error'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 px-5 pt-14 pb-10">

      {/* Progress dots */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-2">
        {(['personal', 'vehicle'] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${
              step === s ? 'bg-primary' : 'bg-zinc-800'
            }`}
          />
        ))}
      </div>

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => step === 'vehicle' ? setStep('personal') : void navigate(-1)}
        className="mb-8 flex cursor-pointer items-center gap-1.5 self-start text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        style={{ touchAction: 'manipulation' }}
      >
        <ChevronLeft size={18} />
        {t('back_btn')}
      </motion.button>

      <AnimatePresence mode="wait">

        {/* ── Step 1: Personal info ── */}
        {step === 'personal' && (
          <motion.div
            key="personal"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            <div className="mb-8">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
                <Bike size={24} className="text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight text-zinc-100">
                {t('create_account')}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500">
                {t('create_account_desc')}
              </p>
            </div>

            <div className="flex flex-col gap-4 mb-8">
              {/* First name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t('first_name_label')}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: undefined })) }}
                  placeholder={t('first_name_placeholder')}
                  className={`w-full rounded-2xl border bg-zinc-900 px-4 py-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all focus:ring-2 ${
                    errors.firstName
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-zinc-800 focus:border-primary focus:ring-primary/20'
                  }`}
                  style={{ fontSize: '16px', touchAction: 'manipulation' }}
                />
                <AnimatePresence>
                  {errors.firstName && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle size={12} />{errors.firstName}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Last name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t('last_name_label')}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, lastName: undefined })) }}
                  placeholder={t('last_name_placeholder')}
                  className={`w-full rounded-2xl border bg-zinc-900 px-4 py-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all focus:ring-2 ${
                    errors.lastName
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-zinc-800 focus:border-primary focus:ring-primary/20'
                  }`}
                  style={{ fontSize: '16px', touchAction: 'manipulation' }}
                />
                <AnimatePresence>
                  {errors.lastName && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle size={12} />{errors.lastName}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={goToVehicle}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 cursor-pointer"
              style={{ minHeight: '56px', touchAction: 'manipulation' }}
            >
              {t('continue_btn')}
              <ChevronRight size={18} />
            </motion.button>
          </motion.div>
        )}

        {/* ── Step 2: Vehicle info ── */}
        {step === 'vehicle' && (
          <motion.div
            key="vehicle"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold leading-tight text-zinc-100">
                {t('your_vehicle')}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500">
                {t('your_vehicle_desc')}
              </p>
            </div>

            {/* Vehicle picker */}
            <div className="mb-5 flex flex-col gap-2.5">
              {VEHICLES.map(({ type, labelKey, subKey, Icon }, i) => {
                const isSelected = vehicle === type
                return (
                  <motion.button
                    key={type}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
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
                        {t(labelKey)}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{t(subKey)}</p>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'border-primary bg-primary' : 'border-zinc-700'
                    }`}>
                      {isSelected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* Plate number */}
            <div className="mb-8">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {t('plate_number_label')}
              </label>
              <input
                type="text"
                value={plate}
                onChange={(e) => { setPlate(e.target.value); setErrors((p) => ({ ...p, plate: undefined })) }}
                placeholder={t('plate_number_placeholder')}
                className={`w-full rounded-2xl border bg-zinc-900 px-4 py-4 font-mono text-sm tracking-widest text-zinc-100 placeholder-zinc-700 outline-none transition-all focus:ring-2 ${
                  errors.plate
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-zinc-800 focus:border-primary focus:ring-primary/20'
                }`}
                style={{ fontSize: '16px', touchAction: 'manipulation' }}
                autoCapitalize="characters"
              />
              <AnimatePresence>
                {errors.plate && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle size={12} />{errors.plate}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-500 leading-relaxed">
              {t('vehicle_review_note')}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => void handleSubmit()}
              disabled={loading}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
              style={{ minHeight: '56px', touchAction: 'manipulation' }}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                <>
                  {t('submit_application')}
                  <ChevronRight size={18} />
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
