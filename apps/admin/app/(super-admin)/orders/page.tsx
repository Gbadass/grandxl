'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { adminOrdersApi, type AdminOrderRow } from '@grandxl/api-client'
import { OrderStatus, PaymentStatus, UserRole } from '@grandxl/types'
import { formatMoney, parseApiError } from '@grandxl/utils'
import { Search, X, Filter, Trash2, TriangleAlert, User as UserIcon, Store, Bike } from 'lucide-react'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { StatusBadge } from '../../../src/components/ui/StatusBadge'
import '../../../src/lib/axios'

const STATUS_TABS: { label: string; value: OrderStatus | undefined }[] = [
  { label: 'All',        value: undefined },
  { label: 'Pending',    value: OrderStatus.PENDING },
  { label: 'Confirmed',  value: OrderStatus.CONFIRMED },
  { label: 'Preparing',  value: OrderStatus.PREPARING },
  { label: 'Ready',      value: OrderStatus.READY },
  { label: 'Picked up',  value: OrderStatus.PICKED_UP },
  { label: 'Delivered',  value: OrderStatus.DELIVERED },
  { label: 'Cancelled',  value: OrderStatus.CANCELLED },
]

const PAYMENT_FILTERS: { label: string; value: PaymentStatus | undefined }[] = [
  { label: 'All payments', value: undefined },
  { label: 'Completed',    value: PaymentStatus.COMPLETED },
  { label: 'Pending',      value: PaymentStatus.PENDING },
  { label: 'Failed',       value: PaymentStatus.FAILED },
  { label: 'Refunded',     value: PaymentStatus.REFUNDED },
]

// Small debounce hook — coalesces search input keystrokes so we hit the API
// ~250ms after the user stops typing. Prevents a query per keystroke while
// still feeling live.
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

export default function SuperAdminOrdersPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()

  const [status, setStatus]                 = useState<OrderStatus   | undefined>(undefined)
  const [paymentStatus, setPaymentStatus]   = useState<PaymentStatus | undefined>(undefined)
  const [searchInput, setSearchInput]       = useState('')
  const [page, setPage]                     = useState(1)
  const [confirmClear, setConfirmClear]     = useState(false)
  const search = useDebounced(searchInput.trim(), 250)

  // Reset to page 1 whenever a filter or the search term changes — otherwise
  // paginating away then refining a filter can land us on page 4 of 0 results.
  useEffect(() => { setPage(1) }, [status, paymentStatus, search])

  const clearMutation = useMutation({
    mutationFn: () => adminOrdersApi.clearAll(),
    onSuccess: (res) => {
      const n = res.data?.data?.cleared ?? 0
      toast.success(`${n} order${n !== 1 ? 's' : ''} cleared from the system`)
      setConfirmClear(false)
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
    },
    onError: (e) => toast.error(parseApiError(e, 'Failed to clear orders')),
  })

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'orders', { status, paymentStatus, search, page }],
    queryFn:  () => adminOrdersApi.list({ status, paymentStatus, search: search || undefined, page, limit: 20 }),
    enabled:  isAuthenticated,
  })

  const rows: AdminOrderRow[] = (data?.data?.data?.data ?? []) as AdminOrderRow[]
  const total = data?.data?.data?.meta?.total ?? 0

  const columns: Column<AdminOrderRow>[] = useMemo(() => [
    {
      key:    'number',
      header: 'Order',
      render: (o) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-gray-900">{o.orderNumber}</span>
          <span className="text-[10px] text-gray-400">{fmtRelative(o.createdAt)}</span>
        </div>
      ),
    },
    {
      key:    'customer',
      header: 'Customer',
      render: (o) => (
        <div className="flex items-start gap-2">
          <UserIcon size={12} className="mt-1 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-col">
            <span className="block truncate text-xs font-medium text-gray-800">
              {o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : '—'}
            </span>
            <span className="block truncate text-[10px] text-gray-400 tabular-nums">
              {o.customer?.phone ?? ''}
            </span>
          </div>
        </div>
      ),
    },
    {
      key:    'restaurant',
      header: 'Restaurant',
      render: (o) => (
        <div className="flex items-center gap-2">
          <Store size={12} className="shrink-0 text-gray-400" />
          <span className="truncate text-xs font-medium text-gray-800">{o.restaurant?.name ?? '—'}</span>
        </div>
      ),
    },
    {
      key:    'status',
      header: 'Status',
      render: (o) => (
        <div className="flex flex-col items-start gap-0.5">
          <StatusBadge label={o.status} orderStatus={o.status} />
          {o.dispatchedWithoutRestaurantAck && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700">
              ⚡ rider drove this
            </span>
          )}
        </div>
      ),
    },
    {
      key:    'payment',
      header: 'Payment',
      render: (o) => (
        <div className="flex flex-col items-start gap-0.5">
          <StatusBadge label={o.payment.status} paymentStatus={o.payment.status} />
          <span className="text-[10px] uppercase tracking-wider text-gray-400">{o.payment.method}</span>
        </div>
      ),
    },
    {
      key:    'rider',
      header: 'Rider',
      render: (o) => (
        <div className="flex items-center gap-2">
          <Bike size={12} className="shrink-0 text-gray-400" />
          <span className="truncate text-xs font-medium text-gray-800">
            {o.rider
              ? `${o.rider.firstName} ${o.rider.lastName}`
              : o.status === OrderStatus.CANCELLED
                ? <span className="text-gray-400">—</span>
                : <span className="text-amber-600">Unassigned</span>}
          </span>
        </div>
      ),
    },
    {
      key:    'total',
      header: 'Total',
      render: (o) => (
        <span className="font-semibold tabular-nums text-gray-900">{formatMoney(o.pricing.total, o.currency)}</span>
      ),
    },
  ], [])

  if (isInitializing) return null

  return (
    <div>
      {/* Header + destructive control */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Orders" subtitle="Search, drill in, and take action on any order across the platform" />
        <button
          onClick={() => setConfirmClear(true)}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:border-red-300 cursor-pointer"
        >
          <Trash2 size={14} /> Clear all orders
        </button>
      </div>

      {/* Search + filters row */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search order #, customer name / phone, or restaurant…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="relative">
          <Filter size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={paymentStatus ?? ''}
            onChange={(e) => setPaymentStatus((e.target.value || undefined) as PaymentStatus | undefined)}
            className="rounded-xl border border-gray-200 bg-white py-2.5 pl-8 pr-8 text-sm font-medium text-gray-700 outline-none transition-colors focus:border-orange-400 focus:ring-2 focus:ring-orange-100 cursor-pointer"
          >
            {PAYMENT_FILTERS.map((f) => (
              <option key={f.label} value={f.value ?? ''}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status tabs — quick lateral movement between order states. */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value
          return (
            <button
              key={tab.label}
              onClick={() => setStatus(tab.value)}
              className={`relative border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {active && (
                <motion.span
                  layoutId="active-tab-underline"
                  className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-orange-600"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          )
        })}

        {/* Result count on the right of tabs — tiny status line for ops. */}
        <div className="ml-auto flex items-center py-2 text-xs tabular-nums text-gray-400">
          {isFetching && !isLoading ? 'Updating…' : `${total.toLocaleString()} order${total === 1 ? '' : 's'}`}
        </div>
      </div>

      <motion.div
        key={`${status ?? 'all'}-${paymentStatus ?? 'all'}-${search}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          total={total}
          page={page}
          limit={20}
          onPageChange={setPage}
          onRowClick={(o) => router.push(`/orders/${o._id}`)}
          emptyMessage={search ? `No orders match "${search}"` : 'No orders found'}
        />
      </motion.div>

      {/* Destructive confirm — kept as-is, small polish. */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <TriangleAlert className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-gray-900">Clear all system orders?</h3>
            <p className="mb-2 text-sm text-gray-500">
              This will remove <span className="font-semibold text-gray-700">every order</span> from all views — customers, restaurants, and riders. The records are retained in the database but hidden from all users.
            </p>
            <p className="mb-6 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              This action cannot be undone. Use only for system resets.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {clearMutation.isPending ? 'Clearing…' : 'Yes, clear everything'}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                disabled={clearMutation.isPending}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// Compact relative time — "5m ago", "3h ago", "2d ago", or the locale date if older.
function fmtRelative(iso: string | Date): string {
  const ts   = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime()
  const diff = Date.now() - ts
  const min  = Math.floor(diff / 60_000)
  if (min < 1)    return 'just now'
  if (min < 60)   return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}
