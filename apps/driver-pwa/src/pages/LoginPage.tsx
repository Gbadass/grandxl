import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Bike, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@grandxl/api-client'
import { ROUTES } from '../router/routes'

const schema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+\d{7,15}$/, 'Enter E.164 format: +2348012345678'),
})

type FormValues = z.infer<typeof schema>

const item = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.25 } }),
}

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      await authApi.sendOtp({ phone: values.phone })
      toast.success(t('otp_sent', { phone: values.phone }))
      void navigate(ROUTES.OTP_VERIFY, { state: { phone: values.phone } })
    } catch {
      toast.error(t('common:error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6">
      {/* Brand */}
      <motion.div
        custom={0} variants={item} initial="hidden" animate="visible"
        className="mb-10 flex flex-col items-center gap-3"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
          <Bike size={28} className="text-white" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-zinc-100">GrandXL</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Rider Partner App</p>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-sm space-y-4">
        <motion.div custom={1} variants={item} initial="hidden" animate="visible">
          <label htmlFor="phone" className="block text-sm font-medium text-zinc-300 mb-1.5">
            {t('phone_label')}
          </label>
          <input
            {...register('phone')}
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="+2348012345678"
            autoComplete="tel"
            className={`w-full rounded-2xl border bg-zinc-900 px-4 py-3.5 text-zinc-100 placeholder-zinc-600 outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 ${
              errors.phone ? 'border-red-500 bg-red-950/20' : 'border-zinc-800'
            }`}
            style={{ fontSize: '16px' }}
          />
          <AnimatePresence initial={false}>
            {errors.phone && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400"
              >
                <AlertCircle size={12} />
                {errors.phone.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div custom={2} variants={item} initial="hidden" animate="visible">
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.08 }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
            style={{ minHeight: '56px', touchAction: 'manipulation' }}
          >
            {loading && (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {loading ? 'Sending code…' : t('send_otp')}
          </motion.button>
        </motion.div>
      </form>

      <motion.p
        custom={3} variants={item} initial="hidden" animate="visible"
        className="mt-8 text-center text-xs text-zinc-600 max-w-xs"
      >
        By signing in, you agree to our Terms of Service and Privacy Policy
      </motion.p>
    </div>
  )
}
