'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { adminOrdersApi, analyticsApi, type ReassignCandidate } from '@grandxl/api-client'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, RefreshCw, Loader2, User, Bike, Car } from 'lucide-react'
import { useAuthStore } from '../../../src/store/auth.store'
import { socket } from '../../../src/lib/socket'
import '../../../src/lib/axios'

// ── Leaflet dynamic import (no SSR — Leaflet reads window at import time) ────────
import type { RiderPin, HeatPoint } from '../../../src/components/dispatch/DispatchMap'
const DispatchMap = dynamic(() => import('../../../src/components/dispatch/DispatchMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-gray-100 rounded-xl">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
        <p className="text-sm text-gray-500">Loading map…</p>
      </div>
    </div>
  ),
})

// ── Active-order statuses ─────────────────────────────────────────────────────────

const DISPATCH_STATUSES = new Set<OrderStatus>([
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
])

const STATUS_COLOR: Record<string, string> = {
  [OrderStatus.CONFIRMED]:  'bg-blue-100 text-blue-700',
  [OrderStatus.PREPARING]:  'bg-orange-100 text-orange-700',
  [OrderStatus.READY]:      'bg-green-100 text-green-700',
  [OrderStatus.PICKED_UP]:  'bg-indigo-100 text-indigo-700',
}

// ── Sidebar order row ─────────────────────────────────────────────────────────────

function OrderRow({ order, selected, onClick }: { order: Order; selected: boolean; onClick: () => void }) {
  const color = STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer ${selected ? 'bg-orange-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono text-xs font-semibold text-gray-900 truncate">{order.orderNumber}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>
      <p className="text-xs text-gray-500 truncate">{order.deliveryAddress.street}, {order.deliveryAddress.city}</p>
      <p className="text-xs font-medium text-gray-700 mt-0.5">{formatMoney(order.pricing.total, order.currency)}</p>
    </button>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  // Sprint 13 (S13-4): reassign-modal state — order id we're operating on
  const [reassignFor, setReassignFor] = useState<Order | null>(null)

  // Rider positions keyed by riderId
  const riderPins = useRef<Map<string, RiderPin>>(new Map())
  const [pins, setPins] = useState<RiderPin[]>([])

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, isInitializing, user, router])

  // Fetch active orders — poll every 30s
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['admin', 'dispatch-orders'],
    queryFn: () => adminOrdersApi.list({ limit: 100 }),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  })

  // Heatmap — only fetched when the toggle is on
  const { data: heatmapRes, isLoading: heatLoading } = useQuery({
    queryKey: ['analytics', 'heatmap', 30],
    queryFn: () => analyticsApi.getHeatmap(30).then((r) => r.data),
    staleTime: 10 * 60_000,
    enabled: isAuthenticated && showHeatmap,
  })
  const heatPoints: HeatPoint[] = heatmapRes?.data?.points ?? []

  const allOrders: Order[] = ordersData?.data?.data?.data ?? []
  const activeOrders = allOrders.filter((o) => DISPATCH_STATUSES.has(o.status))

  // Sprint 13 (S13-1): incremental room join/leave. Previous version emitted
  // leave+rejoin for the ENTIRE active-order set on any single-order change —
  // 20 orders × 2 emits per churn was hammering the socket layer. Now we track
  // joined rooms in a ref and emit only the delta each time the ID set shifts.
  const joinedRoomsRef = useRef<Set<string>>(new Set())
  const activeIdsKey = activeOrders.map((o) => o._id).sort().join(',')
  useEffect(() => {
    const currentIds = new Set(activeOrders.map((o) => o._id))

    // Rooms in `currentIds` but not yet joined → emit join
    for (const id of currentIds) {
      if (!joinedRoomsRef.current.has(id)) {
        socket.emit('order:join_room', { orderId: id })
        joinedRoomsRef.current.add(id)
      }
    }
    // Rooms previously joined but no longer active → emit leave
    for (const id of joinedRoomsRef.current) {
      if (!currentIds.has(id)) {
        socket.emit('order:leave_room', { orderId: id })
        joinedRoomsRef.current.delete(id)
      }
    }
    // Re-run only when the active-ID set actually changes (sorted string dep).
    // No cleanup — leaves on unmount are handled by the mount-only effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdsKey])

  // Sprint 13 (S13-1): on route-away, leave every room we ever joined so the
  // server isn't holding orphaned subscriptions for this socket. Runs only on
  // unmount because the dep array is empty.
  useEffect(() => {
    const rooms = joinedRoomsRef.current
    return () => {
      for (const id of rooms) {
        socket.emit('order:leave_room', { orderId: id })
      }
      rooms.clear()
    }
  }, [])

  // Sprint 13 (S13-1): register the rider-location listener ONCE. Previous
  // version re-registered on every change to activeOrders/riderId — cheap in
  // isolation, but combined with the room-join explosion it churned the socket
  // continuously. The handler now reads latest activeOrders through a ref so
  // it never needs to re-close over the array.
  const activeOrdersRef = useRef<Order[]>(activeOrders)
  useEffect(() => { activeOrdersRef.current = activeOrders }, [activeOrders])
  useEffect(() => {
    function onRiderLocation(data: { riderId: string; lat: number; lng: number; bearing: number }) {
      // Map riderId → orderId for the pin (find matching active order — read
      // from ref so we always see the latest set without re-registering).
      const order = activeOrdersRef.current.find((o) => o.riderId === data.riderId)
      if (!order) return

      riderPins.current.set(data.riderId, {
        riderId:  data.riderId,
        orderId:  order._id,
        lat:      data.lat,
        lng:      data.lng,
        bearing:  data.bearing,
        updatedAt: Date.now(),
      })
      setPins(Array.from(riderPins.current.values()))
    }

    socket.on('rider:location', onRiderLocation)
    return () => { socket.off('rider:location', onRiderLocation) }
  }, [])

  if (isInitializing) return null

  const selectedOrder = selectedOrderId
    ? activeOrders.find((o) => o._id === selectedOrderId) ?? null
    : null

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Sidebar: active order list ── */}
      <aside className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Live Dispatch</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isLoading ? 'Loading…' : `${activeOrders.length} active order${activeOrders.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHeatmap((v) => !v)}
              title="Toggle order heatmap (last 30 days)"
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                showHeatmap
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {heatLoading ? '…' : 'Heatmap'}
            </button>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-3 border-b border-gray-100 animate-pulse">
                  <div className="h-3.5 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10 text-gray-300 mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-500">No active orders</p>
              <p className="text-xs text-gray-400 mt-1">New orders will appear here</p>
            </div>
          ) : (
            activeOrders.map((order) => (
              <OrderRow
                key={order._id}
                order={order}
                selected={selectedOrderId === order._id}
                onClick={() => setSelectedOrderId(order._id === selectedOrderId ? null : order._id)}
              />
            ))
          )}
        </div>

        {/* Live rider count badge */}
        {pins.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-2.5">
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-900">{pins.length}</span> rider{pins.length !== 1 ? 's' : ''} transmitting live
            </p>
          </div>
        )}
      </aside>

      {/* ── Map area ── */}
      <div className="flex-1 relative">
        <DispatchMap
          orders={activeOrders}
          riderPins={pins}
          selectedOrderId={selectedOrderId}
          onOrderSelect={setSelectedOrderId}
          heatPoints={showHeatmap ? heatPoints : []}
        />

        {/* Sprint 13 (S13-4): selected-order floating action card. Only shown
            when an order is picked — carries the reassign + close controls
            without needing a full detail panel redesign. */}
        <AnimatePresence>
          {selectedOrder && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{    opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="pointer-events-auto absolute bottom-4 right-4 z-[1000] w-80 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
            >
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-gray-900 truncate">{selectedOrder.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">
                    {selectedOrder.deliveryAddress.street}, {selectedOrder.deliveryAddress.city}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrderId(null)}
                  aria-label="Close"
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-2 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Rider {selectedOrder.riderId ? 'assigned' : 'unassigned'}
                </p>
                <button
                  onClick={() => setReassignFor(selectedOrder)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-orange-700 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  {selectedOrder.riderId ? 'Reassign rider' : 'Assign rider manually'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sprint 13 (S13-4): reassign modal */}
      <AnimatePresence>
        {reassignFor && (
          <ReassignRiderModal
            order={reassignFor}
            onClose={() => setReassignFor(null)}
            onSuccess={() => {
              setReassignFor(null)
              void queryClient.invalidateQueries({ queryKey: ['admin', 'dispatch-orders'] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sprint 13 (S13-4): rider-reassign modal ────────────────────────────────────

function ReassignRiderModal({ order, onClose, onSuccess }: {
  order: Order
  onClose: () => void
  onSuccess: () => void
}) {
  const [candidates, setCandidates] = useState<ReassignCandidate[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [pickedId, setPickedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setCandidates(null)
    setLoadError(null)
    adminOrdersApi.reassignCandidates(order._id)
      .then((res) => { if (!cancelled) setCandidates(res.data.data) })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setLoadError(typeof msg === 'string' ? msg : 'Could not load rider list')
      })
    return () => { cancelled = true }
  }, [order._id])

  const reassignMutation = useMutation({
    mutationFn: () => {
      if (!pickedId) throw new Error('Pick a rider first')
      return adminOrdersApi.reassignRider(order._id, pickedId, reason.trim() || undefined)
    },
    onSuccess: () => {
      toast.success('Rider reassigned')
      onSuccess()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(typeof msg === 'string' ? msg : 'Reassign failed')
    },
  })

  const vehicleIcon = (v: string) => v === 'car' ? Car : Bike

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        exit={{    opacity: 0, y: 10, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-extrabold text-gray-900">
            {order.riderId ? 'Reassign rider' : 'Assign rider'}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Order <span className="font-mono">{order.orderNumber}</span> · nearest available riders first
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
          ) : candidates === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <Loader2 size={16} className="animate-spin" /> Loading riders…
            </div>
          ) : candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No available riders in range. Try widening dispatch radius via admin settings.
            </p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => {
                const Icon = vehicleIcon(c.vehicleType)
                const picked = pickedId === c.riderId
                return (
                  <li key={c.riderId}>
                    <button
                      onClick={() => setPickedId(c.riderId)}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        picked
                          ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100'
                          : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`shrink-0 rounded-full p-2 ${picked ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                        <User size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                          <Icon size={11} />
                          <span className="capitalize">{c.vehicleType}</span>
                          {c.vehiclePlate && <span className="text-gray-300">·</span>}
                          {c.vehiclePlate && <span className="font-mono">{c.vehiclePlate}</span>}
                        </p>
                      </div>
                      {c.distanceKm != null && (
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-700 ring-1 ring-inset ring-gray-200 tabular-nums">
                          {c.distanceKm} km
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-4 space-y-3">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, audit-logged) — e.g. original rider unreachable"
            maxLength={300}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => reassignMutation.mutate()}
              disabled={!pickedId || reassignMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reassignMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Confirm reassign
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
