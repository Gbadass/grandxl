import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  Navigation,
  type LucideIcon,
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { OrderStatus } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useOrder } from '../features/orders/hooks/useOrders'
import { socket } from '../lib/socket'
import { ReviewSheet } from '../features/reviews/components/ReviewSheet'
import { ordersApi, refundsApi, chatApi } from '@grandxl/api-client'
import type { RiderContact, ChatMessage } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from '../router/routes'
import toast from 'react-hot-toast'

// ── Status config ─────────────────────────────────────────────────────────────

interface StatusConfig {
  labelKey: string
  descriptionKey: string
  icon: LucideIcon
  color: string
  bg: string
  ring: string
  stepColor: string
}

const STATUS_CONFIG: Partial<Record<OrderStatus, StatusConfig>> = {
  [OrderStatus.PENDING]: {
    labelKey: 'statusPendingLabel',
    descriptionKey: 'statusPendingDesc',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    stepColor: 'bg-amber-500',
  },
  [OrderStatus.CONFIRMED]: {
    labelKey: 'statusConfirmedLabel',
    descriptionKey: 'statusConfirmedDesc',
    icon: CheckCircle2,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    stepColor: 'bg-blue-500',
  },
  [OrderStatus.PREPARING]: {
    labelKey: 'statusPreparingLabel',
    descriptionKey: 'statusPreparingDesc',
    icon: UtensilsCrossed,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    ring: 'ring-orange-200',
    stepColor: 'bg-orange-500',
  },
  [OrderStatus.READY]: {
    labelKey: 'statusReadyLabel',
    descriptionKey: 'statusReadyDesc',
    icon: Package,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    ring: 'ring-purple-200',
    stepColor: 'bg-purple-500',
  },
  [OrderStatus.PICKED_UP]: {
    labelKey: 'statusPickedUpLabel',
    descriptionKey: 'statusPickedUpDesc',
    icon: Bike,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    ring: 'ring-indigo-200',
    stepColor: 'bg-indigo-500',
  },
  [OrderStatus.DELIVERED]: {
    labelKey: 'statusDeliveredLabel',
    descriptionKey: 'statusDeliveredDesc',
    icon: Star,
    color: 'text-green-600',
    bg: 'bg-green-50',
    ring: 'ring-green-200',
    stepColor: 'bg-green-500',
  },
}

const STEPS: { status: OrderStatus; icon: LucideIcon; labelKey: string }[] = [
  { status: OrderStatus.CONFIRMED, icon: CheckCircle2,    labelKey: 'stepConfirmedLabel' },
  { status: OrderStatus.PREPARING, icon: UtensilsCrossed, labelKey: 'stepPreparingLabel' },
  { status: OrderStatus.READY,     icon: Package,          labelKey: 'stepReadyLabel' },
  { status: OrderStatus.PICKED_UP, icon: Bike,             labelKey: 'stepPickedUpLabel' },
  { status: OrderStatus.DELIVERED, icon: Star,             labelKey: 'stepDeliveredLabel' },
]

const STATUS_RANK: Record<string, number> = {
  pending:   0,
  confirmed: 1,
  preparing: 2,
  ready:     3,
  picked_up: 4,
  delivered: 5,
}

// ── Leaflet custom icons (avoids Vite asset path issues) ─────────────────────

const riderDivIcon = L.divIcon({
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#4f46e5;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>',
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const destDivIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#E84B3A;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>',
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// Auto-fit map bounds to rider + delivery pin
function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length === 0) return
    if (coords.length === 1) {
      map.setView(coords[0], 15)
    } else {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] })
    }
  }, [map, coords])
  return null
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
  const { t } = useTranslation('orders')
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
        <p className="font-bold text-red-600 text-xl">{t('orderCancelledStatus')}</p>
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
            {t(cfg.labelKey)}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.17 }}
            className="text-sm text-gray-500 mt-0.5"
          >
            {t(cfg.descriptionKey)}
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
  const { t } = useTranslation('orders')
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
                    {t(step.labelKey)}
                  </p>
                  {isActive && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-xs text-primary/70 mt-0.5"
                    >
                      {t(STATUS_CONFIG[step.status]?.descriptionKey ?? '')}
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
  const { t } = useTranslation('orders')
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
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{t('deliveringTo')}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">
          {order.deliveryAddress?.street}
        </p>
        <p className="text-xs text-gray-400">
          {order.deliveryAddress?.city}, {order.deliveryAddress?.state}
        </p>
      </div>
    </motion.div>
  )
}

const RIDER_ACTIVE_STATUSES = new Set<string>([
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
])

function RiderCard({
  order,
  riderCoords,
}: {
  order: Order
  riderCoords: { lat: number; lng: number } | null
}) {
  const { t } = useTranslation('orders')
  const [riderContact, setRiderContact] = useState<RiderContact | null>(null)
  const isPickedUp = order.status === OrderStatus.PICKED_UP

  useEffect(() => {
    if (!order.riderId || !RIDER_ACTIVE_STATUSES.has(order.status)) return
    ordersApi.getRiderContact(order._id).then((res) => {
      setRiderContact(res.data.data)
    }).catch(() => undefined)
  }, [order._id, order.riderId, order.status])

  const deliveryCoords = useMemo<[number, number] | null>(() => {
    const coords = order.deliveryAddress?.coordinates?.coordinates
    if (!coords) return null
    return [coords[1], coords[0]]
  }, [order.deliveryAddress.coordinates])

  const mapBounds = useMemo<[number, number][]>(() => [
    ...(riderCoords ? [[riderCoords.lat, riderCoords.lng] as [number, number]] : []),
    ...(deliveryCoords ? [deliveryCoords] : []),
  ], [riderCoords, deliveryCoords])

  const center = useMemo<[number, number]>(() =>
    riderCoords
      ? [riderCoords.lat, riderCoords.lng]
      : deliveryCoords ?? [6.5244, 3.3792]
  , [riderCoords, deliveryCoords])

  if (!order.riderId || !RIDER_ACTIVE_STATUSES.has(order.status)) return null

  const phaseLabel = isPickedUp ? t('onTheWayToYou') : t('headingToRestaurant')
  const phaseColor = isPickedUp ? 'text-indigo-600' : 'text-orange-600'
  const phaseBg    = isPickedUp ? 'bg-indigo-100'   : 'bg-orange-100'
  const phaseIcon  = isPickedUp ? 'bg-indigo-500'   : 'bg-orange-400'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="bg-white rounded-3xl shadow-sm overflow-hidden"
      >
        {/* Rider info row */}
        <div className="p-4 flex items-center gap-3">
          <div className={`h-12 w-12 rounded-full ${phaseBg} flex items-center justify-center shrink-0`}>
            <Bike size={22} className={phaseColor} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('yourRider')}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              {riderContact ? `${riderContact.firstName} ${riderContact.lastName}` : phaseLabel}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <motion.div
                className="h-1.5 w-1.5 rounded-full bg-green-400"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <p className="text-xs text-green-600 font-medium">
                {riderCoords ? t('gpsLiveUpdate') : t('waitingForRiderGps')}
              </p>
            </div>
          </div>
          <a
            href={riderContact?.phone ? `tel:${riderContact.phone}` : undefined}
            onClick={!riderContact?.phone ? (e) => e.preventDefault() : undefined}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors shrink-0 ${
              riderContact?.phone
                ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
            aria-label={t('callRider')}
            style={{ touchAction: 'manipulation' }}
          >
            <Phone size={17} />
          </a>
        </div>

        {/* Live map */}
        <div className="h-52 w-full" style={{ zIndex: 0 }}>
          <MapContainer
            center={center}
            zoom={14}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {riderCoords && (
              <Marker
                position={[riderCoords.lat, riderCoords.lng]}
                icon={riderDivIcon}
              />
            )}
            {deliveryCoords && (
              <Marker position={deliveryCoords} icon={destDivIcon} />
            )}
            {mapBounds.length > 0 && <FitBounds coords={mapBounds} />}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="px-4 py-2.5 flex items-center gap-4 border-t border-gray-50">
          <div className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded-full ${phaseIcon} border-2 border-white shadow-sm`} />
            <span className="text-[11px] text-gray-500">{t('riderLegend')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-primary border-2 border-white shadow-sm" />
            <span className="text-[11px] text-gray-500">{t('yourAddressLegend')}</span>
          </div>
          <span className={`ml-auto text-[11px] font-semibold ${phaseColor}`}>{phaseLabel}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function OrderSummaryCard({ order }: { order: Order }) {
  const { t } = useTranslation('orders')
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-3xl shadow-sm p-4"
    >
      <h3 className="font-display font-bold text-base text-gray-900 mb-3">{t('yourOrder')}</h3>

      <ul className="space-y-2 mb-3">
        {(order.items ?? []).map((item) => (
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
          <span>{t('subtotal')}</span>
          <span>{formatMoney(order.pricing.subtotal, order.currency)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>{t('deliveryFee')}</span>
          <span>{formatMoney(order.pricing.deliveryFee, order.currency)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>{t('serviceFee')}</span>
          <span>{formatMoney(order.pricing.serviceFee, order.currency)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
          <span>{t('total')}</span>
          <span className="text-primary">{formatMoney(order.pricing.total, order.currency)}</span>
        </div>
      </div>

      {/* Payment method badge */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">{t('payment')}</span>
        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full capitalize">
          {order.payment?.method?.replace('_', ' ') ?? 'Paystack'}
        </span>
      </div>
    </motion.div>
  )
}

const CHAT_ACTIVE_STATUSES = new Set<string>([
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
])

function ChatSection({ orderId, currentUserId }: { orderId: string; currentUserId: string }) {
  const { t } = useTranslation('orders')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [peerTyping, setPeerTyping] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  useQuery({
    queryKey: ['chat', orderId],
    queryFn: async () => {
      const res = await chatApi.getMessages(orderId, { limit: 30 })
      const data = res.data.data
      setMessages(data.messages)
      setUnreadCount(data.unreadCount)
      return data
    },
  })

  // Mark as read when panel is visible
  useEffect(() => {
    if (unreadCount > 0) {
      socket.emit('chat:read', { orderId })
      chatApi.markRead(orderId).catch(() => undefined)
      setUnreadCount(0)
    }
  }, [unreadCount, orderId])

  // Socket listeners (room join is handled by parent page)
  useEffect(() => {
    function onMessage(msg: ChatMessage) {
      setMessages((prev) => {
        if (msg.tempId) {
          const idx = prev.findIndex((m) => m._id === msg.tempId)
          if (idx !== -1) {
            const next = [...prev]
            next[idx] = { ...msg, status: 'sent' }
            return next
          }
        }
        if (prev.some((m) => m._id === msg._id)) return prev
        // Mark incoming message read immediately since panel is open
        socket.emit('chat:read', { orderId })
        return [...prev, { ...msg, status: 'sent' }]
      })
    }
    function onPeerTyping(data: { orderId: string; isTyping: boolean }) {
      if (data.orderId === orderId) setPeerTyping(data.isTyping)
    }
    function onMessagesRead(data: { orderId: string; readAt: string }) {
      if (data.orderId !== orderId) return
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === currentUserId && !m.readAt
            ? { ...m, isRead: true, readAt: data.readAt }
            : m,
        ),
      )
    }
    socket.on('chat:message', onMessage)
    socket.on('chat:peer_typing', onPeerTyping)
    socket.on('chat:messages_read', onMessagesRead)
    return () => {
      socket.off('chat:message', onMessage)
      socket.off('chat:peer_typing', onPeerTyping)
      socket.off('chat:messages_read', onMessagesRead)
    }
  }, [orderId, currentUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, peerTyping])

  function handleInput(value: string) {
    setText(value)
    if (!isTypingRef.current) {
      isTypingRef.current = true
      socket.emit('chat:typing', { orderId, isTyping: true })
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      isTypingRef.current = false
      socket.emit('chat:typing', { orderId, isTyping: false })
    }, 2000)
  }

  const send = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    if (isTypingRef.current) {
      isTypingRef.current = false
      socket.emit('chat:typing', { orderId, isTyping: false })
    }
    const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const optimistic: ChatMessage = {
      _id: tempId, orderId, senderId: currentUserId,
      senderRole: 'customer', text: trimmed,
      isRead: false, readAt: null, deletedAt: null,
      createdAt: new Date().toISOString(), status: 'sending',
    }
    setMessages((prev) => [...prev, optimistic])
    setText('')

    socket.emit('chat:send', { orderId, text: trimmed, tempId }, (ack: { ok: boolean; error?: string } | undefined) => {
      if (!ack?.ok) {
        setMessages((prev) =>
          prev.map((m) => m._id === tempId ? { ...m, status: 'failed' } : m),
        )
        toast.error(ack?.error ?? t('chatSendFailed'))
      }
    })
  }, [text, orderId, currentUserId])

  return (
    <div className="mt-4 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">{t('chatWithRider')}</p>
          {unreadCount > 0 && (
            <span className="h-5 min-w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount}
            </span>
          )}
        </div>
        <Link
          to={ROUTES.ORDER_CHAT(orderId)}
          className="text-xs text-primary font-semibold hover:underline"
        >
          {t('fullChat')}
        </Link>
      </div>
      <div className="h-52 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.length === 0 && !peerTyping && (
          <p className="text-xs text-gray-400 text-center mt-8">{t('noMessagesRider')}</p>
        )}
        {messages.map((m) => {
          const isMe = m.senderId === currentUserId
          const isFailed = m.status === 'failed'
          return (
            <div key={m._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  isMe
                    ? isFailed ? 'bg-red-100 text-red-700 rounded-br-sm' : 'bg-primary text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                } ${m.status === 'sending' ? 'opacity-60' : ''}`}
              >
                {m.deletedAt ? <span className="italic opacity-60">{t('messageRemoved')}</span> : m.text}
              </div>
              {isMe && m.readAt && (
                <span className="text-[10px] text-primary mt-0.5 mr-1">{t('messageRead')}</span>
              )}
              {isFailed && (
                <button
                  onClick={() => {
                    setMessages((prev) => prev.filter((x) => x._id !== m._id))
                    setText(m.text)
                  }}
                  className="text-[11px] text-red-500 font-semibold mt-0.5 cursor-pointer"
                >
                  {t('chatFailedRetry')}
                </button>
              )}
            </div>
          )
        })}
        {peerTyping && (
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1 items-center">
              {[0, 0.15, 0.3].map((d, i) => (
                <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-gray-400"
                  animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d }} />
              ))}
            </div>
            <span className="text-xs text-gray-400">{t('riderTyping')}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <input
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={t('chatPlaceholder')}
          maxLength={500}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-40 cursor-pointer"
          style={{ minHeight: '44px', touchAction: 'manipulation' }}
        >
          {t('chatSend')}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation('orders')
  const { data: order, isLoading, isError, error } = useOrder(id ?? '')
  const user = useAuthStore((s) => s.user)

  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [refunding, setRefunding] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundSheetOpen, setRefundSheetOpen] = useState(false)
  const [riderApproachingMetres, setRiderApproachingMetres] = useState<number | null>(null)
  const [dispatchPhase, setDispatchPhase] = useState<'searching' | 'broadcast' | 'no_riders' | null>(null)
  // ETA countdown: ticks down from estimatedTime in minutes
  const [etaSecondsLeft, setEtaSecondsLeft] = useState<number | null>(null)

  // Initialise ETA countdown from order.estimatedTime when it becomes available
  useEffect(() => {
    if (!order?.estimatedTime || order.status === OrderStatus.DELIVERED) {
      setEtaSecondsLeft(null)
      return
    }
    setEtaSecondsLeft(order.estimatedTime * 60)
  }, [order?.estimatedTime, order?.status])

  // Tick the ETA down every second
  useEffect(() => {
    if (etaSecondsLeft === null || etaSecondsLeft <= 0) return
    const timer = setInterval(() => {
      setEtaSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [etaSecondsLeft])

  // Join the order socket room for real-time status pushes and rider GPS
  useEffect(() => {
    if (!id) return

    function joinRoom() {
      socket.emit('order:join_room', { orderId: id! })
    }

    joinRoom()
    // Re-join on reconnect — socket loses room membership on disconnect
    socket.on('connect', joinRoom)

    function onStatusUpdate(data: { orderId: string; status: string; eta?: number }) {
      if (data.orderId !== id) return
      void queryClient.invalidateQueries({ queryKey: ['order', id] })
      // Reset ETA countdown when server sends a fresh eta value
      if (data.eta != null && data.eta > 0) {
        setEtaSecondsLeft(data.eta * 60)
      }
      // Clear dispatch phase banner once a rider is found (order is moving)
      if (data.status === 'preparing' || data.status === 'ready' || data.status === 'picked_up') {
        setDispatchPhase(null)
      }
    }

    function onRiderLocation(data: { riderId: string; lat: number; lng: number; bearing: number }) {
      setRiderCoords({ lat: data.lat, lng: data.lng })
    }

    function onRiderApproachingCustomer(data: { orderId: string; distanceMetres: number }) {
      if (data.orderId !== id) return
      setRiderApproachingMetres(data.distanceMetres)
      setTimeout(() => setRiderApproachingMetres(null), 30_000)
    }

    function onDispatchUpdate(data: { orderId: string; phase: 'searching' | 'broadcast' | 'no_riders' }) {
      if (data.orderId !== id) return
      setDispatchPhase(data.phase)
    }

    socket.on('order:status_update', onStatusUpdate)
    socket.on('rider:location', onRiderLocation)
    socket.on('rider:approaching_customer', onRiderApproachingCustomer)
    socket.on('order:dispatch_update', onDispatchUpdate)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('order:status_update', onStatusUpdate)
      socket.off('rider:location', onRiderLocation)
      socket.off('rider:approaching_customer', onRiderApproachingCustomer)
      socket.off('order:dispatch_update', onDispatchUpdate)
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
          {is403 ? t('sessionExpired') : t('orderNotFound')}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {is403 ? t('sessionExpiredSub') : t('orderNotFoundSub')}
        </p>
        <button
          onClick={() => void navigate('/orders', { replace: true })}
          className="mt-5 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl cursor-pointer"
        >
          {t('backToOrders')}
        </button>
      </div>
    )
  }

  const isDelivered = order.status === OrderStatus.DELIVERED
  // Only PENDING is cancellable by customers — CONFIRMED+ is locked by the backend
  const isCancellable = order.status === OrderStatus.PENDING
  const isConfirmedLocked = order.status === OrderStatus.CONFIRMED

  async function handleCancel() {
    setCancelling(true)
    try {
      await ordersApi.cancel(order!._id, 'Cancelled by customer')
      await queryClient.invalidateQueries({ queryKey: ['order', id] })
      toast.success(t('cancelSuccess'))
    } catch {
      toast.error(t('cancelError'))
    } finally {
      setCancelling(false)
    }
  }

  async function handleRefund() {
    if (!refundReason.trim()) {
      toast.error(t('refundReasonRequired'))
      return
    }
    setRefunding(true)
    try {
      await refundsApi.create({
        orderId: id!,
        amountKobo: order!.pricing.total,
        reason: refundReason,
      })
      toast.success(t('refundSuccess'))
      setRefundSheetOpen(false)
      setRefundReason('')
    } catch {
      toast.error(t('refundError'))
    } finally {
      setRefunding(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button
          onClick={() => void navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors shrink-0"
          aria-label={t('common:back')}
          style={{ touchAction: 'manipulation' }}
        >
          <ChevronLeft size={18} className="text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-xl text-gray-900 leading-tight">{t('trackOrder')}</h1>
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
            <span className="text-xs font-semibold text-green-600">{t('live')}</span>
          </div>
        )}
      </div>

      {/* Status hero */}
      <StatusHero order={order} />

      {/* ETA countdown banner */}
      <AnimatePresence>
        {etaSecondsLeft !== null && etaSecondsLeft > 0 && order.status !== OrderStatus.DELIVERED && (
          <motion.div
            key="eta-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 rounded-2xl bg-primary/5 border border-primary/15 px-4 py-3 flex items-center gap-3"
          >
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock size={15} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary/80 uppercase tracking-wide">{t('estimatedArrival')}</p>
              <p className="text-sm font-bold text-gray-900">
                {t('minsAway', { count: Math.ceil(etaSecondsLeft / 60) })}
              </p>
            </div>
            {/* Countdown ring */}
            <div className="shrink-0">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3" className="stroke-primary/10" />
                <circle
                  cx="18" cy="18" r="14"
                  fill="none" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 14}`}
                  strokeDashoffset={`${2 * Math.PI * 14 * (etaSecondsLeft / ((order.estimatedTime ?? 30) * 60))}`}
                  className="stroke-primary transition-all duration-1000"
                />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dispatch phase banner — searching for rider */}
      <AnimatePresence>
        {dispatchPhase && dispatchPhase !== 'no_riders' && (
          <motion.div
            key="dispatch-searching"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3"
          >
            <motion.div
              className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            >
              <Bike size={15} className="text-blue-600" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-700">{t('findingRider')}</p>
              <p className="text-xs text-blue-500 mt-0.5">{t('broadcastingRiders')}</p>
            </div>
          </motion.div>
        )}
        {dispatchPhase === 'no_riders' && (
          <motion.div
            key="dispatch-no-riders"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3"
          >
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Clock size={15} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700">{t('noRidersNearby')}</p>
              <p className="text-xs text-amber-600 mt-0.5">{t('noRidersRetry')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rider approaching customer banner */}
      <AnimatePresence>
        {riderApproachingMetres !== null && (
          <motion.div
            key="approaching-banner"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            className="mt-3 rounded-2xl bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-3"
          >
            <motion.div
              className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <Bike size={15} className="text-green-600" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-bold text-green-700">{t('riderNearby')}</p>
              <p className="text-xs text-green-600 mt-0.5">{t('riderNearbyDistance', { metres: Math.round(riderApproachingMetres) })}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress timeline */}
      <div className="mt-3">
        <ProgressTimeline order={order} />
      </div>

      {/* Delivery address */}
      <div className="mt-3">
        <DeliveryAddressCard order={order} />
      </div>

      {/* Rider card with live map — appears when picked up */}
      <div className="mt-3">
        <RiderCard order={order} riderCoords={riderCoords} />
      </div>

      {/* Chat with rider — visible on active statuses with a rider assigned */}
      {CHAT_ACTIVE_STATUSES.has(order.status) && order.riderId && user && (
        <ChatSection orderId={id!} currentUserId={user._id} />
      )}

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

      {/* Delivery instructions */}
      {order.deliveryInstructions && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 rounded-2xl bg-indigo-50 border border-indigo-100 p-3 flex items-start gap-2"
        >
          <Navigation size={14} className="text-indigo-500 mt-0.5 shrink-0" />
          <p className="text-xs text-indigo-700">{order.deliveryInstructions}</p>
        </motion.div>
      )}

      {/* Order summary */}
      <div className="mt-3">
        <OrderSummaryCard order={order} />
      </div>

      {/* Cancel order CTA — PENDING only */}
      <AnimatePresence>
        {isCancellable && (
          <motion.div
            key="cancel-cta"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.3 }}
            className="mt-4"
          >
            <button
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="w-full py-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 font-semibold cursor-pointer hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ touchAction: 'manipulation', minHeight: '56px' }}
            >
              <XCircle size={18} />
              {cancelling ? t('cancelling') : t('cancelOrder')}
            </button>
          </motion.div>
        )}
        {isConfirmedLocked && (
          <motion.div
            key="confirmed-locked"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.3 }}
            className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 text-center"
          >
            <p className="text-sm text-gray-500">
              {t('cancellableLocked')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
              {t('rateOrder')}
            </button>
          )}
          {!reviewDone && (
            <button
              onClick={() => setRefundSheetOpen(true)}
              className="w-full py-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 font-semibold cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
              style={{ touchAction: 'manipulation', minHeight: '56px' }}
            >
              {t('requestRefund')}
            </button>
          )}
          <button
            onClick={() => void navigate('/')}
            className="w-full py-4 rounded-2xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
            style={{ touchAction: 'manipulation', minHeight: '56px' }}
          >
            {t('orderAgain')}
          </button>
        </motion.div>
      )}

      {/* Refund sheet */}
      <AnimatePresence>
        {refundSheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="refund-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setRefundSheetOpen(false)}
            />
            {/* Panel */}
            <motion.div
              key="refund-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 shadow-xl max-w-2xl mx-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-lg text-gray-900">{t('refundTitle')}</h2>
                <button
                  onClick={() => setRefundSheetOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
                  aria-label={t('common:close')}
                >
                  <XCircle size={16} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                {t('refundSub')}
              </p>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={t('refundPlaceholder')}
                rows={4}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/30 resize-none transition"
              />
              <button
                onClick={() => void handleRefund()}
                disabled={refunding || !refundReason.trim()}
                className="mt-4 w-full py-4 rounded-2xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ touchAction: 'manipulation', minHeight: '56px' }}
              >
                {refunding ? t('submitting') : t('submitRefund')}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
