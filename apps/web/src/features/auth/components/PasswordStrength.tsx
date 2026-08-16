import { motion } from 'framer-motion'

function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: 'bg-gray-200' }
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-400' }
  if (score === 2) return { score, label: 'Fair', color: 'bg-orange-400' }
  if (score === 3) return { score, label: 'Good', color: 'bg-yellow-400' }
  return { score, label: 'Strong', color: 'bg-green-500' }
}

export function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = getStrength(password)
  if (!password) return null

  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${i < score ? color : 'bg-transparent'}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: i < score ? 1 : 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              style={{ transformOrigin: 'left' }}
            />
          </div>
        ))}
      </div>
      {label && (
        <p className={`text-xs font-medium ${score <= 1 ? 'text-red-500' : score === 2 ? 'text-orange-500' : score === 3 ? 'text-yellow-600' : 'text-green-600'}`}>
          {label}
        </p>
      )}
    </div>
  )
}
