import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

// S14-16: shared empty-state component. Consistent icon-circle + title +
// subtitle + optional action across every "nothing to show here" surface.
// Motion fade-in for perceived polish.
//
// Consumers: OrdersPage (empty tabs), FavoritesPage, NotificationsPage,
// RestaurantsPage empty filter, cart empty, etc. Retrofit gradually — this
// component doesn't force any migration, existing bespoke empty states still
// work; use this for anything new.

interface Props {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, subtitle, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex flex-col items-center text-center px-6 py-16"
    >
      <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={26} strokeWidth={1.6} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {subtitle && (
        <p className="mt-1.5 text-sm text-gray-500 max-w-xs leading-relaxed">{subtitle}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}
