import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useVerifyOtp } from '../../features/auth/hooks/useVerifyOtp'
import { useSendOtp } from '../../features/auth/hooks/useSendOtp'
import { AuthLayout } from '../../features/auth/components/AuthLayout'
import { ROUTES } from '../../router/routes'

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.25 } }),
}

// Shake keyframes via CSS class added transiently
const shakeVariants = {
  idle: { x: 0 },
  shake: {
    x: [0, -8, 8, -8, 8, -4, 4, 0],
    transition: { duration: 0.45, ease: 'easeInOut' as const },
  },
}

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Phone comes from navigate state (RegisterPage) or query param fallback
  const phone: string =
    (location.state as { phone?: string } | null)?.phone ??
    searchParams.get('phone') ??
    ''

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [shaking, setShaking] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState<number>(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null))
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { mutate: verifyOtp, isPending: isVerifying } = useVerifyOtp()
  const { mutate: sendOtp, isPending: isSending } = useSendOtp()

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Cooldown tick
  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  const focusAt = useCallback((index: number) => {
    inputRefs.current[index]?.focus()
  }, [])

  function handleChange(index: number, value: string) {
    // Only accept a single digit
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    setErrorMsg(null)

    if (digit && index < OTP_LENGTH - 1) {
      focusAt(index + 1)
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        // Clear current field
        const next = [...digits]
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        // Move back and clear previous
        const next = [...digits]
        next[index - 1] = ''
        setDigits(next)
        focusAt(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusAt(index - 1)
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusAt(index + 1)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return

    const next = [...digits]
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]!
    }
    setDigits(next)
    setErrorMsg(null)

    // Focus the field after the last pasted digit (or last field)
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
    focusAt(focusIndex)
  }

  const otp = digits.join('')
  const isComplete = otp.length === OTP_LENGTH

  function triggerShake(message: string) {
    setErrorMsg(message)
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }

  function handleVerify() {
    if (!isComplete || isVerifying) return
    if (!phone) {
      triggerShake('Phone number is missing. Please go back and try again.')
      return
    }

    verifyOtp(
      { phone, otp },
      {
        onSuccess: () => {
          void navigate(ROUTES.HOME, { replace: true })
        },
        onError: () => {
          triggerShake('The code you entered is incorrect. Please try again.')
          setDigits(Array(OTP_LENGTH).fill(''))
          setTimeout(() => focusAt(0), 50)
        },
      },
    )
  }

  function handleResend() {
    if (cooldown > 0 || isSending || !phone) return
    sendOtp(phone, {
      onSuccess: () => {
        startCooldown()
        setDigits(Array(OTP_LENGTH).fill(''))
        setErrorMsg(null)
        setTimeout(() => focusAt(0), 50)
      },
    })
  }

  return (
    <AuthLayout
      title="Verify your number"
      subtitle={phone ? `We sent a 6-digit code to ${phone}` : 'Enter the 6-digit code we sent you'}
    >
      <div className="space-y-6">
        {/* OTP inputs */}
        <motion.div
          custom={0}
          variants={item}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="flex justify-center gap-2.5"
            variants={shakeVariants}
            animate={shaking ? 'shake' : 'idle'}
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                aria-label={`OTP digit ${index + 1}`}
                className={`
                  h-14 w-12 rounded-2xl border-2 text-center text-xl font-bold
                  transition-all duration-150 outline-none
                  ${digit
                    ? 'border-primary bg-primary/5 text-gray-900'
                    : 'border-gray-200 bg-gray-50 text-gray-900'
                  }
                  focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.12)]
                  ${shaking ? 'border-red-400 bg-red-50' : ''}
                `}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* Error message */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.p
              key={errorMsg}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-500 text-center py-2.5 bg-red-50 rounded-2xl px-3"
            >
              {errorMsg}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Verify button */}
        <motion.div custom={1} variants={item} initial="hidden" animate="visible">
          <motion.button
            type="button"
            disabled={!isComplete || isVerifying}
            onClick={handleVerify}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.08 }}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-2xl font-semibold text-sm cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ minHeight: '56px', touchAction: 'manipulation' }}
          >
            {isVerifying && (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {isVerifying ? 'Verifying…' : 'Verify'}
          </motion.button>
        </motion.div>

        {/* Resend code */}
        <motion.div
          custom={2}
          variants={item}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          {cooldown > 0 ? (
            <p className="text-sm text-gray-500">
              Resend code in{' '}
              <span className="font-semibold text-gray-700 tabular-nums">{cooldown}s</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isSending || !phone}
              className="text-sm font-semibold text-primary hover:underline cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ touchAction: 'manipulation' }}
            >
              {isSending ? 'Sending…' : 'Resend code'}
            </button>
          )}
        </motion.div>

        {/* Back link */}
        <motion.p
          custom={3}
          variants={item}
          initial="hidden"
          animate="visible"
          className="text-center text-sm text-gray-500"
        >
          Wrong number?{' '}
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="font-semibold text-primary hover:underline cursor-pointer"
            style={{ touchAction: 'manipulation' }}
          >
            Go back
          </button>
        </motion.p>
      </div>
    </AuthLayout>
  )
}
