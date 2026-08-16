import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  CheckCircle2,
  UtensilsCrossed,
  Package,
  Bike,
  MapPin,
  Phone,
  Clock,
  ShoppingBag,
  XCircle,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { OrderStatus } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useOrder } from '../features/orders/hooks/useOrders'
import { socket } from '../lib/socket'
import { ReviewSheet } from '../features/reviews/components/ReviewSheet'

// ── Status config ─────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string
  description: string
  icon: LucideIcon
  color: string
  bg: string
  ring: string
  stepColor: string
}

const STATUS_CONFIG: Partial<Record<OrderStatus, StatusConfig>> = {
  [OrderStatus.PENDING]: {
    label: 'Waiting for restaurant',
    description: 'The restaurant is reviewing your order',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    stepColor: 'bg-amber-500',
  },
  [OrderStatus.CONFIRMED]: {
    label: 'Order confirmed!',
    description: 'The restaurant accepted your order',
    icon: CheckCircle2,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    stepColor: 'bg-blue-500',
  },
  [OrderStatus.PREPARING]: {
    label: 'Preparing your food',
    description: 'The kitchen is cooking your meal',
    icon: UtensilsCrossed,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    ring: 'ring-orange-200',
    stepColor: 'bg-orange-500',
  },
  [OrderStatus.READY]: {
    label: 'Ready for pickup',
    description: 'Your food is packed and waiting for a rider',
    icon: Package,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    ring: 'ring-purple-200',
    stepColor: 'bg-purple-500',
  },
  [OrderStatus.PICKED_UP]: {
    label: 'On the way!',
    description: 'Your rider has picked up your order',
    icon: Bike,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    ring: 'ring-indigo-200',
    stepColor: 'bg-indigo-500',
  },
  [OrderStatus.DELIVERED]: {
    label: 'Delivered!',
    description: 'Enjoy your meal',
    icon: Star,
    color: 'text-green-600',
    bg: 'bg-green-50',
    ring: 'ring-green-200',
    stepColor: 'bg-green-500',
  },
}

const STEPS: { status: OrderStatus; icon: LucideIcon; label: string }[] = [
  { status: OrderStatus.CONFIRMED, icon: CheckCircle2,    label: 'Order confirmed' },
  { status: OrderStatus.PREPARING, icon: UtensilsCrossed, label: 'Preparing your food' },
  { status: OrderStatus.READY,     icon: Package,          label: 'Ready for pickup' },
  { status: OrderStatus.PICKED_UP, icon: Bike,             label: 'On the way' },
  { status: OrderStatus.DELIVERED, icon: Star,             label: 'Delivered' },
]

const STATUS_RANK: Record<string, number> = {
  pending:   0,
  confirmed: 1,
  preparing: 2,
  ready:     3,
  picked_up: 4,
  delivered: 5,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrackingSkeleton() {
  return (
    <div className="animate-pulse max-w-2xl mx-auto px-4 pt-6 space-y-4">
      <div className="h-6 bg-gray-200 rounded w-1/3" />
      <div className="h-44 bg-gray-100 rounded-3xl" />
      <div className="h-52 bg-gray-100 rounded-3xl" />
      <div className="h-28 bg-gray-100 rounded-3xl" />
    </div>
  )
}

function StatusHero({ order }: { order: Order }) {
  const cfg = STATUS_CONFIG[order.status as OrderStatus]
  const isCancelled = order.status === OrderStatus.CANCELLED

  if (isCancelled) {
    return (
      <motion.div
        key="cancelled"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-red-50 border border-red-100 p-6 text-center"
      >
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
          <XCircle size={32} className="text-red-500" />
        </div>
        <p className="font-bold text-red-600 text-xl">Order cancelled</p>
        {order.cancelReason && (
          <p className="text-sm text-red-400 mt-1">{order.cancelReason}</p>
        )}
      </motion.div>
    )
  }

  if (!cfg) return null
  const Icon = cfg.icon
  const isDelivered = order.status === OrderStatus.DELIVERED

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={order.status}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className={`rounded-3xl ${cfg.bg} p-5 flex items-center gap-4`}
      >
        {/* Animated icon */}
        <div className="relative shrink-0">
          {/* Outer pulsing ring — only on active non-terminal states */}
          {!isDelivered && (
            <motion.div
              className={`absolute inset-0 rounded-full ring-4 ${cfg.ring}`}
              animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <motion.div
            className={`h-16 w-16 rounded-full ${cfg.bg} ring-2 ${cfg.ring} flex items-center justify-center`}
            animate={isDelivered ? { scale: [1, 1.12, 1] } : {}}
            transition={isDelivered ? { duration: 0.6, delay: 0.2 } : {}}
          >
            <motion.div
              initial={{ rotate: -20, scale: 0.7 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <Icon size={30} className={cfg.color} />
            </motion.div>
          </motion.div>
        </div>

        <div className="flex-1 min-w-0">
          <motion.p
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className={`font-display font-bold text-lg leading-tight ${cfg.color}`}
          >
            {cfg.label}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.17 }}
            className="text-sm text-gray-500 mt-0.5"
          >
            {cfg.description}
          </motion.p>
          {order.estimatedTime && !isDelivered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="flex items-center gap-1.5 mt-2"
            >
              <Clock size={12} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-500">
                ~{order.estimatedTime} min
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function ProgressTimeline({ order }: { order: Order }) {
  const currentRank = STATUS_RANK[order.status] ?? 0
  const isCancelled = order.status === OrderStatus.CANCELLED
  if (isCancelled) return null

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5">
      <div className="relative">
        {/* Vertical connector track */}
        <div
          className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-gray-100"
          aria-hidden
        />
        {/* Animated fill — grows as steps complete */}
        <motion.div
          className="absolute left-[19px] top-5 w-0.5 bg-primary origin-top"
          initial={{ height: 0 }}
          animate={{
            height: currentRank > 0
              ? `${Math.min(((currentRank - 1) / (STEPS.length - 1)) * 100, 100)}%`
              : '0%',
          }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          aria-hidden
        />

        <div className="flex flex-col gap-0">
          {STEPS.map((step, i) => {
            const stepRank = STATUS_RANK[step.status] ?? 0
            const isDone    = currentRank >= stepRank
            const isActive  = currentRank === stepRank
            const Icon = step.icon

            return (
              <motion.div
                key={step.status}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                className="flex items-center gap-3 py-3"
              >
                {/* Step dot */}
                <div className="relative shrink-0 z-10">
                  <AnimatePresence mode="wait">
                    {isDone ? (
                      <motion.div
                        key="done"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                        className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-sm"
                      >
                        <Icon size={17} className="text-white" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="pending"
                        initial={{ scale: 1 }}
                        className="h-10 w-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center"
                      >
                        <Icon size={17} className="text-gray-300" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Active pulse ring */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full ring-4 ring-primary/20"
                      animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1">
                  <p
                    className={`text-sm transition-all duration-300 ${
                      isActive
                        ? 'font-bold text-gray-900'
                        : isDone
                        ? 'font-medium text-gray-700'
                        : 'font-normal text-gray-300'
                    }`}
                  >
                    {step.label}
                  </p>
                  {isActive && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-xs text-primary/70 mt-0.5"
                    >
                      {STATUS_CONFIG[step.status]?.description}
                    </motion.p>
                  )}
                </div>

                {/* Done checkmark */}
                {isDone && !isActive && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <CheckCircle2 size={16} className="text-primary/40" />
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DeliveryAddressCard({ order }: { order: Order }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-white rounded-3xl shadow-sm p-4 flex items-start gap-3"
    >
      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <MapPin size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Delivering to</p>
        <p className="text-sm font-semibold text-gray-900 truncate">
          {order.deliveryAddress.street}
        </p>
        <p className="text-xs text-gray-400">
          {order.deliveryAddress.city}, {order.deliveryAddress.state}
        </p>
      </div>
    </motion.div>
  )
}

function RiderCard({ order }: { order: Order }) {
  if (!order.riderId || order.status !== OrderStatus.PICKED_UP) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="bg-white rounded-3xl shadow-sm p-4 flex items-center gap-3"
      >
        <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <Bike size={22} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your rider</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">On the way to you</p>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs text-green-600 font-medium">Live tracking</p>
          </div>
        </div>
        <a
          href="tel:"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
          aria-label="Call rider"
          style={{ touchAction: 'manipulation' }}
        >
          <Phone size={17} />
        </a>
      </motion.div>
    </AnimatePresence>
  )
}

function OrderSummaryCard({ order }: { order: Order }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-3xl shadow-sm p-4"
    >
      <h3 className="font-display font-bold text-base text-gray-900 mb-3">Your order</h3>

      <ul className="space-y-2 mb-3">
        {order.items.map((item) => (
          <div key={item.menuItemId} className="flex justify-between text-sm">
            <span className="text-gray-700">
              <span className="font-semibold text-gray-900">{item.quantity}×</span> {item.name}
            </span>
            <span className="font-medium text-gray-700">{formatMoney(item.itemTotal, order.currency)}</span>
          </div>
        ))}
      </ul>

      <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Subtotal</span>
          <span>{formatMoney(order.pricing.subtotal, order.currency)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Delivery fee</span>
          <span>{formatMoney(order.pricing.deliveryFee, order.currency)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Service fee</span>
          <span>{formatMoney(order.pricing.serviceFee, order.currency)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
          <span>Total</span>
          <span className="text-primary">{formatMoney(order.pricing.total, order.currency)}</span>
        </div>
      </div>

      {/* Payment method badge */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">Payment</span>
        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full capitalize">
          {order.payment?.method?.replace('_', ' ') ?? 'Paystack'}
        </span>
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: order, isLoading, isError, error } = useOrder(id ?? '')

  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)

  // Join the order socket room for real-time status pushes
  useEffect(() => {
    if (!id) return

    function joinRoom() {
      socket.emit('order:join_room', { orderId: id! })
    }

    joinRoom()
    // Re-join on reconnect — socket loses room membership on disconnect
    socket.on('connect', joinRoom)

    function onStatusUpdate(data: { orderId: string; status: string }) {
      if (data.orderId !== id) return
      // Invalidate so React Query re-fetches the full order immediately
      void queryClient.invalidateQueries({ queryKey: ['order', id] })
    }

    socket.on('order:status_update', onStatusUpdate)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('order:status_update', onStatusUpdate)
      socket.emit('order:leave_room', { orderId: id })
    }
  }, [id, queryClient])

  // Auto-open the review sheet 1.5s after delivery, once per order
  useEffect(() => {
    if (order?.status === 'delivered' && !reviewDone) {
      const t = setTimeout(() => setReviewOpen(true), 1500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [order?.status, reviewDone])

  if (isLoading) return <TrackingSkeleton />

  if (isError || !order) {
    const is403 = error && typeof error === 'object' && 'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 403
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <ShoppingBag size={28} className="text-gray-300" />
        </div>
        <p className="font-semibold text-gray-800 text-base">
          {is403 ? 'Session expired' : 'Order not found'}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {is403
            ? 'Your session ended. Go back and check your orders.'
            : "This order couldn't be loaded."}
        </p>
        <button
          onClick={() => void navigate('/orders', { replace: true })}
          className="mt-5 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl cursor-pointer"
        >
          Back to orders
        </button>
      </div>
    )
  }

  const isDelivered = order.status === OrderStatus.DELIVERED

  return (
    <div className="max-w-2xl mx-auto px-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button
          onClick={() => void navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors shrink-0"
          aria-label="Back"
          style={{ touchAction: 'manipulation' }}
        >
          <ChevronLeft size={18} className="text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-xl text-gray-900 leading-tight">Track order</h1>
          <p className="text-xs text-gray-400 font-mono">{order.orderNumber}</p>
        </div>
        {/* Live indicator — hidden when delivered */}
        {!isDelivered && order.status !== OrderStatus.CANCELLED && (
          <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full shrink-0">
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-green-500"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-xs font-semibold text-green-600">Live</span>
          </div>
        )}
      </div>

      {/* Status hero */}
      <StatusHero order={order} />

      {/* Progress timeline */}
      <div className="mt-3">
        <ProgressTimeline order={order} />
      </div>

      {/* Delivery address */}
      <div className="mt-3">
        <DeliveryAddressCard order={order} />
      </div>

      {/* Rider card — appears when picked up */}
      <div className="mt-3">
        <RiderCard order={order} />
      </div>

      {/* Customer note */}
      {order.customerNote && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 rounded-2xl bg-amber-50 border border-amber-100 p-3 flex items-start gap-2"
        >
          <ShoppingBag size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">{order.customerNote}</p>
        </motion.div>
      )}

      {/* Order summary */}
      <div className="mt-3">
        <OrderSummaryCard order={order} />
      </div>

      {/* Delivered CTA */}
      {isDelivered && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 space-y-3"
        >
          {!reviewDone && (
            <button
              onClick={() => setReviewOpen(true)}
              className="w-full py-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold cursor-pointer hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
              style={{ touchAction: 'manipulation', minHeight: '56px' }}
            >
              <Star size={18} className="fill-amber-400 text-amber-400" />
              Rate this order
            </button>
          )}
          <button
            onClick={() => void navigate('/')}
            className="w-full py-4 rounded-2xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
            style={{ touchAction: 'manipulation', minHeight: '56px' }}
          >
            Order again
          </button>
        </motion.div>
      )}

      {/* Review sheet */}
      <ReviewSheet
        orderId={id!}
        riderId={order?.riderId ?? null}
        isOpen={reviewOpen}
        onClose={() => {
          setReviewOpen(false)
          setReviewDone(true)
        }}
      />
    </div>
  )
}
