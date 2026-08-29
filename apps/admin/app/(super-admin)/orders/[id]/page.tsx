'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  adminOrdersApi, adminRidersApi, adminSupportApi, adminAuditApi, ordersApi,
  type AdminOrderRow, type AuditLogEntry,
} from '@grandxl/api-client'
import { UserRole, PaymentStatus, OrderStatus } from '@grandxl/types'
import type { Rider } from '@grandxl/types'
import { formatMoney, parseApiError } from '@grandxl/utils'
import {
  ArrowLeft, User as UserIcon, Store, Bike, Phone, MapPin, Package,
  CircleDollarSign, Clock, Zap, AlertTriangle, RefreshCw, ShieldAlert, ScrollText, Copy,
} from 'lucide-react'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { StatusBadge } from '../../../../src/components/ui/StatusBadge'
import '../../../../src/lib/axios'

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOrderDetailPage() {
  const router = useRouter()
  const { id }  = useParams<{ id: string }>()
  const qc      = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn:  () => adminOrdersApi.getById(id),
    enabled:  !!id && isAuthenticated,
  })

  const order = data?.data?.data as AdminOrderRow | undefined

  if (isInitializing || isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    )
  }

  if (!order) return <p className="text-gray-500">Order not found.</p>

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.orderNumber}
        subtitle={`Placed ${new Date(order.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}`}
        action={
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      {/* Top row: state banner — always visible, sets the emotional tone of the page */}
      <StateBanner order={order} />

      {/* Main workspace: left = trace + facts, right = ops actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Timeline order={order} />
          <Participants order={order} />
          <ItemsCard order={order} />
        </div>

        <div className="space-y-6">
          <PricingCard order={order} />
          <DeliveryCard order={order} />
          <ActionRail
            order={order}
            onChanged={() => void qc.invalidateQueries({ queryKey: ['admin', 'order', id] })}
          />
        </div>
      </div>

      {/* Bottom: audit trail — every privileged action on this order */}
      <AuditTrail orderId={id} />
    </div>
  )
}

// ── Top state banner ─────────────────────────────────────────────────────────

function StateBanner({ order }: { order: AdminOrderRow }) {
  const isCancelled = order.status === OrderStatus.CANCELLED
  const isTerminal  = order.status === OrderStatus.DELIVERED || isCancelled
  // Stuck heuristic: rider committed but never picked up. Threshold uses the
  // restaurant's estimatedTime as a floor so far-delivery orders (long ETA)
  // don't false-positive. `estimatedTime` is minutes end-to-end; we compare
  // against just the pickup wait, so it's a generous ceiling.
  const stuckMinutes = Math.max(25, order.estimatedTime ?? 25)
  const isStuck     =
    !isTerminal &&
    order.riderAssignedAt &&
    order.pickedUpAt == null &&
    Date.now() - new Date(order.riderAssignedAt as unknown as string).getTime() > stuckMinutes * 60_000

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border p-5 ${
        isCancelled
          ? 'border-red-200 bg-red-50'
          : isStuck
            ? 'border-amber-200 bg-amber-50'
            : order.status === OrderStatus.DELIVERED
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label={order.status} orderStatus={order.status} />
        <StatusBadge label={order.payment.status} paymentStatus={order.payment.status} />
        <span className="text-xs uppercase tracking-wider text-gray-500">{order.payment.method}</span>
        {order.dispatchedWithoutRestaurantAck && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
            <Zap size={10} /> Rider drove this
          </span>
        )}
        {order.isFarDelivery && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
            far delivery{order.deliveryDistanceKm ? ` · ${order.deliveryDistanceKm.toFixed(1)}km` : ''}
          </span>
        )}
        {isStuck && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-300">
            <AlertTriangle size={10} /> Stuck — no pickup for 25m+
          </span>
        )}
      </div>
      {isCancelled && order.cancelReason && (
        <p className="mt-2 text-sm text-red-700">
          <strong>Cancelled:</strong> {order.cancelReason}
        </p>
      )}
    </motion.div>
  )
}

// ── Timeline ─────────────────────────────────────────────────────────────────

interface TimelineEvent {
  at:       Date
  label:    string
  detail?:  string
  tone:     'neutral' | 'success' | 'warn' | 'error'
  icon?:    React.ReactNode
}

function Timeline({ order }: { order: AdminOrderRow }) {
  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = []
    const push = (at: string | Date | null | undefined, e: Omit<TimelineEvent, 'at'>) => {
      if (!at) return
      list.push({ ...e, at: typeof at === 'string' ? new Date(at) : at })
    }

    push(order.createdAt, {
      label:  'Order placed',
      detail: order.customer ? `${order.customer.firstName} ${order.customer.lastName} · ${order.items.length} item(s)` : `${order.items.length} item(s)`,
      tone:   'neutral',
      icon:   <Package size={12} />,
    })

    if (order.payment.status === PaymentStatus.COMPLETED && order.payment.paidAt) {
      push(order.payment.paidAt, {
        label:  'Payment received',
        detail: `${order.payment.method} · ${formatMoney(order.pricing.total, order.currency)}`,
        tone:   'success',
        icon:   <CircleDollarSign size={12} />,
      })
    }

    push(order.restaurantAckedAt, {
      label:  order.restaurantConfirmedAt ? 'Restaurant tapped Accept' : 'Restaurant engaged',
      detail: order.restaurant?.name,
      tone:   'success',
      icon:   <Store size={12} />,
    })

    push(order.restaurantReadyAt, {
      label:  'Restaurant marked ready',
      tone:   'success',
      icon:   <Store size={12} />,
    })

    push(order.firstDispatchAt, {
      label:  'First rider dispatch fired',
      detail: order.dispatchBroadcastCount ? `${order.dispatchBroadcastCount} rider(s) notified across ${order.dispatchRounds} round(s)` : undefined,
      tone:   'neutral',
      icon:   <Bike size={12} />,
    })

    if (order.dispatchedWithoutRestaurantAck && !order.restaurantAckedAt) {
      // Escalation timer fired before the restaurant ever engaged. Timestamp
      // isn't tracked separately — use riderAssignedAt or firstDispatchAt as
      // the anchor. Ops needs to see this as a distinct warning event.
      push(order.riderAssignedAt ?? order.firstDispatchAt, {
        label:  'Dispatched without restaurant ack',
        detail: 'Escalation timer fired — restaurant hadn\'t tapped Accept',
        tone:   'warn',
        icon:   <Zap size={12} />,
      })
    }

    push(order.riderAssignedAt, {
      label:  order.rider ? `Rider committed: ${order.rider.firstName} ${order.rider.lastName}` : 'Rider committed',
      detail: order.rider?.phone ?? undefined,
      tone:   'success',
      icon:   <Bike size={12} />,
    })

    push(order.pickedUpAt, {
      label:  'Picked up from restaurant',
      tone:   'success',
      icon:   <Package size={12} />,
    })

    push(order.actualDeliveryAt, {
      label:  'Delivered to customer',
      tone:   'success',
      icon:   <MapPin size={12} />,
    })

    if (order.status === OrderStatus.CANCELLED) {
      push(order.updatedAt, {
        label:  'Order cancelled',
        detail: order.cancelReason ?? 'No reason given',
        tone:   'error',
        icon:   <AlertTriangle size={12} />,
      })
    }

    return list.sort((a, b) => a.at.getTime() - b.at.getTime())
  }, [order])

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900">
          <Clock size={14} className="text-orange-600" /> Order timeline
        </h2>
        <span className="text-xs text-gray-400">{events.length} event(s)</span>
      </div>
      <ol className="relative space-y-4 border-l border-gray-200 pl-6">
        <AnimatePresence initial={false}>
          {events.map((e, i) => (
            <motion.li
              key={`${e.label}-${e.at.getTime()}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15, delay: i * 0.02 }}
              className="relative"
            >
              <span
                className={`absolute -left-[29px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white ${
                  e.tone === 'success' ? 'bg-emerald-500 text-white'
                    : e.tone === 'warn'  ? 'bg-amber-500 text-white'
                    : e.tone === 'error' ? 'bg-red-500 text-white'
                    : 'bg-gray-300 text-white'
                }`}
              >
                {e.icon}
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">{e.label}</p>
                <p className="text-xs tabular-nums text-gray-400" title={e.at.toISOString()}>
                  {e.at.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              {e.detail && <p className="mt-0.5 text-xs text-gray-500">{e.detail}</p>}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  )
}

// ── Participants (customer / restaurant / rider) ─────────────────────────────

function Participants({ order }: { order: AdminOrderRow }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <ParticipantCard
        icon={<UserIcon size={14} />}
        label="Customer"
        name={order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Unknown'}
        phone={order.customer?.phone ?? null}
        email={order.customer?.email ?? null}
      />
      <ParticipantCard
        icon={<Store size={14} />}
        label="Restaurant"
        name={order.restaurant?.name ?? 'Unknown'}
        phone={null}
      />
      <ParticipantCard
        icon={<Bike size={14} />}
        label="Rider"
        name={order.rider ? `${order.rider.firstName} ${order.rider.lastName}` : 'Unassigned'}
        phone={order.rider?.phone ?? null}
        muted={!order.rider}
      />
    </div>
  )
}

function ParticipantCard({ icon, label, name, phone, email, muted }: {
  icon: React.ReactNode; label: string; name: string
  phone: string | null; email?: string | null; muted?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 ${muted ? 'border-dashed border-gray-200 bg-gray-50/60' : 'border-gray-200 bg-white'}`}>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        <span className="text-gray-400">{icon}</span> {label}
      </div>
      <p className={`text-sm font-semibold ${muted ? 'text-gray-400' : 'text-gray-900'}`}>{name}</p>
      {phone && (
        <a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700">
          <Phone size={10} /> {phone}
        </a>
      )}
      {email && (
        <p className="mt-0.5 truncate text-[11px] text-gray-500">{email}</p>
      )}
    </div>
  )
}

// ── Items card ───────────────────────────────────────────────────────────────

function ItemsCard({ order }: { order: AdminOrderRow }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
        <Package size={14} className="text-orange-600" /> Items ({order.items.length})
      </h2>
      <div className="divide-y divide-gray-100">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-start justify-between py-3">
            <div className="flex-1 pr-4">
              <p className="font-medium text-gray-900">{item.quantity}× {item.name}</p>
              {item.selectedVariants.length > 0 && (
                <p className="text-xs text-gray-500">
                  {item.selectedVariants.map((v) => `${v.variantName}: ${v.optionName}`).join(' · ')}
                </p>
              )}
              {item.selectedAddOns.length > 0 && (
                <p className="text-xs text-gray-500">
                  Add-ons: {item.selectedAddOns.map((a) => a.name).join(', ')}
                </p>
              )}
              {item.note && (
                <p className="mt-0.5 text-xs italic text-amber-700">Note: {item.note}</p>
              )}
            </div>
            <span className="tabular-nums font-medium text-gray-900">
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
  )
}

// ── Sidebar: Pricing ─────────────────────────────────────────────────────────

function PricingCard({ order }: { order: AdminOrderRow }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
        <CircleDollarSign size={14} className="text-orange-600" /> Pricing
      </h2>
      <div className="space-y-1.5 text-sm">
        <Row label="Subtotal"     value={formatMoney(order.pricing.subtotal,   order.currency)} />
        <Row label="Delivery fee" value={formatMoney(order.pricing.deliveryFee, order.currency)} />
        <Row label="Service fee"  value={formatMoney(order.pricing.serviceFee,  order.currency)} />
        {order.pricing.discount > 0 && (
          <Row label="Discount"   value={`-${formatMoney(order.pricing.discount, order.currency)}`} />
        )}
        {(order.pricing.walletApplied ?? 0) > 0 && (
          <Row label="Wallet applied" value={`-${formatMoney(order.pricing.walletApplied ?? 0, order.currency)}`} />
        )}
        <div className="border-t border-gray-100 pt-2">
          <Row label="Total" value={formatMoney(order.pricing.total, order.currency)} bold />
        </div>
      </div>
    </div>
  )
}

// ── Sidebar: Delivery ────────────────────────────────────────────────────────

function DeliveryCard({ order }: { order: AdminOrderRow }) {
  const addr = order.deliveryAddress
  const copy = `${addr.street}, ${addr.city}, ${addr.state}`
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
        <MapPin size={14} className="text-orange-600" /> Delivery
      </h2>
      <p className="text-sm text-gray-800">{addr.street}</p>
      <p className="text-xs text-gray-500">{addr.city}, {addr.state}</p>
      {order.deliveryInstructions && (
        <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          <strong>Notes:</strong> {order.deliveryInstructions}
        </p>
      )}
      <button
        type="button"
        onClick={() => { void navigator.clipboard.writeText(copy); toast.success('Address copied') }}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700"
      >
        <Copy size={10} /> Copy address
      </button>
    </div>
  )
}

// ── Sidebar: Ops action rail (reassign, redispatch, emergency status, refund) ─

function ActionRail({ order, onChanged }: { order: AdminOrderRow; onChanged: () => void }) {
  const { data: ridersData } = useQuery({
    queryKey: ['admin', 'riders', 'verified'],
    queryFn:  () => adminRidersApi.list({ limit: 100 }),
  })
  const riders           = (ridersData?.data?.data?.data ?? []) as Rider[]
  const verifiedRiders   = riders.filter((r) => r.isVerified)
  const [selectedRider, setSelectedRider] = useState('')

  const assignMutation = useMutation({
    mutationFn: () => adminRidersApi.assignToOrder(selectedRider, order._id),
    onSuccess: () => { toast.success('Rider assigned'); setSelectedRider(''); onChanged() },
    onError:   (e) => toast.error(parseApiError(e, 'Failed to assign rider')),
  })

  const redispatchMutation = useMutation({
    mutationFn: () => adminOrdersApi.redispatch(order._id),
    onSuccess: () => { toast.success('Dispatch re-queued'); onChanged() },
    onError:   (e) => toast.error(parseApiError(e, 'Failed to re-queue')),
  })

  const canAssignOrRedispatch = !order.rider
    && [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(order.status)

  const canEmergencyForce = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP].includes(order.status)
  const canForceCancel    = ![OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(order.status)
  const canRefund         = order.payment?.status === PaymentStatus.COMPLETED

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-1">
        <div className="rounded-[calc(1rem-4px)] bg-white p-4">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-gray-900">
            <ShieldAlert size={14} className="text-orange-600" /> Ops actions
          </h2>
          <p className="text-xs text-gray-500">Super-admin intervention. Every action is audit-logged.</p>
        </div>
      </div>

      {canAssignOrRedispatch && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-orange-900">Dispatch / assign</h3>
          <button
            onClick={() => redispatchMutation.mutate()}
            disabled={redispatchMutation.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} /> {redispatchMutation.isPending ? 'Re-queuing…' : 'Redispatch'}
          </button>
          <div className="space-y-1.5">
            <select
              value={selectedRider}
              onChange={(e) => setSelectedRider(e.target.value)}
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 cursor-pointer"
            >
              <option value="">Assign specific rider…</option>
              {verifiedRiders.map((r) => {
                const u = r.userId as import('@grandxl/types').RiderUser | null
                const name = u ? `${u.firstName} ${u.lastName}` : 'Unknown'
                return (
                  <option key={r._id} value={r._id}>
                    {r.isOnline ? '🟢' : '⚫'} {name} — {r.vehicleType} · {r.totalDeliveries}
                  </option>
                )
              })}
            </select>
            <button
              onClick={() => assignMutation.mutate()}
              disabled={!selectedRider || assignMutation.isPending}
              className="w-full rounded-lg bg-gray-800 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-40 cursor-pointer"
            >
              {assignMutation.isPending ? 'Assigning…' : 'Assign this rider'}
            </button>
          </div>
        </div>
      )}

      {canEmergencyForce && (
        <EmergencyStatusPanel
          orderId={order._id}
          orderNumber={order.orderNumber}
          currentStatus={order.status}
          onDone={onChanged}
        />
      )}

      {canForceCancel && (
        <ForceCancelPanel
          orderId={order._id}
          orderNumber={order.orderNumber}
          onDone={onChanged}
        />
      )}

      {canRefund && (
        <ForceRefundPanel
          orderId={order._id}
          orderNumber={order.orderNumber}
          totalKobo={order.pricing.total}
          currency={order.currency}
          onRefunded={onChanged}
        />
      )}
    </div>
  )
}

// ── Emergency status advance ─────────────────────────────────────────────────

function EmergencyStatusPanel({ orderId, orderNumber, currentStatus, onDone }: {
  orderId:       string
  orderNumber:   string
  currentStatus: OrderStatus
  onDone:        () => void
}) {
  const [pending, setPending] = useState<null | { next: OrderStatus; label: string }>(null)
  const [reason, setReason]   = useState('')

  const mutation = useMutation({
    mutationFn: () => ordersApi.updateStatus(orderId, { status: pending!.next }),
    onSuccess: () => {
      toast.success(`Order ${orderNumber} → ${pending!.label}`)
      setPending(null); setReason(''); onDone()
    },
    onError: (e: unknown) => {
      const status = (e as { response?: { status?: number } })?.response?.status
      // 409: another admin (or the rider) changed status between our page load
      // and this click. Refresh so we don't act on stale state.
      if (status === 409) {
        toast.error('Someone else changed this order — refreshing.')
        onDone()
        setPending(null); setReason('')
        return
      }
      toast.error(parseApiError(e, 'Status update failed'))
    },
  })

  const canForcePickup  = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(currentStatus)
  const canForceDeliver = [OrderStatus.READY, OrderStatus.PICKED_UP].includes(currentStatus)

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <h3 className="mb-1 text-sm font-semibold text-amber-900">Emergency status</h3>
      <p className="mb-3 text-xs text-amber-800">
        Bypass the rider&apos;s 300m proximity check when a delivery is stuck.
      </p>
      <div className="space-y-2">
        {canForcePickup && (
          <button
            onClick={() => setPending({ next: OrderStatus.PICKED_UP, label: 'Picked up' })}
            className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 cursor-pointer"
          >
            Force <strong>picked up</strong>
            <span className="text-[10px] font-normal text-amber-700">no geofence</span>
          </button>
        )}
        {canForceDeliver && (
          <button
            onClick={() => setPending({ next: OrderStatus.DELIVERED, label: 'Delivered' })}
            className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 cursor-pointer"
          >
            Force <strong>delivered</strong>
            <span className="text-[10px] font-normal text-amber-700">no geofence</span>
          </button>
        )}
      </div>

      <ConfirmModal
        open={!!pending}
        title={pending ? `Force to ${pending.label}?` : ''}
        toneClass="bg-amber-600 hover:bg-amber-700"
        description={pending ? (
          <>
            Move <span className="font-mono font-semibold">{orderNumber}</span> from
            {' '}<strong>{currentStatus}</strong> → <strong>{pending.next}</strong>.
            {' '}Bypasses the rider&apos;s 300m proximity check.
          </>
        ) : ''}
        reason={reason}
        onReasonChange={setReason}
        onCancel={() => { setPending(null); setReason('') }}
        onConfirm={() => mutation.mutate()}
        confirmLabel={pending ? `Force to ${pending.label}` : ''}
        loading={mutation.isPending}
      />
    </div>
  )
}

// ── Force cancel ─────────────────────────────────────────────────────────────

function ForceCancelPanel({ orderId, orderNumber, onDone }: {
  orderId: string; orderNumber: string; onDone: () => void
}) {
  const [open, setOpen]     = useState(false)
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => ordersApi.cancel(orderId, reason.trim() || 'Cancelled by admin'),
    onSuccess: () => {
      toast.success(`Order ${orderNumber} cancelled`)
      setOpen(false); setReason(''); onDone()
    },
    onError: (e: unknown) => {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        toast.error('Someone else changed this order — refreshing.')
        onDone()
        setOpen(false); setReason('')
        return
      }
      toast.error(parseApiError(e, 'Cancel failed'))
    },
  })

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
      <h3 className="mb-1 text-sm font-semibold text-red-900">Force cancel</h3>
      <p className="mb-3 text-xs text-red-800">
        Cancels for the customer and restaurant. Wallet portion refunds automatically.
      </p>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
      >
        Cancel this order
      </button>

      <ConfirmModal
        open={open}
        title="Cancel this order?"
        toneClass="bg-red-600 hover:bg-red-700"
        description={<>Order <span className="font-mono font-semibold">{orderNumber}</span> will be cancelled. Wallet refunds fire automatically. Not reversible.</>}
        reason={reason}
        onReasonChange={setReason}
        reasonPlaceholder="Required — customer will see this"
        onCancel={() => { setOpen(false); setReason('') }}
        onConfirm={() => mutation.mutate()}
        confirmLabel="Cancel order"
        loading={mutation.isPending}
        confirmDisabled={reason.trim().length < 3}
      />
    </div>
  )
}

// ── Force refund (Sprint 13 S13-5, kept mostly as-is) ────────────────────────

function ForceRefundPanel({ orderId, orderNumber, totalKobo, currency, onRefunded }: {
  orderId: string; orderNumber: string; totalKobo: number; currency: string; onRefunded: () => void
}) {
  const [open, setOpen]     = useState(false)
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
      setOpen(false); setReason(''); onRefunded()
    },
    onError: (e: unknown) => toast.error(parseApiError(e, 'Force refund failed')),
  })

  const parsedKobo = Math.round((parseFloat(amount) || 0) * 100)
  const valid      = parsedKobo >= 1 && parsedKobo <= totalKobo && reason.trim().length >= 3

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
      <h3 className="mb-1 text-sm font-semibold text-red-900">Force refund</h3>
      <p className="mb-3 text-xs text-red-800">
        Credit the customer&apos;s wallet — for post-delivery complaints and service failures.
      </p>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
      >
        Refund form
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4"
            onClick={() => !mutation.isPending && setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-lg font-bold text-gray-900">Force refund on {orderNumber}</h3>
              <p className="mb-3 text-xs text-gray-500">
                Order total: <span className="font-semibold tabular-nums text-gray-800">{formatMoney(totalKobo, currency)}</span>
              </p>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Amount ({currency})</label>
              <input
                type="number" step="0.01" min="0.01" max={totalKobo / 100}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="mb-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-lg font-bold tabular-nums outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Reason (min 3 chars, audit-logged)</label>
              <textarea
                value={reason} onChange={(e) => setReason(e.target.value)}
                rows={2} maxLength={300}
                placeholder="e.g. Cold food, customer sent photo in Slack #escalations"
                className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setOpen(false); setReason('') }}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 cursor-pointer"
                >Cancel</button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={!valid || mutation.isPending}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {mutation.isPending ? 'Refunding…' : 'Confirm refund'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Audit trail ──────────────────────────────────────────────────────────────

function AuditTrail({ orderId }: { orderId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'audit', 'order', orderId],
    queryFn:  () => adminAuditApi.list({ targetType: 'order', targetId: orderId, limit: 50 }),
    enabled:  !!orderId,
    // Fail loud instead of silently spinning forever. Ops relies on this panel
    // to trace who did what — if it's silently broken they'll never notice.
    retry: 1,
  })

  const entries: AuditLogEntry[] = (data?.data?.data?.data ?? []) as AuditLogEntry[]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
        <ScrollText size={14} className="text-orange-600" /> Ops audit trail
      </h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>Couldn&apos;t load audit trail — check your connection.</span>
          <button onClick={() => void refetch()} className="text-xs font-semibold text-red-800 underline hover:text-red-900">
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400">No admin actions recorded for this order.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {entries.map((e) => (
            <div key={e._id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-gray-800">{humanizeAction(e.action)}</p>
                <p className="text-xs text-gray-500">
                  {e.actorEmail ?? e.actorId}
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <> · <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-600">{JSON.stringify(e.metadata)}</code></>
                  )}
                </p>
              </div>
              <p className="shrink-0 text-xs tabular-nums text-gray-400" title={new Date(e.createdAt).toISOString()}>
                {new Date(e.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    'orders.redispatch':            'Re-queued dispatch',
    'orders.reassign_rider':        'Reassigned rider',
    'orders.clear_all':             'Cleared all orders',
    'orders.admin_status_change':   'Force status change',
    'orders.admin_cancel':          'Force cancelled',
    'refund.approve':               'Refund approved',
    'refund.reject':                'Refund rejected',
    'support.force_refund':         'Force refund',
  }
  return map[action] ?? action
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-bold text-gray-900' : 'font-medium tabular-nums text-gray-800'}>{value}</span>
    </div>
  )
}

function ConfirmModal({
  open, title, description, reason, onReasonChange, onCancel, onConfirm,
  confirmLabel, loading, toneClass, confirmDisabled, reasonPlaceholder,
}: {
  open:              boolean
  title:             string
  description:       React.ReactNode
  reason:            string
  onReasonChange:    (s: string) => void
  onCancel:          () => void
  onConfirm:         () => void
  confirmLabel:      string
  loading?:          boolean
  toneClass:         string
  confirmDisabled?:  boolean
  reasonPlaceholder?: string
}) {
  // Standard modal keyboard behaviour: Escape dismisses (unless we're mid-flight
  // — don't let the user close a modal whose action is in progress and think
  // it was cancelled).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !loading && onCancel()}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-bold text-gray-900">{title}</h3>
            <div className="mb-4 text-sm text-gray-600">{description}</div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">
              Reason (audit-logged)
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={2} maxLength={300}
              placeholder={reasonPlaceholder ?? 'Optional — helps future ops see why'}
              className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={loading}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
              >Cancel</button>
              <button
                onClick={onConfirm}
                disabled={loading || confirmDisabled}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${toneClass}`}
              >
                {loading ? 'Working…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
