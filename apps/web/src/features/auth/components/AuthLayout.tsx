import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Brand hero */}
      <div className="bg-gradient-to-br from-primary via-primary to-orange-500 px-6 pt-14 pb-10 text-white">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-2.5 mb-6"
        >
          <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
            <ShoppingBag size={20} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">GrandXL</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <h1 className="font-display font-bold text-2xl leading-tight">{title}</h1>
          <p className="mt-1.5 text-white/70 text-sm">{subtitle}</p>
        </motion.div>
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex-1 -mt-6 rounded-t-3xl bg-white px-5 pt-7 pb-12 shadow-[0_-4px_24px_rgba(0,0,0,0.07)]"
      >
        {children}
      </motion.div>
    </div>
  )
}
