import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Package } from 'lucide-react'
import { useActiveOrders } from '../../features/orders/hooks/useOrders'
import { ROUTES } from '../../router/routes'
import { OrderStatus } from '@grandxl/types'

const STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]:    'status.pending',
  [OrderStatus.CONFIRMED]:  'status.confirmed',
  [OrderStatus.PREPARING]:  'status.preparing',
  [OrderStatus.READY]:      'status.ready',
  [OrderStatus.PICKED_UP]:  'status.picked_up',
  [OrderStatus.DELIVERED]:  'status.delivered',
  [OrderStatus.CANCELLED]:  'status.cancelled',
}

const STATUS_COLOR: Record<string, string> = {
  [OrderStatus.PENDING]:   'bg-yellow-500',
  [OrderStatus.CONFIRMED]: 'bg-blue-500',
  [OrderStatus.PREPARING]: 'bg-orange-500',
  [OrderStatus.READY]:     'bg-green-500',
  [OrderStatus.PICKED_UP]: 'bg-indigo-500',
}

export function ActiveOrderBanner() {
  const { t } = useTranslation('orders')
  const { pathname } = useLocation()
  const { data: activeOrders } = useActiveOrders()

  const order = activeOrders?.[0]

  // Don't show on the tracking page itself — it already shows full order detail
  if (!order || pathname.includes('/tracking')) return null

  const dotColor = STATUS_COLOR[order.status] ?? 'bg-gray-400'

  return (
    // Sits above BottomNav (z-40) but below modals/toasts (z-50)
    // Bottom offset = BottomNav h-16 (4rem). Hidden on desktop (md+) since BottomNav is hidden there too.
    <Link
      to={ROUTES.ORDER_TRACKING(order._id)}
      className="md:hidden fixed inset-x-0 flex items-center gap-3 px-4 py-3 bg-gray-900 text-white shadow-lg cursor-pointer"
      style={{ bottom: '4rem', zIndex: 39 }} // sits flush above BottomNav (z-40)
      aria-label={t('banner.trackOrder')}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
        <Package className="w-4 h-4 text-white" />
      </div>

      {/* Status + order number */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Animated pulse dot */}
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
          </span>
          <span className="text-sm font-semibold truncate">
            {t(STATUS_LABEL[order.status] ?? 'status.pending', order.status)}
          </span>
        </div>
        <p className="text-xs text-white/60 truncate">
          {t('banner.orderNumber', { number: order.orderNumber })}
        </p>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-1 flex-shrink-0 text-xs font-medium text-white/80">
        <span>{t('banner.track')}</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </Link>
  )
}
