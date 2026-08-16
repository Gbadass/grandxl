import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowLeft } from 'lucide-react'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@grandxl/validators'
import { useForgotPassword } from '../../features/auth/hooks/useForgotPassword'
import { AuthLayout } from '../../features/auth/components/AuthLayout'
import { FormField } from '../../features/auth/components/FormField'
import { ROUTES } from '../../router/routes'

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const { mutate: forgotPassword, isPending } = useForgotPassword()

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  function onSubmit(values: ForgotPasswordFormValues) {
    forgotPassword(values.email, {
      onSuccess: () => {
        setSentEmail(values.email)
        setSubmitted(true)
      },
    })
  }

  return (
    <AuthLayout title="Forgot password?" subtitle="We'll send a reset link to your email">
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center py-4"
          >
            <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
              <Mail size={36} className="text-green-500" />
            </div>
            <h2 className="font-display font-bold text-xl text-gray-900 mb-2">Check your inbox</h2>
            <p className="text-sm text-gray-500 max-w-xs">
              If <span className="font-medium text-gray-700">{sentEmail}</span> is registered, you'll receive a reset link shortly. Check your spam folder too.
            </p>
            <Link
              to={ROUTES.LOGIN}
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline cursor-pointer"
            >
              <ArrowLeft size={15} />
              Back to login
            </Link>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <FormField
                  {...register('email')}
                  id="email"
                  label="Email address"
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  error={errors.email?.message}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="pt-1"
              >
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
                  {isPending ? 'Sending…' : 'Send reset link'}
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
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}
