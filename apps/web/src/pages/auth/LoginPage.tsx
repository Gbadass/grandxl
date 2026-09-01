import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Phone, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLogin } from '../../features/auth/hooks/useLogin'
import { AuthLayout } from '../../features/auth/components/AuthLayout'
import { FormField } from '../../features/auth/components/FormField'
import { SignedInBanner } from '../../features/auth/components/SignedInBanner'
import { ROUTES } from '../../router/routes'

const schema = z.object({
  identifier: z.string().min(1, 'Phone or email is required'),
  password: z.string().min(1, 'Password is required'),
})

type Fields = z.infer<typeof schema>
type Mode = 'phone' | 'email'

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.25 } }),
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('auth')
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? ROUTES.HOME
  const { mutate: login, isPending, isError } = useLogin()
  const [mode, setMode] = useState<Mode>('phone')

  const { register, handleSubmit, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(schema),
  })

  function onSubmit(values: Fields) {
    const isEmail = values.identifier.includes('@')
    login(
      { [isEmail ? 'email' : 'phone']: values.identifier, password: values.password },
      { onSuccess: () => void navigate(returnTo, { replace: true }) },
    )
  }

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      <SignedInBanner />

      {/* Phone / Email segmented toggle */}
      <motion.div
        custom={0} variants={item} initial="hidden" animate="visible"
        className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6"
      >
        {(['phone', 'email'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            {m === 'phone' ? <Phone size={14} /> : <Mail size={14} />}
            {m === 'phone' ? t('login.phoneTab') : t('login.emailTab')}
          </button>
        ))}
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <motion.div custom={1} variants={item} initial="hidden" animate="visible">
          <FormField
            {...register('identifier')}
            id="identifier"
            label={mode === 'phone' ? t('login.phoneLabel') : t('login.emailLabel')}
            type={mode === 'email' ? 'email' : 'tel'}
            inputMode={mode === 'phone' ? 'tel' : 'email'}
            placeholder={mode === 'phone' ? t('login.phonePlaceholder') : t('login.emailPlaceholder')}
            autoComplete={mode === 'phone' ? 'tel' : 'email'}
            error={errors.identifier?.message}
          />
        </motion.div>

        <motion.div custom={2} variants={item} initial="hidden" animate="visible" className="space-y-1">
          <FormField
            {...register('password')}
            id="password"
            label={t('login.passwordLabel')}
            type="password"
            placeholder={t('login.passwordPlaceholder')}
            autoComplete="current-password"
            error={errors.password?.message}
          />
          <div className="text-right">
            <Link to={ROUTES.FORGOT_PASSWORD} className="text-xs text-primary font-medium hover:underline cursor-pointer">
              {t('login.forgotPassword')}
            </Link>
          </div>
        </motion.div>

        {isError && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500 text-center py-2.5 bg-red-50 rounded-2xl px-3"
          >
            {t('login.errorCredentials')}
          </motion.p>
        )}

        <motion.div custom={3} variants={item} initial="hidden" animate="visible" className="pt-1">
          <motion.button
            type="submit"
            disabled={isPending}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.08 }}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-2xl font-semibold text-sm cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ minHeight: '56px', touchAction: 'manipulation' }}
          >
            {isPending && (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {isPending ? t('login.signingIn') : t('login.submit')}
          </motion.button>
        </motion.div>
      </form>

      <motion.p
        custom={4} variants={item} initial="hidden" animate="visible"
        className="mt-7 text-center text-sm text-gray-500"
      >
        {t('login.newTo')}{' '}
        <Link to={ROUTES.REGISTER} className="font-semibold text-primary hover:underline cursor-pointer">
          {t('login.createAccount')}
        </Link>
      </motion.p>
    </AuthLayout>
  )
}
