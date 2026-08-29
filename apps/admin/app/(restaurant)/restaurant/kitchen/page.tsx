'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { myRestaurantApi, ordersApi } from '@grandxl/api-client'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { socket } from '../../../../src/lib/socket'
import { printOrderTicket } from '../../../../src/lib/orderTicket'
import '../../../../src/lib/axios'

// KDM lives on top of the normal restaurant shell — z-50 fixed cover. When
// the operator exits (Esc / tap X), we route back to /restaurant/orders.
//
// Timing thresholds are in minutes of order age:
//   0-9   → green    (fresh)
//   10-19 → amber    (attention)
//   20+   → red      (urgent)
const AGE_AMBER_MIN = 10
const AGE_RED_MIN   = 20

// Column model. CONFIRMED + PREPARING collapse into "In Kitchen" so the chef
// sees one queue of "food being made" instead of two nearly-identical states.
// The advance button knows how to walk each order forward one step.
type Column = 'new' | 'kitchen' | 'ready'

function ageMinutes(dateStr: string | Date): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000)
}

function ageColor(minutes: number): string {
  if (minutes >= AGE_RED_MIN)   return 'text-red-400'
  if (minutes >= AGE_AMBER_MIN) return 'text-amber-400'
  return 'text-emerald-400'
}

function ageBorderColor(minutes: number): string {
  if (minutes >= AGE_RED_MIN)   return 'border-red-500/60'
  if (minutes >= AGE_AMBER_MIN) return 'border-amber-500/50'
  return 'border-emerald-500/40'
}

// One "tick" every 15s to re-render age timers without hammering React.
function useTick(intervalMs = 15_000): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return n
}

export default function KitchenDisplayPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  // ── Data ─────────────────────────────────────────────────────────────
  const { data: restaurantsData } = useQuery({
    queryKey: ['my-restaurants'],
    queryFn: () => myRestaurantApi.list(),
    enabled: isAuthenticated,
  })
  const restaurant = restaurantsData?.data?.data?.[0]
  const restaurantId = restaurant?._id

  // Reuse the same live-orders keying strategy as /restaurant/orders so both
  // views share a cache and stay in sync with a single fetch.
  const { data: liveData } = useQuery({
    queryKey: ['my-orders-live', restaurantId],
    queryFn: async () => {
      const [p, c, pr, r] = await Promise.all([
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.PENDING,   limit: 50 }),
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.CONFIRMED, limit: 50 }),
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.PREPARING, limit: 50 }),
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.READY,     limit: 50 }),
      ])
      return {
        pending:   (p.data?.data?.data ?? []) as Order[],
        confirmed: (c.data?.data?.data ?? []) as Order[],
        preparing: (pr.data?.data?.data ?? []) as Order[],
        ready:     (r.data?.data?.data ?? []) as Order[],
      }
    },
    enabled: !!restaurantId,
    refetchInterval: 10_000,
    retry: 3,
  })

  // Re-render on socket events without waiting for the 10s poll.
  useEffect(() => {
    if (!restaurantId) return
    const refresh = () => void qc.invalidateQueries({ queryKey: ['my-orders-live', restaurantId] })
    socket.on('order:new', refresh)
    socket.on('order:status_update', refresh)
    socket.on('order:rider_assigned', refresh)
    return () => {
      socket.off('order:new', refresh)
      socket.off('order:status_update', refresh)
      socket.off('order:rider_assigned', refresh)
    }
  }, [restaurantId, qc])

  // Age tick — every 15s the timers advance without waiting for a data refetch.
  useTick(15_000)

  // Esc closes the display (matches every other full-screen tablet UX).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') router.push('/restaurant/orders')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  // ── Mutations ────────────────────────────────────────────────────────
  const advanceMutation = useMutation({
    mutationFn: ({ orderId, next }: { orderId: string; next: OrderStatus }) =>
      ordersApi.updateStatus(orderId, { status: next }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-orders-live', restaurantId] })
    },
    onError: (e) => toast.error(parseApiError(e, 'Could not advance order')),
  })

  // ── Grouping ─────────────────────────────────────────────────────────
  const columns = useMemo(() => {
    const pending   = liveData?.pending   ?? []
    const confirmed = liveData?.confirmed ?? []
    const preparing = liveData?.preparing ?? []
    const ready     = liveData?.ready     ?? []
    return {
      new:     pending,
      kitchen: [...confirmed, ...preparing],
      ready,
    }
  }, [liveData])

  const totals = {
    new:     columns.new.length,
    kitchen: columns.kitchen.length,
    ready:   columns.ready.length,
  }
  const grandTotal = totals.new + totals.kitchen + totals.ready

  if (isInitializing) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100">
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-orange-500 grid place-items-center text-black font-black">K</div>
          <div>
            <p className="text-sm uppercase tracking-wider text-white/60">Kitchen Display</p>
            <p className="text-lg font-bold">{restaurant?.name ?? '—'}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <LiveClock />
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <Chip label="New"     count={totals.new}     tone="rose" />
            <Chip label="Kitchen" count={totals.kitchen} tone="amber" />
            <Chip label="Ready"   count={totals.ready}   tone="emerald" />
          </div>
          <button
            onClick={() => router.push('/restaurant/orders')}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/5"
            aria-label="Exit Kitchen Display"
          >
            Exit
          </button>
        </div>
      </header>

      {/* ── Board ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        <ColumnPane
          column="new"
          title="New"
          hint="Accept to start"
          orders={columns.new}
          tone="rose"
          restaurantName={restaurant?.name ?? 'Restaurant'}
          onAdvance={(orderId) =>
            advanceMutation.mutate({ orderId, next: OrderStatus.CONFIRMED })
          }
          advancing={advanceMutation.isPending}
        />
        <ColumnPane
          column="kitchen"
          title="In Kitchen"
          hint="Tap to move forward"
          orders={columns.kitchen}
          tone="amber"
          restaurantName={restaurant?.name ?? 'Restaurant'}
          onAdvance={(orderId) => {
            const order = columns.kitchen.find((o) => o._id === orderId)
            if (!order) return
            const next = order.status === OrderStatus.CONFIRMED ? OrderStatus.PREPARING : OrderStatus.READY
            advanceMutation.mutate({ orderId, next })
          }}
          advancing={advanceMutation.isPending}
        />
        <ColumnPane
          column="ready"
          title="Ready"
          hint="Waiting for rider"
          orders={columns.ready}
          tone="emerald"
          restaurantName={restaurant?.name ?? 'Restaurant'}
          onAdvance={() => {
            // Ready → PICKED_UP is a rider action, not a kitchen action.
            // No advance button rendered for this column.
          }}
          advancing={false}
        />
      </div>

      {/* Empty state fills the whole board when nothing is live. */}
      {grandTotal === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-6xl">🍳</p>
            <p className="mt-4 text-xl font-semibold text-white/70">All caught up</p>
            <p className="text-sm text-white/40">New orders will pop in as they land.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Column ──────────────────────────────────────────────────────────────
function ColumnPane({
  column,
  title,
  hint,
  orders,
  tone,
  restaurantName,
  onAdvance,
  advancing,
}: {
  column: Column
  title: string
  hint: string
  orders: Order[]
  tone: 'rose' | 'amber' | 'emerald'
  restaurantName: string
  onAdvance: (orderId: string) => void
  advancing: boolean
}) {
  const toneRing =
    tone === 'rose'    ? 'ring-rose-500/40' :
    tone === 'amber'   ? 'ring-amber-500/40' :
                         'ring-emerald-500/40'
  const toneBar =
    tone === 'rose'    ? 'bg-rose-500' :
    tone === 'amber'   ? 'bg-amber-500' :
                         'bg-emerald-500'

  return (
    <section
      className={`flex flex-col overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ${toneRing}`}
      aria-label={title}
    >
      <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${toneBar}`} />
          <h2 className="text-lg font-bold uppercase tracking-wider">{title}</h2>
          <span className="text-xs text-white/50">{hint}</span>
        </div>
        <span className="text-2xl font-black tabular-nums">{orders.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence initial={false}>
          {orders.map((order) => (
            <KdmCard
              key={order._id}
              order={order}
              column={column}
              restaurantName={restaurantName}
              onAdvance={() => onAdvance(order._id)}
              advancing={advancing}
            />
          ))}
        </AnimatePresence>
        {orders.length === 0 && (
          <p className="pt-8 text-center text-sm text-white/30">Nothing here.</p>
        )}
      </div>
    </section>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────
function KdmCard({
  order,
  column,
  restaurantName,
  onAdvance,
  advancing,
}: {
  order: Order
  column: Column
  restaurantName: string
  onAdvance: () => void
  advancing: boolean
}) {
  const minutes = ageMinutes(order.createdAt)
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)

  const cta =
    column === 'new'     ? 'Accept'         :
    column === 'kitchen' ? (order.status === OrderStatus.CONFIRMED ? 'Start Preparing' : 'Mark Ready') :
                           null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className={`rounded-xl border-l-4 bg-white/[0.05] p-3.5 shadow-lg ${ageBorderColor(minutes)}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-lg font-black tracking-tight">{order.orderNumber.split('-').pop()}</p>
          <p className="text-[11px] text-white/40">{order.orderNumber}</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-black tabular-nums ${ageColor(minutes)}`}>{minutes}m</p>
          <p className="text-[11px] uppercase tracking-wide text-white/40">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <ul className="mb-3 space-y-1">
        {order.items.slice(0, 6).map((item, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="w-6 shrink-0 font-bold text-white/70">{item.quantity}×</span>
            <span className="flex-1">
              <span className="font-medium">{item.name}</span>
              {item.selectedVariants.length > 0 && (
                <span className="text-white/50"> · {item.selectedVariants.map((v) => v.optionName).join(', ')}</span>
              )}
              {item.note && (
                <span className="block text-[11px] italic text-amber-300/90">✎ {item.note}</span>
              )}
            </span>
          </li>
        ))}
        {order.items.length > 6 && (
          <li className="text-xs text-white/40">+ {order.items.length - 6} more…</li>
        )}
      </ul>

      {order.customerNote && (
        <div className="mb-3 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
          {order.customerNote}
        </div>
      )}

      <div className="flex items-center gap-2">
        {cta && (
          <button
            onClick={onAdvance}
            disabled={advancing}
            className="flex-1 rounded-lg bg-emerald-500 px-3 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cta}
          </button>
        )}
        <button
          onClick={() => {
            const ok = printOrderTicket(order, restaurantName)
            if (!ok) toast.error('Popup blocked')
          }}
          className={`rounded-lg border border-white/15 px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5 ${cta ? '' : 'flex-1'}`}
          aria-label="Print"
        >
          Print
        </button>
      </div>
    </motion.div>
  )
}

// ─── Small helpers ───────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="text-right">
      <p className="text-lg font-bold tabular-nums">
        {now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-[11px] uppercase tracking-wider text-white/40">
        {now.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}
      </p>
    </div>
  )
}

function Chip({ label, count, tone }: { label: string; count: number; tone: 'rose' | 'amber' | 'emerald' }) {
  const cls =
    tone === 'rose'    ? 'bg-rose-500/15 text-rose-200 ring-rose-500/30' :
    tone === 'amber'   ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30' :
                         'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {label}
      <span className="tabular-nums">{count}</span>
    </span>
  )
}
