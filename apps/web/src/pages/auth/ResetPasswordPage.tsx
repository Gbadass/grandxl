import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useResetPassword } from '../../features/auth/hooks/useResetPassword'
import { AuthLayout } from '../../features/auth/components/AuthLayout'
import { FormField } from '../../features/auth/components/FormField'
import { PasswordStrength } from '../../features/auth/components/PasswordStrength'
import { ROUTES } from '../../router/routes'

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Add one uppercase letter')
      .regex(/[0-9]/, 'Add one number'),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Passwords don't match",
    path: ['confirm'],
  })

type Fields = z.infer<typeof schema>

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.25 } }),
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { mutate: resetPassword, isPending, isSuccess } = useResetPassword()

  const { register, handleSubmit, control, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(schema),
  })

  const password = useWatch({ control, name: 'newPassword', defaultValue: '' })

  if (!token) {
    return (
      <AuthLayout title="Invalid link" subtitle="This reset link is not valid">
        <div className="flex flex-col items-center text-center py-8">
          <p className="text-sm text-gray-500 mb-6">
            Your reset link may have expired or already been used.
          </p>
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline cursor-pointer"
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (isSuccess) {
    return (
      <AuthLayout title="Password updated!" subtitle="You're all set">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center text-center py-4"
        >
          <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
            <ShieldCheck size={36} className="text-green-500" />
          </div>
          <p className="text-sm text-gray-500 max-w-xs mb-8">
            Your password has been updated successfully. You can now sign in with your new password.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => void navigate(ROUTES.LOGIN, { replace: true })}
            className="w-full flex items-center justify-center bg-primary text-white rounded-2xl font-semibold text-sm cursor-pointer hover:bg-primary/90 transition-colors"
            style={{ minHeight: '56px', touchAction: 'manipulation' }}
          >
            Sign in
          </motion.button>
        </motion.div>
      </AuthLayout>
    )
  }

  function onSubmit(values: Fields) {
    resetPassword({ token, newPassword: values.newPassword })
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password for your account">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <motion.div custom={0} variants={item} initial="hidden" animate="visible">
          <FormField
            {...register('newPassword')}
            id="newPassword"
            label="New password"
            type="password"
            placeholder="Min. 8 chars, 1 uppercase, 1 number"
            autoComplete="new-password"
            error={errors.newPassword?.message}
          />
          <PasswordStrength password={password ?? ''} />
        </motion.div>

        <motion.div custom={1} variants={item} initial="hidden" animate="visible">
          <FormField
            {...register('confirm')}
            id="confirm"
            label="Confirm new password"
            type="password"
            placeholder="Repeat your password"
            autoComplete="new-password"
            error={errors.confirm?.message}
          />
        </motion.div>

        <motion.div custom={2} variants={item} initial="hidden" animate="visible" className="pt-1">
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
            {isPending ? 'Saving…' : 'Set new password'}
          </motion.button>
        </motion.div>
      </form>

      <p className="mt-7 text-center">
        <Link
          to={ROUTES.LOGIN}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft size={15} />
          Back to login
        </Link>
      </p>
    </AuthLayout>
  )
}
