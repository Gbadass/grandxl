'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAlertStore } from '../store/alert.store'
import { stopLoopAlarm } from '../lib/alertSound'
import { formatMoney } from '@grandxl/utils'
import type { Order } from '@grandxl/types'

function Card({ order, onDismiss }: { order: Order; onDismiss: () => void }) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss after 90s
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 90_000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [onDismiss])

  function handleView() {
    stopLoopAlarm()
    onDismiss()
    router.push(`/orders/${order._id}`)
  }

  function handleDismiss() {
    stopLoopAlarm()
    onDismiss()
  }

  return (
    <div className="pointer-events-auto w-80 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-2xl ring-1 ring-orange-100 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-white opacity-90 ring-2 ring-white/30 animate-ping absolute" />
          <span className="relative flex h-2 w-2 rounded-full bg-white" />
          <p className="ml-1 text-sm font-bold text-white">New Order!</p>
        </div>
        <button onClick={handleDismiss} className="rounded-md p-0.5 text-white/70 hover:bg-white/20 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-orange-600 tracking-wide uppercase">#{order.orderNumber}</p>
        <p className="mt-1 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
          {' '}· {formatMoney(order.pricing.total, order.currency)}
        </p>
        <ul className="mt-1.5 space-y-0.5">
          {order.items.slice(0, 3).map((item, i) => (
            <li key={i} className="truncate text-xs text-gray-500">
              {item.quantity}× {item.name}
            </li>
          ))}
          {order.items.length > 3 && (
            <li className="text-xs text-gray-400">+{order.items.length - 3} more</li>
          )}
        </ul>
      </div>

      {/* Action */}
      <div className="border-t border-gray-100 px-4 py-2.5">
        <button
          onClick={handleView}
          className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
        >
          View Order
        </button>
      </div>
    </div>
  )
}

export function OrderAlertCard() {
  const { pendingOrders, removeOrder } = useAlertStore()

  if (pendingOrders.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end">
      {pendingOrders.slice(0, 3).map((order) => (
        <Card key={order._id} order={order} onDismiss={() => removeOrder(order._id)} />
      ))}
      {pendingOrders.length > 3 && (
        <p className="pointer-events-auto rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
          +{pendingOrders.length - 3} more orders
        </p>
      )}
    </div>
  )
}
