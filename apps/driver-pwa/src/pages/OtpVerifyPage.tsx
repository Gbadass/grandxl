import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../store/auth.store'
import { saveRiderToken } from '../lib/riderAuth'
import { ROUTES } from '../router/routes'

const OTP_LENGTH = 6
const RESEND_DELAY = 60

export default function OtpVerifyPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const location = useLocation()
  const phone = (location.state as { phone?: string } | null)?.phone ?? ''

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [countdown, setCountdown] = useState(RESEND_DELAY)
  const [loading, setLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const { setAuth } = useAuthStore()

  useEffect(() => {
    if (!phone) void navigate(ROUTES.LOGIN, { replace: true })
    else inputRefs.current[0]?.focus()
  }, [phone, navigate])

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [countdown])

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return
    setIsError(false)
    const next = [...otp]
    next[index] = value
    setOtp(next)
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
    // Auto-submit when all filled
    if (value && index === OTP_LENGTH - 1 && next.every(Boolean)) {
      void verifyCode(next.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    const next = [...Array(OTP_LENGTH).fill('')]
    text.split('').forEach((ch, i) => { next[i] = ch })
    setOtp(next)
    inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus()
    if (text.length === OTP_LENGTH) void verifyCode(text)
  }

  async function verifyCode(code: string) {
    if (code.length < OTP_LENGTH || loading) return
    setLoading(true)
    setIsError(false)
    try {
      const res = await authApi.verifyOtp({ phone, otp: code })
      const { accessToken, user, refreshToken, isNewUser } = res.data.data
      if (isNewUser) {
        void navigate(ROUTES.REGISTER_DRIVER, { replace: true, state: { phone } })
      } else {
        if (refreshToken) saveRiderToken(refreshToken)
        setAuth(user!, accessToken!)
        toast.success(t('verified_welcome'))
        void navigate(ROUTES.HOME, { replace: true })
      }
    } catch (err) {
      setIsError(true)
      setOtp(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
      toast.error(parseApiError(err, t('invalid_code')))
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    if (countdown > 0) return
    setCountdown(RESEND_DELAY)
    try {
      await authApi.sendOtp({ phone })
      toast.success(t('otp_sent', { phone }))
    } catch (err) {
      toast.error(parseApiError(err, t('common:error')))
    }
  }

  const filled = otp.filter(Boolean).length

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 px-6 pt-14">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => void navigate(-1)}
        className="mb-8 flex cursor-pointer items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100 self-start"
        style={{ touchAction: 'manipulation' }}
      >
        <ChevronLeft size={18} />
        {t('common:back')}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <ShieldCheck size={24} className="text-primary" />
        </div>
        <h1 className="mb-1 font-display text-2xl font-bold text-zinc-100">{t('verify_otp')}</h1>
        <p className="mb-8 text-sm text-zinc-400">
          {t('code_sent_to')} <span className="text-zinc-300 font-medium">{phone}</span>
        </p>
      </motion.div>

      {/* OTP input boxes */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mb-6 flex gap-3"
        onPaste={handlePaste}
      >
        {otp.map((digit, i) => (
          <motion.input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            animate={isError ? { x: [0, -8, 8, -6, 6, 0] } : {}}
            transition={{ duration: 0.4 }}
            className={`h-14 w-full rounded-2xl border bg-zinc-900 text-center text-2xl font-bold text-zinc-100 outline-none transition-all duration-200 focus:ring-2 ${
              isError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : digit
                ? 'border-primary focus:border-primary focus:ring-primary/20'
                : 'border-zinc-800 focus:border-primary focus:ring-primary/20'
            }`}
            aria-label={t('otp_digit_label', { number: i + 1 })}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {isError && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 text-center text-sm text-red-400"
          >
            {t('incorrect_code')}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => void verifyCode(otp.join(''))}
        disabled={loading || filled < OTP_LENGTH}
        className="mb-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        style={{ minHeight: '56px', touchAction: 'manipulation' }}
      >
        {loading && (
          <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        )}
        {loading ? t('verifying') : t('verify_otp')}
      </motion.button>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.22 }}
        onClick={() => void resend()}
        disabled={countdown > 0}
        className="cursor-pointer text-center text-sm text-zinc-400 transition-colors enabled:hover:text-primary disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {countdown > 0
          ? t('resend_countdown', { seconds: countdown })
          : t('resend_otp')}
      </motion.button>
    </div>
  )
}
