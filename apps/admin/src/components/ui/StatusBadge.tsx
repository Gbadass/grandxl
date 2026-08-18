import { OrderStatus, PaymentStatus, RestaurantApprovalStatus } from '@grandxl/types'

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange' | 'purple'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green:  'bg-green-50 text-green-700 ring-1 ring-green-600/20',
  yellow: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20',
  red:    'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  blue:   'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  gray:   'bg-gray-100 text-gray-600 ring-1 ring-gray-500/20',
  orange: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20',
}

const DOT_CLASSES: Record<BadgeVariant, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  red:    'bg-red-500',
  blue:   'bg-blue-500',
  gray:   'bg-gray-400',
  orange: 'bg-orange-600',
  purple: 'bg-purple-500',
}

const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  [OrderStatus.PENDING]:   'yellow',
  [OrderStatus.CONFIRMED]: 'blue',
  [OrderStatus.PREPARING]: 'orange',
  [OrderStatus.READY]:     'purple',
  [OrderStatus.PICKED_UP]: 'blue',
  [OrderStatus.DELIVERED]: 'green',
  [OrderStatus.CANCELLED]: 'red',
}

const RESTAURANT_STATUS_VARIANT: Record<RestaurantApprovalStatus, BadgeVariant> = {
  [RestaurantApprovalStatus.PENDING_REVIEW]: 'yellow',
  [RestaurantApprovalStatus.INFO_REQUESTED]: 'orange',
  [RestaurantApprovalStatus.APPROVED]:       'green',
  [RestaurantApprovalStatus.REJECTED]:       'red',
  [RestaurantApprovalStatus.SUSPENDED]:      'gray',
  [RestaurantApprovalStatus.TERMINATED]:     'red',
}

const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, BadgeVariant> = {
  [PaymentStatus.PENDING]:   'yellow',
  [PaymentStatus.COMPLETED]: 'green',
  [PaymentStatus.FAILED]:    'red',
  [PaymentStatus.REFUNDED]:  'gray',
}

interface Props {
  label: string
  variant?: BadgeVariant
  orderStatus?: OrderStatus
  restaurantStatus?: RestaurantApprovalStatus
  paymentStatus?: PaymentStatus
}

export function StatusBadge({
  label,
  variant,
  orderStatus,
  restaurantStatus,
  paymentStatus,
}: Props) {
  const resolved: BadgeVariant =
    variant ??
    (orderStatus ? ORDER_STATUS_VARIANT[orderStatus] : undefined) ??
    (restaurantStatus ? RESTAURANT_STATUS_VARIANT[restaurantStatus] : undefined) ??
    (paymentStatus ? PAYMENT_STATUS_VARIANT[paymentStatus] : undefined) ??
    'gray'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[resolved]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[resolved]}`} />
      {label}
    </span>
  )
}
