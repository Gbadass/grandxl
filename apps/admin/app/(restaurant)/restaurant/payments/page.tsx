'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { myRestaurantApi } from '@grandxl/api-client'
import { PaymentMethod, PaymentStatus, UserRole } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { StatusBadge } from '../../../../src/components/ui/StatusBadge'
import '../../../../src/lib/axios'

type MethodFilter = 'all' | PaymentMethod
type StatusFilter = 'all' | PaymentStatus

function fmt(date: string | Date): string {
  return new Date(date).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function RestaurantPaymentsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [search, setSearch]     = useState('')
  const [method, setMethod]     = useState<MethodFilter>('all')
  const [status, setStatus]     = useState<StatusFilter>('all')
  const [openOrder, setOpenOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data: restaurantsData } = useQuery({
    queryKey: ['my-restaurants'],
    queryFn: () => myRestaurantApi.list(),
    enabled: isAuthenticated,
  })
  const restaurant   = restaurantsData?.data?.data?.[0]
  const restaurantId = restaurant?._id

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['restaurantPayments', restaurantId],
    queryFn:  () => myRestaurantApi.getOrders(restaurantId!, { limit: 100, page: 1 }),
    enabled:  !!restaurantId,
  })

  const orders: Order[] = (ordersData?.data?.data as Order[] | undefined) ?? []

  // ── Stats (today) ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const today = new Date()
    let gross = 0, net = 0, refunded = 0, pending = 0, count = 0
    for (const o of orders) {
      if (!isSameDay(new Date(o.createdAt), today)) continue
      if (o.payment?.status === PaymentStatus.COMPLETED) {
        count++
        gross += o.pricing.total
        // Net to restaurant = subtotal - discount (rough model — delivery → rider, service → GrandXL)
        net   += Math.max(0, o.pricing.subtotal - (o.pricing.discount ?? 0))
      } else if (o.payment?.status === PaymentStatus.PENDING) {
        pending++
      } else if (o.payment?.status === PaymentStatus.REFUNDED) {
        refunded++
      }
    }
    return { gross, net, refunded, pending, count }
  }, [orders])

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      if (status !== 'all' && o.payment?.status !== status) return false
      if (method !== 'all' && o.payment?.method !== method) return false
      if (q) {
        const ref = (o.payment?.reference ?? '').toLowerCase()
        const num = o.orderNumber.toLowerCase()
        if (!num.includes(q) && !ref.includes(q)) return false
      }
      return true
    })
  }, [orders, search, method, status])

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Track every transaction and reconcile against your bank settlements"
      />

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Today's gross"
          value={formatMoney(stats.gross, 'NGN')}
          sub={`${stats.count} order${stats.count === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Net to you (today)"
          value={formatMoney(stats.net, 'NGN')}
          sub="After platform & delivery fees"
          accent
        />
        <StatCard
          label="Pending"
          value={String(stats.pending)}
          sub="Awaiting payment confirmation"
        />
        <StatCard
          label="Refunded"
          value={String(stats.refunded)}
          sub="Today's reversals"
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order number or Paystack reference…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        >
          <option value="all">All statuses</option>
          <option value={PaymentStatus.COMPLETED}>Completed</option>
          <option value={PaymentStatus.PENDING}>Pending</option>
          <option value={PaymentStatus.REFUNDED}>Refunded</option>
          <option value={PaymentStatus.FAILED}>Failed</option>
        </select>

        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as MethodFilter)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        >
          <option value="all">All methods</option>
          <option value={PaymentMethod.PAYSTACK}>Paystack</option>
          <option value={PaymentMethod.WALLET}>Wallet</option>
          <option value={PaymentMethod.CASH}>Cash on delivery</option>
        </select>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Order</th>
              <th className="px-5 py-3 font-semibold">Method</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Customer paid</th>
              <th className="px-5 py-3 text-right font-semibold">Net to you</th>
              <th className="px-5 py-3 font-semibold">When</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                No transactions match these filters.
              </td></tr>
            ) : filtered.map((o) => {
              const net = Math.max(0, o.pricing.subtotal - (o.pricing.discount ?? 0))
              return (
                <tr
                  key={o._id}
                  onClick={() => setOpenOrder(o)}
                  className="cursor-pointer border-b border-gray-100 transition hover:bg-orange-50/40 last:border-b-0"
                >
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{o.orderNumber}</td>
                  <td className="px-5 py-3.5 capitalize text-gray-600">{o.payment?.method ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    {o.payment?.status && (
                      <StatusBadge
                        label={o.payment.status}
                        paymentStatus={o.payment.status}
                      />
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{formatMoney(o.pricing.total, 'NGN')}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-emerald-700">{formatMoney(net, 'NGN')}</td>
                  <td className="px-5 py-3.5 text-gray-500">{fmt(o.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Detail modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {openOrder && (
          <PaymentDetailModal order={openOrder} onClose={() => setOpenOrder(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${accent ? 'text-emerald-700' : 'text-gray-500'}`}>{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${accent ? 'text-emerald-900' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`mt-1 text-xs ${accent ? 'text-emerald-700/80' : 'text-gray-500'}`}>{sub}</p>}
    </div>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function PaymentDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const net = Math.max(0, order.pricing.subtotal - (order.pricing.discount ?? 0))
  const platformCut = order.pricing.serviceFee
  const riderCut    = order.pricing.deliveryFee

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1   }}
        exit={{    opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-7 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Order</p>
              <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-gray-900">{order.orderNumber}</h2>
              <p className="mt-1 text-xs text-gray-500">Placed {fmt(order.createdAt)}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-6 px-7 py-6">

          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customer paid</p>
              <p className="mt-1 text-2xl font-extrabold text-gray-900">{formatMoney(order.pricing.total, 'NGN')}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">You earn</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-900">{formatMoney(net, 'NGN')}</p>
            </div>
          </div>

          {/* Money breakdown */}
          <Section title="Money trail">
            <Row label="Subtotal (food)"        value={formatMoney(order.pricing.subtotal, 'NGN')} />
            <Row label="Delivery fee → rider"   value={formatMoney(riderCut, 'NGN')}        muted />
            <Row label="Service fee → GrandXL"  value={formatMoney(platformCut, 'NGN')}     muted />
            {order.pricing.discount > 0 && (
              <Row label={`Discount${order.coupon?.code ? ` (${order.coupon.code})` : ''}`} value={`− ${formatMoney(order.pricing.discount, 'NGN')}`} muted />
            )}
            {order.pricing.vat > 0 && (
              <Row label="VAT" value={formatMoney(order.pricing.vat, 'NGN')} muted />
            )}
            <div className="my-2 border-t border-gray-100" />
            <Row label="Customer paid" value={formatMoney(order.pricing.total, 'NGN')} bold />
            <Row label="Net to you"    value={formatMoney(net, 'NGN')} bold accent />
          </Section>

          {/* Payment details */}
          <Section title="Payment">
            <Row label="Method"    value={<span className="capitalize">{order.payment?.method ?? '—'}</span>} />
            <Row label="Status"    value={
              order.payment?.status
                ? <StatusBadge label={order.payment.status} paymentStatus={order.payment.status} />
                : '—'
            } />
            <Row label="Reference" value={
              order.payment?.reference
                ? <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">{order.payment.reference}</code>
                : '—'
            } />
            {order.payment?.paidAt && (
              <Row label="Paid at" value={fmt(order.payment.paidAt)} />
            )}
          </Section>

          {/* Items */}
          <Section title={`Items (${order.items.length})`}>
            <div className="space-y-2">
              {order.items.map((it, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{it.name}</p>
                    <p className="text-xs text-gray-500">
                      {it.quantity} × {formatMoney(it.basePrice, 'NGN')}
                      {it.selectedAddOns?.length ? ` · ${it.selectedAddOns.length} add-on${it.selectedAddOns.length === 1 ? '' : 's'}` : ''}
                    </p>
                    {it.note && <p className="mt-1 text-xs italic text-gray-500">&ldquo;{it.note}&rdquo;</p>}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gray-900">{formatMoney(it.itemTotal, 'NGN')}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Delivery */}
          <Section title="Delivery">
            <p className="text-sm text-gray-700">
              {order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.state}
            </p>
            {order.customerNote && (
              <p className="mt-2 rounded-xl bg-yellow-50 px-3 py-2 text-xs italic text-yellow-800">
                <strong className="not-italic">Note:</strong> {order.customerNote}
              </p>
            )}
          </Section>

          {/* Refund / cancel */}
          {(order.payment?.status === PaymentStatus.REFUNDED || order.cancelReason) && (
            <Section title="Reversal">
              {order.cancelReason && (
                <p className="text-sm text-gray-700"><strong>Cancel reason:</strong> {order.cancelReason}</p>
              )}
              {order.payment?.status === PaymentStatus.REFUNDED && (
                <p className="mt-1 text-sm text-gray-700">Payment has been refunded.</p>
              )}
            </Section>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      <div className="rounded-2xl border border-gray-100 bg-white p-4">{children}</div>
    </section>
  )
}

function Row({ label, value, muted, bold, accent }: {
  label: string
  value: React.ReactNode
  muted?: boolean
  bold?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <p className={`text-sm ${muted ? 'text-gray-500' : 'text-gray-700'}`}>{label}</p>
      <div className={[
        'text-sm',
        bold ? 'font-bold' : 'font-medium',
        accent ? 'text-emerald-700' : 'text-gray-900',
      ].join(' ')}>{value}</div>
    </div>
  )
}
