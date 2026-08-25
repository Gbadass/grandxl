'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { adminOrdersApi, analyticsApi } from '@grandxl/api-client'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
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
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)

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

  // Join all active order rooms to receive rider:location events
  useEffect(() => {
    if (!activeOrders.length) return
    activeOrders.forEach((o) => {
      socket.emit('order:join_room', { orderId: o._id })
    })
    return () => {
      activeOrders.forEach((o) => {
        socket.emit('order:leave_room', { orderId: o._id })
      })
    }
    // Re-run when order IDs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrders.map((o) => o._id).join(',')])

  // Listen for rider location events
  useEffect(() => {
    function onRiderLocation(data: { riderId: string; lat: number; lng: number; bearing: number }) {
      // Map riderId → orderId for the pin (find matching active order)
      const order = activeOrders.find((o) => o.riderId === data.riderId)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrders.map((o) => o._id + o.riderId).join(',')])

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
      </div>
    </div>
  )
}
