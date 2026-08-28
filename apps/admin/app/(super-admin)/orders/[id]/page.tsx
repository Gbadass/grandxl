'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminOrdersApi, adminRidersApi, adminSupportApi } from '@grandxl/api-client'
import { UserRole, PaymentStatus } from '@grandxl/types'
import type { Rider } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { StatusBadge } from '../../../../src/components/ui/StatusBadge'
import '../../../../src/lib/axios'

export default function AdminOrderDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [selectedRiderId, setSelectedRiderId] = useState('')

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => adminOrdersApi.getById(id),
    enabled: !!id && isAuthenticated,
  })

  const { data: ridersData } = useQuery({
    queryKey: ['admin', 'riders', 'verified'],
    queryFn: () => adminRidersApi.list({ limit: 100 }),
    enabled: isAuthenticated,
  })

  const order = data?.data?.data
  const riders = (ridersData?.data?.data?.data ?? []) as Rider[]
  const verifiedRiders = riders.filter((r) => r.isVerified)

  const assignMutation = useMutation({
    mutationFn: () => adminRidersApi.assignToOrder(selectedRiderId, id),
    onSuccess: () => {
      toast.success('Rider assigned successfully')
      void qc.invalidateQueries({ queryKey: ['admin', 'order', id] })
      setSelectedRiderId('')
    },
    onError: () => toast.error('Failed to assign rider'),
  })

  const redispatchMutation = useMutation({
    mutationFn: () => adminOrdersApi.redispatch(id),
    onSuccess: () => toast.success('Dispatch re-queued — rider will be notified shortly'),
    onError: () => toast.error('Failed to re-queue dispatch'),
  })

  const debugMutation = useMutation({
    mutationFn: () => adminOrdersApi.dispatchDebug(id),
    onSuccess: (res) => alert(JSON.stringify(res.data, null, 2)),
    onError: () => toast.error('Debug call failed'),
  })

  if (isInitializing || isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
    )
  }

  if (!order) return <p className="text-gray-500">Order not found.</p>

  const hasRider = !!order.riderId
  const canAssign = !hasRider && ['pending', 'confirmed', 'preparing'].includes(order.status)

  return (
    <div>
      <PageHeader
        title={order.orderNumber}
        subtitle={`Placed ${new Date(order.createdAt).toLocaleString('en-NG')}`}
        action={
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            ← Back
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Order Items</h2>
            <div className="divide-y divide-gray-100">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-start justify-between py-3">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.quantity}× {item.name}</p>
                    {item.selectedVariants.length > 0 && (
                      <p className="text-xs text-gray-400">
                        {item.selectedVariants.map((v) => `${v.variantName}: ${v.optionName}`).join(', ')}
                      </p>
                    )}
                    {item.selectedAddOns.length > 0 && (
                      <p className="text-xs text-gray-400">
                        Add-ons: {item.selectedAddOns.map((a) => a.name).join(', ')}
                      </p>
                    )}
                    {item.note && (
                      <p className="text-xs italic text-gray-400">Note: {item.note}</p>
                    )}
                  </div>
                  <span className="ml-4 font-medium text-gray-900">
                    {formatMoney(item.itemTotal, order.currency)}
                  </span>
                </div>
              ))}
            </div>
            {order.customerNote && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <strong>Customer note:</strong> {order.customerNote}
              </div>
            )}
          </div>

          {/* Rider Assignment */}
          {canAssign && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-6">
              <h2 className="mb-1 font-semibold text-orange-900">No Rider Assigned</h2>
              <p className="mb-4 text-sm text-orange-700">This order has no rider. Re-queue automatic dispatch or assign a rider manually below.</p>

              {/* Re-dispatch */}
              <div className="mb-4 flex items-center justify-between rounded-lg border border-orange-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Re-queue dispatch</p>
                  <p className="text-xs text-gray-500">Clears previous declines and broadcasts to nearby riders again</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => debugMutation.mutate()}
                    disabled={debugMutation.isPending}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {debugMutation.isPending ? '…' : 'Debug'}
                  </button>
                  <button
                    onClick={() => redispatchMutation.mutate()}
                    disabled={redispatchMutation.isPending}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {redispatchMutation.isPending ? 'Queuing…' : 'Redispatch'}
                  </button>
                </div>
              </div>

              {/* Manual assign */}
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600">Or assign manually</p>
              <div className="flex gap-3">
                <select
                  value={selectedRiderId}
                  onChange={(e) => setSelectedRiderId(e.target.value)}
                  className="flex-1 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <option value="">Select a rider…</option>
                  {verifiedRiders.map((r) => {
                    const user = r.userId as import('@grandxl/types').RiderUser | null
                    const name = user ? `${user.firstName} ${user.lastName}` : 'Unknown'
                    return (
                      <option key={r._id} value={r._id}>
                        {r.isOnline ? '🟢' : '⚫'} {name} — {r.vehicleType} {r.vehiclePlate ? `(${r.vehiclePlate})` : ''} · {r.totalDeliveries} deliveries
                      </option>
                    )
                  })}
                </select>
                <button
                  onClick={() => assignMutation.mutate()}
                  disabled={!selectedRiderId || assignMutation.isPending}
                  className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
                >
                  {assignMutation.isPending ? 'Assigning…' : 'Assign Rider'}
                </button>
              </div>
              {verifiedRiders.length === 0 && (
                <p className="mt-2 text-xs text-orange-600">No verified online riders available right now.</p>
              )}
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Summary</h2>
            <div className="space-y-2 text-sm">
              <Row label="Status">
                <StatusBadge label={order.status} orderStatus={order.status} />
              </Row>
              <Row label="Payment">
                <StatusBadge label={order.payment.status} paymentStatus={order.payment.status} />
              </Row>
              <Row label="Payment method" value={order.payment.method} />
              <div className="border-t border-gray-100 pt-2">
                <Row label="Subtotal" value={formatMoney(order.pricing.subtotal, order.currency)} />
                <Row label="Delivery fee" value={formatMoney(order.pricing.deliveryFee, order.currency)} />
                <Row label="Service fee" value={formatMoney(order.pricing.serviceFee, order.currency)} />
                {order.pricing.discount > 0 && (
                  <Row label="Discount" value={`-${formatMoney(order.pricing.discount, order.currency)}`} />
                )}
                <div className="border-t border-gray-100 pt-2">
                  <Row label="Total" value={formatMoney(order.pricing.total, order.currency)} bold />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Delivery Address</h2>
            <p className="text-sm text-gray-700">{order.deliveryAddress.street}</p>
            <p className="text-sm text-gray-500">{order.deliveryAddress.city}, {order.deliveryAddress.state}</p>
          </div>

          {order.riderId && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-2 font-semibold text-gray-900">Assigned Rider</h2>
              <p className="text-sm text-gray-500 font-mono">{String(order.riderId)}</p>
            </div>
          )}

          {/* Sprint 13 (S13-5): force-refund panel. Only usable when the
              customer actually paid — free-to-customer orders (fully covered
              by wallet at debit or 100% coupon) can't be refunded through
              this path because there's nothing to refund. */}
          {order.payment?.status === PaymentStatus.COMPLETED && (
            <ForceRefundPanel
              orderId={order._id}
              orderNumber={order.orderNumber}
              totalKobo={order.pricing.total}
              currency={order.currency}
              onRefunded={() => void qc.invalidateQueries({ queryKey: ['admin', 'order', id] })}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sprint 13 (S13-5): Force refund inline component ─────────────────────────

function ForceRefundPanel({ orderId, orderNumber, totalKobo, currency, onRefunded }: {
  orderId:     string
  orderNumber: string
  totalKobo:   number
  currency:    string
  onRefunded:  () => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<string>((totalKobo / 100).toFixed(2))
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => adminSupportApi.forceRefund({
      orderId,
      amountKobo: Math.round(parseFloat(amount) * 100),
      reason:     reason.trim(),
    }),
    onSuccess: (res) => {
      toast.success(`Refunded ${formatMoney(res.data.data.refundedKobo, currency)} to customer wallet`)
      setOpen(false)
      setReason('')
      onRefunded()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(typeof msg === 'string' ? msg : 'Force refund failed')
    },
  })

  const parsedKobo = Math.round((parseFloat(amount) || 0) * 100)
  const valid = parsedKobo >= 1 && parsedKobo <= totalKobo && reason.trim().length >= 3

  if (!open) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 p-6">
        <h2 className="mb-1 font-semibold text-red-900">Force refund</h2>
        <p className="mb-3 text-sm text-red-700">
          Credit the customer&apos;s wallet for this order. Reason is audit-logged. Use for post-delivery complaints and service failures — customer-requested refunds go through the Refunds queue instead.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer"
        >
          Open refund form
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-red-200 bg-white p-6 space-y-3">
      <h2 className="font-semibold text-red-900">Force refund on {orderNumber}</h2>
      <p className="text-xs text-gray-500">Order total: <span className="font-semibold tabular-nums text-gray-800">{formatMoney(totalKobo, currency)}</span></p>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Amount ({currency})</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={totalKobo / 100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-lg font-bold tabular-nums outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Reason (min 3 chars, audit-logged)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. Cold food, customer sent photo in Slack #escalations"
          maxLength={300}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={() => { setOpen(false); setReason('') }}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
          className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {mutation.isPending ? 'Refunding…' : 'Confirm refund'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, children, bold }: {
  label: string; value?: string; children?: React.ReactNode; bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-500">{label}</span>
      {children ?? (
        <span className={bold ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}>{value}</span>
      )}
    </div>
  )
}
