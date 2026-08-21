import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, type, className, ...props }, ref) => {
    const { t } = useTranslation('auth')
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

    return (
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="relative">
          <input
            ref={ref}
            type={resolvedType}
            className={`w-full rounded-2xl border bg-gray-50 px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400
              outline-none transition-all duration-200
              focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15
              ${error ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-100' : 'border-gray-200'}
              ${isPassword ? 'pr-11' : ''}
              ${className ?? ''}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label={showPassword ? t('formField.hidePassword') : t('formField.showPassword')}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          )}
        </div>

        {hint && !error && (
          <p className="text-xs text-gray-400">{hint}</p>
        )}

        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              id={`${props.id}-error`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5 text-xs text-red-500"
            >
              <AlertCircle size={12} />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    )
  },
)

FormField.displayName = 'FormField'
