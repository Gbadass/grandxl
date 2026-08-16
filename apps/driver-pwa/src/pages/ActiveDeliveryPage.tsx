import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, CheckCircle2, Package, Bike, Phone, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ordersApi, ridersApi } from '@grandxl/api-client'
import { OrderStatus } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useRiderStore } from '../store/rider.store'
import { ROUTES } from '../router/routes'

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
  { key: 'heading',    label: 'Head to\nrestaurant', Icon: Bike,          activeFor: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] },
  { key: 'pickup',     label: 'Pick up\norder',       Icon: Package,       activeFor: [OrderStatus.READY] },
  { key: 'delivering', label: 'Deliver to\ncustomer',  Icon: Navigation,   activeFor: [OrderStatus.PICKED_UP] },
  { key: 'done',       label: 'Delivered!',            Icon: CheckCircle2, activeFor: [OrderStatus.DELIVERED] },
]

function StepTracker({ status }: { status: OrderStatus }) {
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
                {step.label}
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

export default function ActiveDeliveryPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { activeOrder, setActiveOrder } = useRiderStore()
  const [acting, setActing] = useState(false)
  const [riderPos, setRiderPos] = useState<[number, number] | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const order = activeOrder?._id === orderId ? activeOrder : null

  const isPendingPickup = order
    ? [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(order.status as OrderStatus)
    : false
  const isReadyForPickup = order?.status === OrderStatus.READY
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

  // Watch rider's GPS position for the live map dot
  useEffect(() => {
    if (!navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setRiderPos([pos.coords.latitude, pos.coords.longitude]),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  if (!order) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-zinc-700 border-t-primary animate-spin" />
          <p className="text-sm text-zinc-500">Loading order…</p>
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
      toast.success('Picked up! Head to the customer now.')
    } catch {
      toast.error('Could not update. Try again.')
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
      toast.success('Delivered! Great job.')
      void navigate(ROUTES.HOME, { replace: true })
    } catch {
      toast.error('Could not update. Try again.')
    } finally {
      setActing(false)
    }
  }

  const mapPoints: [number, number][] = [
    ...(riderPos ? [riderPos] : []),
    ...(destination ? [[destination.lat, destination.lng] as [number, number]] : []),
  ]
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
              <Popup>You are here</Popup>
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
          Navigate
        </motion.button>

        {/* Phase badge */}
        <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 rounded-full bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 px-2.5 py-1.5">
          <motion.div
            className={`h-1.5 w-1.5 rounded-full ${isPendingPickup ? 'bg-green-400' : 'bg-primary'}`}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className={`text-[10px] font-semibold ${isPendingPickup ? 'text-green-400' : 'text-primary'}`}>
            {isPendingPickup ? 'Head to restaurant' : 'Active delivery'}
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
              {isPendingPickup ? 'Head to restaurant' : 'On the way to customer'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{order.orderNumber}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <Zap size={11} className="text-primary" />
              <p className="text-[10px] text-zinc-500">Earning</p>
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
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-0.5">Pick up from</p>
                    <p className="text-sm text-zinc-200 font-medium">{order.restaurantPickupAddress.street}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{order.restaurantPickupAddress.city}, {order.restaurantPickupAddress.state}</p>
                    <p className="text-xs text-zinc-600 mt-1">Show order number to staff on arrival</p>
                  </div>
                  <button
                    onClick={openNavigation}
                    className="h-8 w-8 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0 cursor-pointer hover:bg-green-500/25 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Navigate to restaurant"
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
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-0.5">Deliver to</p>
              <p className="text-sm text-zinc-200 font-medium">{order.deliveryAddress.street}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{order.deliveryAddress.city}, {order.deliveryAddress.state}</p>
            </div>
            {isPickedUp && (
              <button
                onClick={openNavigation}
                className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary/25 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="Navigate to customer"
              >
                <Navigation size={14} className="text-primary" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Tip breakdown */}
        <AnimatePresence>
          {(order.pricing.tip ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm space-y-2"
            >
              <div className="flex justify-between text-zinc-500">
                <span>Delivery fee</span>
                <span className="text-zinc-300">{formatMoney(order.pricing.deliveryFee, order.currency)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Tip</span>
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
            <span className="font-display font-bold text-zinc-400">C</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500 mb-0.5">Customer</p>
            <p className="text-sm font-semibold text-zinc-200">Contact on arrival</p>
          </div>
          <a
            href="tel:"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary cursor-pointer hover:bg-primary/25 transition-colors"
            aria-label="Call customer"
          >
            <Phone size={16} />
          </a>
        </motion.div>

        {/* Main CTA */}
        <AnimatePresence mode="wait">
          {isPendingPickup && !isReadyForPickup && (
            <motion.div
              key="waiting-btn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl border border-zinc-700 bg-zinc-900 py-4 text-sm text-zinc-500"
              style={{ minHeight: '56px' }}
            >
              <span className="h-4 w-4 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin shrink-0" />
              Waiting for restaurant to prepare order…
            </motion.div>
          )}

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
              {acting ? 'Updating…' : 'Confirm pickup'}
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
              {acting ? 'Marking delivered…' : 'Confirm delivery'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
