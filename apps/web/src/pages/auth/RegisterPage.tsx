import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { e164Phone } from '@grandxl/validators'
import { useRegister } from '../../features/auth/hooks/useRegister'
import { AuthLayout } from '../../features/auth/components/AuthLayout'
import { FormField } from '../../features/auth/components/FormField'
import { PasswordStrength } from '../../features/auth/components/PasswordStrength'
import { ROUTES } from '../../router/routes'

const formSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  phone: e164Phone,
  email: z.string().email().toLowerCase().trim().optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Add one uppercase letter')
    .regex(/[0-9]/, 'Add one number'),
  consentGiven: z
    .boolean()
    .refine((v) => v === true, 'You must accept to continue'),
})

type Fields = z.infer<typeof formSchema>

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.055, duration: 0.25 } }),
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { mutate: register, isPending, isError } = useRegister()

  const { register: field, handleSubmit, control, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(formSchema),
    defaultValues: { consentGiven: false },
  })

  const password = useWatch({ control, name: 'password', defaultValue: '' })

  function onSubmit(values: Fields) {
    register(
      {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        email: values.email || undefined,
        password: values.password,
        country: 'NG',
        consentGiven: true,
      },
      { onSuccess: () => void navigate(ROUTES.HOME, { replace: true }) },
    )
  }

  return (
    <AuthLayout title="Create account" subtitle="Join GrandXL and start ordering in minutes">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Name row */}
        <motion.div custom={0} variants={item} initial="hidden" animate="visible" className="grid grid-cols-2 gap-3">
          <FormField
            {...field('firstName')}
            id="firstName"
            label="First name"
            type="text"
            placeholder="Chidi"
            autoComplete="given-name"
            error={errors.firstName?.message}
          />
          <FormField
            {...field('lastName')}
            id="lastName"
            label="Last name"
            type="text"
            placeholder="Okafor"
            autoComplete="family-name"
            error={errors.lastName?.message}
          />
        </motion.div>

        <motion.div custom={1} variants={item} initial="hidden" animate="visible">
          <FormField
            {...field('phone')}
            id="phone"
            label="Phone number"
            type="tel"
            inputMode="tel"
            placeholder="+2348012345678"
            autoComplete="tel"
            hint="Include country code, e.g. +2348012345678"
            error={errors.phone?.message}
          />
        </motion.div>

        <motion.div custom={2} variants={item} initial="hidden" animate="visible">
          <FormField
            {...field('email')}
            id="email"
            label="Email (optional)"
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            autoComplete="email"
            error={errors.email?.message}
          />
        </motion.div>

        <motion.div custom={3} variants={item} initial="hidden" animate="visible">
          <FormField
            {...field('password')}
            id="password"
            label="Password"
            type="password"
            placeholder="Min. 8 chars, 1 uppercase, 1 number"
            autoComplete="new-password"
            error={errors.password?.message}
          />
          <PasswordStrength password={password ?? ''} />
        </motion.div>

        {/* Consent */}
        <motion.div custom={4} variants={item} initial="hidden" animate="visible" className="flex items-start gap-3">
          <input
            {...field('consentGiven')}
            id="consent"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
          <label htmlFor="consent" className="text-xs text-gray-500 cursor-pointer leading-relaxed">
            I agree to GrandXL's{' '}
            <a href="/privacy" className="text-primary hover:underline font-medium">Privacy Policy</a>
            {' '}and{' '}
            <a href="/terms" className="text-primary hover:underline font-medium">Terms of Service</a>
          </label>
        </motion.div>
        {errors.consentGiven && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-red-500 -mt-2"
          >
            {errors.consentGiven.message}
          </motion.p>
        )}

        {isError && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500 text-center py-2.5 bg-red-50 rounded-2xl px-3"
          >
            Something went wrong. This phone number may already be registered.
          </motion.p>
        )}

        <motion.div custom={5} variants={item} initial="hidden" animate="visible" className="pt-1">
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
            {isPending ? 'Creating account…' : 'Create account'}
          </motion.button>
        </motion.div>
      </form>

      <motion.p
        custom={6} variants={item} initial="hidden" animate="visible"
        className="mt-7 text-center text-sm text-gray-500"
      >
        Already have an account?{' '}
        <Link to={ROUTES.LOGIN} className="font-semibold text-primary hover:underline cursor-pointer">
          Sign in
        </Link>
      </motion.p>
    </AuthLayout>
  )
}
