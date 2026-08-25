import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, CheckCircle2, Package, Bike, Phone, Zap, AlertTriangle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useQuery } from '@tanstack/react-query'
import { ordersApi, ridersApi, chatApi } from '@grandxl/api-client'
import type { ChatMessage, CustomerContact } from '@grandxl/api-client'
import { OrderStatus } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useRiderStore } from '../store/rider.store'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from '../router/routes'
import { socket } from '../lib/socket'

// Fix Leaflet default icon paths broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const riderIcon = new L.DivIcon({
  html: `<div style="background:#22c55e;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #22c55e44;"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const destinationIcon = new L.DivIcon({
  html: `<div style="background:#E84B3A;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #E84B3A44;"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length < 2) return
    map.fitBounds(points.map(([lat, lng]) => [lat, lng] as [number, number]), { padding: [40, 40] })
  }, [map, points])
  return null
}

const STEPS = [
  { key: 'heading',    labelKey: 'step_head',       Icon: Bike,          activeFor: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] },
  { key: 'pickup',     labelKey: 'step_pickup',     Icon: Package,       activeFor: [OrderStatus.READY] },
  { key: 'delivering', labelKey: 'step_delivering', Icon: Navigation,    activeFor: [OrderStatus.PICKED_UP] },
  { key: 'done',       labelKey: 'step_done',       Icon: CheckCircle2,  activeFor: [OrderStatus.DELIVERED] },
]

function StepTracker({ status }: { status: OrderStatus }) {
  const { t } = useTranslation('rider')
  const currentIdx =
    [OrderStatus.CONFIRMED, OrderStatus.PREPARING].includes(status as OrderStatus) ? 0
    : status === OrderStatus.READY     ? 1
    : status === OrderStatus.PICKED_UP ? 2
    : status === OrderStatus.DELIVERED ? 3
    : 0

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isDone   = i < currentIdx
        const isActive = i === currentIdx
        const Icon     = step.Icon
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isDone    ? 'bg-green-500 shadow-md shadow-green-500/20'
                  : isActive ? 'bg-primary shadow-md shadow-primary/30'
                  : 'bg-zinc-800 border border-zinc-700'
                }`}
                animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Icon size={15} className={isDone || isActive ? 'text-white' : 'text-zinc-600'} />
              </motion.div>
              <p className={`text-[9px] font-medium text-center leading-tight max-w-[52px] whitespace-pre-line ${
                isActive ? 'text-primary' : isDone ? 'text-green-400' : 'text-zinc-700'
              }`}>
                {t(step.labelKey)}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mb-4 mx-1">
                <motion.div
                  className={`h-full rounded-full ${isDone ? 'bg-green-500' : 'bg-zinc-800'}`}
                  initial={{ width: '0%' }}
                  animate={{ width: isDone ? '100%' : '0%' }}
                  transition={{ duration: 0.5 }}
                />
                {!isDone && <div className="h-full w-full bg-zinc-800 rounded-full" />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ChatSection({ orderId, currentUserId, onFullChat }: { orderId: string; currentUserId: string; onFullChat: () => void }) {
  const { t } = useTranslation('rider')
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

  // Mark read immediately when panel opens
  useEffect(() => {
    if (unreadCount > 0) {
      socket.emit('chat:read', { orderId })
      chatApi.markRead(orderId).catch(() => undefined)
      setUnreadCount(0)
    }
  }, [unreadCount, orderId])

  const joinRoom = useCallback(() => {
    socket.emit('order:join_room', { orderId })
  }, [orderId])

  useEffect(() => {
    joinRoom()
    socket.on('connect', joinRoom)

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
      socket.off('connect', joinRoom)
      socket.off('chat:message', onMessage)
      socket.off('chat:peer_typing', onPeerTyping)
      socket.off('chat:messages_read', onMessagesRead)
      socket.emit('order:leave_room', { orderId })
    }
  }, [orderId, joinRoom, currentUserId])

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

  function send() {
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
      senderRole: 'rider', text: trimmed,
      isRead: false, readAt: null, deletedAt: null,
      createdAt: new Date().toISOString(), status: 'sending',
    }
    setMessages((prev) => [...prev, optimistic])
    setText('')

    socket.emit('chat:send', { orderId, text: trimmed, tempId }, (ack) => {
      if (!ack?.ok) {
        setMessages((prev) =>
          prev.map((m) => m._id === tempId ? { ...m, status: 'failed' } : m),
        )
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="rounded-3xl border border-zinc-800 bg-zinc-900 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-zinc-200">{t('chat_title')}</p>
          {unreadCount > 0 && (
            <span className="h-5 min-w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={onFullChat}
          className="text-xs text-primary font-semibold cursor-pointer hover:opacity-80 transition-opacity"
          style={{ touchAction: 'manipulation' }}
        >
          {t('full_chat')} →
        </button>
      </div>
      <div className="h-52 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.length === 0 && !peerTyping && (
          <p className="text-xs text-zinc-600 text-center mt-8">{t('no_messages')}</p>
        )}
        {messages.map((m) => {
          const isMe = m.senderId === currentUserId
          const isFailed = m.status === 'failed'
          return (
            <div key={m._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  isMe
                    ? isFailed ? 'bg-red-900/60 text-red-300 rounded-br-sm' : 'bg-primary text-white rounded-br-sm'
                    : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
                } ${m.status === 'sending' ? 'opacity-60' : ''}`}
              >
                {m.deletedAt ? <span className="italic opacity-60">{t('chat_message_removed')}</span> : m.text}
              </div>
              {isMe && m.readAt && (
                <span className="text-[10px] text-primary/70 mt-0.5 mr-1">{t('chat_read')}</span>
              )}
              {isFailed && (
                <button
                  onClick={() => {
                    setMessages((prev) => prev.filter((x) => x._id !== m._id))
                    setText(m.text)
                  }}
                  className="text-[11px] text-red-400 font-semibold mt-0.5 cursor-pointer"
                >
                  {t('chat_failed_retry')}
                </button>
              )}
            </div>
          )
        })}
        {peerTyping && (
          <div className="flex items-center gap-2">
            <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1 items-center">
              {[0, 0.15, 0.3].map((d, i) => (
                <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-zinc-500"
                  animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d }} />
              ))}
            </div>
            <span className="text-xs text-zinc-600">{t('chat_customer_typing')}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 py-3 border-t border-zinc-800 flex gap-2">
        <input
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={t('message_placeholder')}
          maxLength={500}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-40 cursor-pointer"
          style={{ minHeight: '44px', touchAction: 'manipulation' }}
        >
          {t('send')}
        </button>
      </div>
    </motion.div>
  )
}

export default function ActiveDeliveryPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('rider')
  const { activeOrder, setActiveOrder } = useRiderStore()
  const { user } = useAuthStore()
  const [acting, setActing] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [riderPos, setRiderPos] = useState<[number, number] | null>(null)
  const [customerContact, setCustomerContact] = useState<CustomerContact | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const order = activeOrder?._id === orderId ? activeOrder : null

  // Bootstrap: restore activeOrder from server on hard-refresh (Zustand resets on page load)
  useEffect(() => {
    if (order) return
    ridersApi.getActiveJob()
      .then((res) => { if (res.data.data) setActiveOrder(res.data.data) })
      .catch(() => undefined)
  }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch customer contact so the call button works
  useEffect(() => {
    if (!order) return
    ordersApi.getCustomerContact(order._id)
      .then((res) => setCustomerContact(res.data.data))
      .catch(() => undefined)
  }, [order?._id])

  const isPendingPickup = order
    ? [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(order.status as OrderStatus)
    : false
  // Rider can confirm pickup from any pre-pickup status — restaurant acknowledgement
  // is optional since many restaurants don't actively manage their portal.
  const isReadyForPickup = order
    ? [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(order.status as OrderStatus)
    : false
  const isPickedUp = order?.status === OrderStatus.PICKED_UP

  // Phase-aware destination: restaurant first, then delivery address
  const destination = isPendingPickup && order?.restaurantPickupAddress
    ? {
        lat: order.restaurantPickupAddress.coordinates.coordinates[1],
        lng: order.restaurantPickupAddress.coordinates.coordinates[0],
        label: `${order.restaurantPickupAddress.street}, ${order.restaurantPickupAddress.city}`,
      }
    : order
    ? {
        lat: order.deliveryAddress.coordinates.coordinates[1],
        lng: order.deliveryAddress.coordinates.coordinates[0],
        label: `${order.deliveryAddress.street}, ${order.deliveryAddress.city}`,
      }
    : null

  // Poll order status every 10s so rider sees READY / PICKED_UP transitions without manual refresh
  useEffect(() => {
    if (!order) return
    const id = setInterval(async () => {
      try {
        const res = await ridersApi.getActiveJob()
        const updated = res.data.data
        if (updated) setActiveOrder(updated)
        else {
          // Order was cancelled or cleared
          setActiveOrder(null)
          void navigate(ROUTES.HOME, { replace: true })
        }
      } catch { /* network hiccup — keep showing current state */ }
    }, 10_000)
    return () => clearInterval(id)
  }, [order?._id, setActiveOrder, navigate])

  // Watch rider's GPS position — update local map dot, broadcast to order room, persist to DB
  useEffect(() => {
    if (!navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const bearing = pos.coords.heading ?? 0
        setRiderPos([lat, lng])
        socket.emit('rider:location_update', { lat, lng, bearing, orderId })
        void ridersApi.updateLocation({ lat, lng, bearing })
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [orderId])

  // Keep screen awake during active delivery so watchPosition is not paused by the OS
  useEffect(() => {
    if (!order) return
    type WakeLockSentinel = { release(): void }
    type NavWithWakeLock = Navigator & { wakeLock?: { request(type: string): Promise<WakeLockSentinel> } }
    const nav = navigator as NavWithWakeLock
    if (!nav.wakeLock) return

    let sentinel: WakeLockSentinel | null = null

    const acquire = () => {
      nav.wakeLock!.request('screen')
        .then((s) => { sentinel = s })
        .catch(() => undefined)
    }

    acquire()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sentinel?.release()
    }
  }, [order?._id])

  if (!order) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-zinc-700 border-t-primary animate-spin" />
          <p className="text-sm text-zinc-500">{t('loading_order')}</p>
        </motion.div>
      </div>
    )
  }

  const earnings = order.pricing.deliveryFee + (order.pricing.tip ?? 0)

  function openNavigation() {
    if (!destination) return
    const { lat, lng } = destination
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  async function markPickedUp() {
    if (acting) return
    setActing(true)
    try {
      const res = await ordersApi.updateStatus(order!._id, { status: OrderStatus.PICKED_UP })
      setActiveOrder(res.data.data)
      toast.success(t('picked_up_success'))
    } catch {
      toast.error(t('update_error'))
    } finally {
      setActing(false)
    }
  }

  async function markDelivered() {
    if (acting) return
    setActing(true)
    try {
      await ordersApi.updateStatus(order!._id, { status: OrderStatus.DELIVERED })
      setActiveOrder(null)
      toast.success(t('delivered_success'))
      void navigate(ROUTES.HOME, { replace: true })
    } catch {
      toast.error(t('update_error'))
    } finally {
      setActing(false)
    }
  }

  const mapPoints = useMemo<[number, number][]>(() => [
    ...(riderPos ? [riderPos] : []),
    ...(destination ? [[destination.lat, destination.lng] as [number, number]] : []),
  ], [riderPos, destination])
  const mapCenter: [number, number] = destination
    ? [destination.lat, destination.lng]
    : [9.0765, 7.3986] // Nigeria fallback

  return (
    <div className="min-h-full pb-6">
      {/* Real Leaflet map */}
      <div className="relative h-52 overflow-hidden border-b border-zinc-800">
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© OpenStreetMap'
          />
          {riderPos && (
            <Marker position={riderPos} icon={riderIcon}>
              <Popup>{t('you_are_here')}</Popup>
            </Marker>
          )}
          {destination && (
            <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
              <Popup>{destination.label}</Popup>
            </Marker>
          )}
          {mapPoints.length === 2 && <FitBounds points={mapPoints} />}
        </MapContainer>

        {/* Navigate button overlay */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={openNavigation}
          className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2 rounded-2xl bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 px-3.5 py-2.5 text-xs font-semibold text-zinc-200 cursor-pointer hover:bg-zinc-800 transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <Navigation size={13} className="text-primary" />
          {t('navigate')}
        </motion.button>

        {/* SOS button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setSosOpen(true)}
          className="absolute bottom-3 left-3 z-[1000] flex items-center gap-1.5 rounded-2xl bg-red-600/90 backdrop-blur-sm border border-red-500/40 px-3 py-2.5 text-xs font-bold text-white cursor-pointer hover:bg-red-600 transition-colors shadow-lg shadow-red-900/40"
          style={{ touchAction: 'manipulation' }}
          aria-label={t('emergency_sos_label')}
        >
          <AlertTriangle size={13} />
          {t('sos')}
        </motion.button>

        {/* Phase badge */}
        <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 rounded-full bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 px-2.5 py-1.5">
          <motion.div
            className={`h-1.5 w-1.5 rounded-full ${isPendingPickup ? 'bg-green-400' : 'bg-primary'}`}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className={`text-[10px] font-semibold ${isPendingPickup ? 'text-green-400' : 'text-primary'}`}>
            {isPendingPickup ? t('head_to_restaurant') : t('active_delivery_banner')}
          </span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Step tracker */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
        >
          <StepTracker status={order.status as OrderStatus} />
        </motion.div>

        {/* Earnings + order header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`flex items-center gap-3 rounded-3xl p-4 ${
            isPendingPickup
              ? 'bg-green-500/8 border border-green-500/20'
              : 'bg-primary/8 border border-primary/20'
          }`}
        >
          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
            isPendingPickup ? 'bg-green-500/20' : 'bg-primary/20'
          }`}>
            {isPendingPickup
              ? <Package size={20} className="text-green-400" />
              : <Bike size={20} className="text-primary" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${isPendingPickup ? 'text-green-400' : 'text-primary'}`}>
              {isPendingPickup ? t('head_to_restaurant') : t('step_delivering')}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{order.orderNumber}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <Zap size={11} className="text-primary" />
              <p className="text-[10px] text-zinc-500">{t('earning_label')}</p>
            </div>
            <p className="font-display font-bold text-zinc-100">{formatMoney(earnings, order.currency)}</p>
          </div>
        </motion.div>

        {/* Route card — two-phase */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 space-y-3"
        >
          {/* Phase 1: restaurant pickup */}
          <AnimatePresence>
            {isPendingPickup && order.restaurantPickupAddress && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                    <MapPin size={13} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-0.5">{t('pick_up_from')}</p>
                    {order.restaurantName && (
                      <p className="text-sm font-bold text-zinc-200">{order.restaurantName}</p>
                    )}
                    <p className="text-sm text-zinc-400">{order.restaurantPickupAddress.street}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{order.restaurantPickupAddress.city}, {order.restaurantPickupAddress.state}</p>
                    <p className="text-xs text-zinc-600 mt-1">{t('show_order_number')}</p>
                  </div>
                  <button
                    onClick={openNavigation}
                    className="h-8 w-8 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0 cursor-pointer hover:bg-green-500/25 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                    aria-label={t('navigate_to_restaurant_label')}
                  >
                    <Navigation size={14} className="text-green-400" />
                  </button>
                </div>
                <div className="ml-[13px] w-px h-4 bg-zinc-800 mt-2" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delivery address */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <MapPin size={13} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-0.5">{t('deliver_to')}</p>
              <p className="text-sm text-zinc-200 font-medium">{order.deliveryAddress.street}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{order.deliveryAddress.city}, {order.deliveryAddress.state}</p>
            </div>
            {isPickedUp && (
              <button
                onClick={openNavigation}
                className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary/25 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label={t('navigate_to_customer_label')}
              >
                <Navigation size={14} className="text-primary" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Order items — shown while heading to restaurant so rider knows what to collect */}
        <AnimatePresence>
          {isPendingPickup && order.items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.11 }}
              className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600 mb-3">
                {t('item_count', { count: order.items.length })} · {t('show_order_number')}
              </p>
              <div className="space-y-2.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-400">
                      {item.quantity}×
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 leading-snug">{item.name}</p>
                      {item.selectedVariants.length > 0 && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {item.selectedVariants.map((v) => `${v.variantName}: ${v.optionName}`).join(' · ')}
                        </p>
                      )}
                      {item.selectedAddOns.length > 0 && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          + {item.selectedAddOns.map((a) => a.name).join(', ')}
                        </p>
                      )}
                      {item.note && (
                        <p className="text-xs text-amber-400 mt-0.5 italic">"{item.note}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tip breakdown */}
        <AnimatePresence>
          {(order.pricing.tip ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm space-y-2"
            >
              <div className="flex justify-between text-zinc-500">
                <span>{t('delivery_fee_label')}</span>
                <span className="text-zinc-300">{formatMoney(order.pricing.deliveryFee, order.currency)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>{t('tip_label')}</span>
                <span className="text-green-400 font-semibold">+{formatMoney(order.pricing.tip ?? 0, order.currency)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Customer contact */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5"
        >
          <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-zinc-400">
              {customerContact?.firstName?.[0]?.toUpperCase() ?? 'C'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500 mb-0.5">{t('customer_label')}</p>
            <p className="text-sm font-semibold text-zinc-200">
              {customerContact ? `${customerContact.firstName} ${customerContact.lastName}` : t('contact_on_arrival')}
            </p>
          </div>
          <a
            href={customerContact?.phone ? `tel:${customerContact.phone}` : undefined}
            onClick={!customerContact?.phone ? (e) => e.preventDefault() : undefined}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              customerContact?.phone
                ? 'bg-primary/15 text-primary cursor-pointer hover:bg-primary/25'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
            aria-label={t('call_customer_label')}
          >
            <Phone size={16} />
          </a>
        </motion.div>

        {/* In-app chat */}
        {user && (
          <ChatSection
            orderId={order._id}
            currentUserId={user._id}
            onFullChat={() => void navigate(ROUTES.CHAT.replace(':orderId', order._id))}
          />
        )}

        {/* Main CTA */}
        {/* SOS Modal */}
        <AnimatePresence>
          {sosOpen && (
            <motion.div
              key="sos-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm px-4 pb-8"
              onClick={() => setSosOpen(false)}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-red-500/30 overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-red-600/10 border-b border-red-500/20">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-2xl bg-red-600/20 flex items-center justify-center">
                      <AlertTriangle size={18} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-400">{t('emergency_title')}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{t('emergency_subtitle')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSosOpen(false)}
                    className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors"
                    aria-label={t('close_label')}
                  >
                    <X size={14} className="text-zinc-400" />
                  </button>
                </div>

                {/* Emergency options */}
                <div className="p-4 space-y-3">
                  {[
                    { label: t('police_name'), number: '199', desc: t('police_desc'), color: 'blue' },
                    { label: t('ambulance_name'), number: '767', desc: t('ambulance_desc'), color: 'green' },
                    { label: t('general_emergency_name'), number: '112', desc: t('general_emergency_desc'), color: 'red' },
                  ].map(({ label, number, desc, color }) => (
                    <a
                      key={number}
                      href={`tel:${number}`}
                      className={`flex items-center gap-3 rounded-2xl p-3.5 border cursor-pointer transition-colors ${
                        color === 'blue' ? 'bg-blue-500/8 border-blue-500/20 hover:bg-blue-500/15'
                        : color === 'green' ? 'bg-green-500/8 border-green-500/20 hover:bg-green-500/15'
                        : 'bg-red-500/8 border-red-500/20 hover:bg-red-500/15'
                      }`}
                      style={{ touchAction: 'manipulation', minHeight: '56px' }}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        color === 'blue' ? 'bg-blue-500/20' : color === 'green' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        <Phone size={16} className={
                          color === 'blue' ? 'text-blue-400' : color === 'green' ? 'text-green-400' : 'text-red-400'
                        } />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-200">{label}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                      </div>
                      <span className={`text-lg font-bold font-mono ${
                        color === 'blue' ? 'text-blue-400' : color === 'green' ? 'text-green-400' : 'text-red-400'
                      }`}>{number}</span>
                    </a>
                  ))}

                  <p className="text-center text-[10px] text-zinc-600 pt-1">
                    {t('dialler_hint')}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {isReadyForPickup && (
            <motion.button
              key="pickup-btn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => void markPickedUp()}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-green-500 py-4 text-sm font-bold text-zinc-900 shadow-lg shadow-green-500/20 transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
              style={{ minHeight: '56px', touchAction: 'manipulation' }}
            >
              {acting
                ? <span className="h-4 w-4 rounded-full border-2 border-zinc-900/40 border-t-zinc-900 animate-spin" />
                : <Package size={18} />
              }
              {acting ? t('updating') : t('confirm_pickup')}
            </motion.button>
          )}

          {isPickedUp && (
            <motion.button
              key="deliver-btn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => void markDelivered()}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
              style={{ minHeight: '56px', touchAction: 'manipulation' }}
            >
              {acting
                ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                : <CheckCircle2 size={18} />
              }
              {acting ? t('marking_delivered') : t('confirm_delivery')}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
