import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, ChevronRight, Clock, RefreshCw, Bike, ArrowUpDown } from 'lucide-react'
import { OrderStatus } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useOrdersList, useActiveOrders, type OrderTab } from '../features/orders/hooks/useOrders'

// ── Status display maps ────────────────────────────────────────────────────────

const STATUS_COLOR: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]:   'bg-yellow-100 text-yellow-700',
  [OrderStatus.CONFIRMED]: 'bg-blue-100 text-blue-700',
  [OrderStatus.PREPARING]: 'bg-orange-100 text-orange-700',
  [OrderStatus.READY]:     'bg-purple-100 text-purple-700',
  [OrderStatus.PICKED_UP]: 'bg-indigo-100 text-indigo-700',
  [OrderStatus.DELIVERED]: 'bg-green-100 text-green-700',
  [OrderStatus.CANCELLED]: 'bg-red-100 text-red-600',
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]:   'Waiting',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.PREPARING]: 'Preparing',
  [OrderStatus.READY]:     'Ready',
  [OrderStatus.PICKED_UP]: 'On the way',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
}

const TABS: { id: OrderTab; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'active',    label: 'Active' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatOrderDate(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return `Today · ${d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays === 1) return `Yesterday · ${d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined })
}

function itemSummary(order: Order): string {
  const names = order.items.map((i) => i.name)
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(' & ')
  return `${names[0]} +${names.length - 1} more`
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function OrderSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="h-14 w-14 bg-gray-200 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
    </div>
  )
}

// ── Active order card (gradient) ──────────────────────────────────────────────

function ActiveOrderCard({ order, index }: { order: Order; index: number }) {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <button
        onClick={() => void navigate(`/orders/${order._id}/tracking`)}
        className="w-full bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-4 text-left cursor-pointer hover:shadow-lg transition-shadow"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Bike size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm text-white truncate">{order.orderNumber}</p>
              <ChevronRight size={16} className="text-white/70 shrink-0" />
            </div>
            <p className="text-xs text-white/70 mt-0.5 truncate">{itemSummary(order)}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white/20 text-white">
                {STATUS_LABEL[order.status]}
              </span>
              {order.estimatedTime && order.status !== OrderStatus.PICKED_UP && (
                <span className="inline-flex items-center gap-1 text-[11px] text-white/70">
                  <Clock size={11} />
                  {order.estimatedTime} min
                </span>
              )}
              <span className="text-[11px] text-white/60 ml-auto">{formatMoney(order.pricing.total, order.currency)}</span>
            </div>
          </div>
        </div>
        <p className="mt-2.5 text-[11px] text-white/50 font-medium">Tap to track live</p>
      </button>
    </motion.div>
  )
}

// ── History order card ────────────────────────────────────────────────────────

function OrderCard({ order, index }: { order: Order; index: number }) {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.05, duration: 0.2 }}
    >
      <button
        onClick={() => void navigate(`/orders/${order._id}/tracking`)}
        className="w-full bg-white rounded-2xl shadow-sm p-4 text-left cursor-pointer hover:shadow-md transition-shadow"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="flex items-start gap-3">
          {/* Thumbnail — first item image or fallback */}
          <div className="h-14 w-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
            {order.items[0]?.image ? (
              <img
                src={order.items[0].image}
                alt={order.items[0].name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag size={22} className="text-gray-300" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{order.orderNumber}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{itemSummary(order)}</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 shrink-0 mt-0.5" />
            </div>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
              <span className="text-[11px] text-gray-400">{formatOrderDate(order.createdAt)}</span>
              <span className="text-[11px] font-medium text-gray-700 ml-auto">
                {formatMoney(order.pricing.total, order.currency)}
              </span>
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { t } = useTranslation('orders')
  const [tab, setTab] = useState<OrderTab>('all')
  const [page, setPage] = useState(1)
  const [sortNewest, setSortNewest] = useState(true)

  const {
    data: activeData,
    isLoading: activeLoading,
    refetch: refetchActive,
  } = useActiveOrders()

  const {
    data: listData,
    isLoading: listLoading,
    isError,
    refetch: refetchList,
  } = useOrdersList(tab, page)

  const activeOrders = activeData ?? []

  const rawOrders = listData?.data ?? []
  const total = listData?.meta?.total ?? rawOrders.length
  const hasMore = rawOrders.length < total

  // Client-side sort (backend returns newest-first by default)
  const orders = sortNewest ? rawOrders : [...rawOrders].reverse()

  const isLoading = tab === 'active' ? activeLoading : listLoading

  function handleRefresh() {
    void refetchActive()
    void refetchList()
  }

  function handleTabChange(next: OrderTab) {
    setTab(next)
    setPage(1)
  }

  function loadMore() {
    setPage((p) => p + 1)
  }

  // For the "active" tab, show the activeOrders (polled) instead of the list query
  const displayOrders = tab === 'active' ? activeOrders : orders
  const showActiveSection = tab === 'all' && activeOrders.length > 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-bold text-xl text-gray-900">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortNewest((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium cursor-pointer hover:bg-gray-200 transition-colors"
            title={sortNewest ? 'Newest first' : 'Oldest first'}
          >
            <ArrowUpDown size={12} />
            {sortNewest ? 'Newest' : 'Oldest'}
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Refresh orders"
          >
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Tab chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              tab === t.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            {t.label}
            {t.id === 'active' && activeOrders.length > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold ${tab === 'active' ? 'bg-white/20 text-white' : 'bg-primary text-white'}`}>
                {activeOrders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active orders banner — only on "All" tab */}
      {showActiveSection && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">In progress</p>
          <div className="space-y-3">
            {activeOrders.map((order, i) => (
              <ActiveOrderCard key={order._id} order={order} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Order list */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <OrderSkeleton key={i} />)}
          </motion.div>
        ) : isError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <RefreshCw size={36} className="text-red-300" />
            </div>
            <h2 className="font-semibold text-gray-900">{"Couldn't load orders"}</h2>
            <p className="mt-1 text-sm text-gray-500">Check your connection and try again</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl cursor-pointer"
            >
              Retry
            </button>
          </motion.div>
        ) : displayOrders.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <ShoppingBag size={36} className="text-gray-300" />
            </div>
            <h2 className="font-semibold text-gray-900">
              {tab === 'active' ? 'No active orders' : tab === 'cancelled' ? 'No cancelled orders' : t('empty')}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {tab === 'active' ? 'Your in-progress orders will appear here' : t('emptySubtitle')}
            </p>
          </motion.div>
        ) : (
          <motion.div key={`list-${tab}-${page}-${sortNewest}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Section header for "All" tab past orders */}
            {showActiveSection && orders.length > 0 && (
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Past orders</p>
            )}

            <div className="space-y-3">
              {tab === 'active'
                ? activeOrders.map((order, i) => <ActiveOrderCard key={order._id} order={order} index={i} />)
                : orders.map((order, i) => <OrderCard key={order._id} order={order} index={i} />)
              }
            </div>

            {/* Load more */}
            {hasMore && tab !== 'active' && (
              <button
                onClick={loadMore}
                className="mt-4 w-full py-3 text-sm font-medium text-primary border border-primary/30 rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors"
              >
                Load more orders
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
