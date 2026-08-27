'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { myRestaurantApi, ordersApi, type RiderContact } from '@grandxl/api-client'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { CancelReasonCode } from '@grandxl/types'
import { CANCEL_REASON_OPTIONS, labelForCode } from '../../../../../src/lib/cancelReasons'
import { printOrderTicket } from '../../../../../src/lib/orderTicket'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../../src/store/auth.store'
import { PageHeader } from '../../../../../src/components/ui/PageHeader'
import { StatusBadge } from '../../../../../src/components/ui/StatusBadge'
import { useRiderTracking } from '../../../../../src/hooks/useRiderTracking'
import { socket } from '../../../../../src/lib/socket'
import '../../../../../src/lib/axios'

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.PENDING]: OrderStatus.CONFIRMED,
  [OrderStatus.CONFIRMED]: OrderStatus.PREPARING,
  [OrderStatus.PREPARING]: OrderStatus.READY,
}

const NEXT_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PENDING]: 'Accept Order',
  [OrderStatus.CONFIRMED]: 'Mark Preparing',
  [OrderStatus.PREPARING]: 'Mark Ready',
}

/** Threshold (seconds) after which a READY order with no rider in pickup distance flips into "Holding for rider". */
const HOLDING_THRESHOLD_SEC = 90

export default function RestaurantOrderDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelCode, setCancelCode] = useState<CancelReasonCode>('out_of_stock')
  const [cancelNote, setCancelNote] = useState('')
  const [readyWarnOpen, setReadyWarnOpen] = useState(false)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data: restaurantsData } = useQuery({
    queryKey: ['my-restaurants'],
    queryFn: () => myRestaurantApi.list(),
    enabled: isAuthenticated,
  })

  const restaurant = restaurantsData?.data?.data?.[0]
  const restaurantCoords = restaurant?.address?.coordinates?.coordinates
  const restaurantLat = restaurantCoords ? restaurantCoords[1] : null
  const restaurantLng = restaurantCoords ? restaurantCoords[0] : null

  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => myRestaurantApi.getOrderById(id),
    enabled: !!id && isAuthenticated,
  })

  const order = data?.data?.data

  const statusMutation = useMutation({
    mutationFn: (newStatus: OrderStatus) =>
      ordersApi.updateStatus(id, { status: newStatus }),
    onSuccess: () => {
      toast.success('Order status updated')
      void qc.invalidateQueries({ queryKey: ['order', id] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ code, note }: { code: CancelReasonCode; note: string }) => {
      const label = labelForCode(code)
      const text = code === 'other' ? note.trim() : note.trim() ? `${label} — ${note.trim()}` : label
      return ordersApi.updateStatus(id, {
        status: OrderStatus.CANCELLED,
        cancelReasonCode: code,
        cancelReason: text,
      })
    },
    onSuccess: () => {
      toast.success('Order cancelled')
      setCancelModalOpen(false)
      setCancelCode('out_of_stock')
      setCancelNote('')
      void qc.invalidateQueries({ queryKey: ['order', id] })
    },
    onError: () => toast.error('Failed to cancel order'),
  })

  // Auto-refresh this order on status change OR rider assignment
  useEffect(() => {
    if (!id) return
    function refresh(data: { orderId: string }) {
      if (data.orderId === id) void qc.invalidateQueries({ queryKey: ['order', id] })
    }
    socket.on('order:status_update', refresh)
    // Rider acceptance emits rider_assigned (not status_update) — without this
    // the page never re-fetches and order.riderId stays null → false warning
    socket.on('order:rider_assigned', refresh)
    return () => {
      socket.off('order:status_update', refresh)
      socket.off('order:rider_assigned', refresh)
    }
  }, [id, qc])

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

  const nextStatus = NEXT_STATUS[order.status]
  const canCancel = order.status === OrderStatus.PENDING || order.status === OrderStatus.CONFIRMED
  const cancelLabel = order.status === OrderStatus.PENDING ? 'Reject Order' : 'Cancel Order'
  const modalTitle = order.status === OrderStatus.PENDING ? 'Reject order' : 'Cancel order'

  // Lift rider tracking up here so the action button can read live ETA / status
  // and decide whether to warn ("no rider yet") or pace ("rider in 4 min").
  const isPrePickup = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(order.status)
  const showRiderHere = isPrePickup || order.status === OrderStatus.PICKED_UP
  const hasRider = !!order.riderId

  function onNextStatusClick() {
    if (!nextStatus) return
    // Warn only when the chef is about to bag the food but no rider has accepted yet.
    if (order!.status === OrderStatus.PREPARING && !hasRider) {
      setReadyWarnOpen(true)
      return
    }
    statusMutation.mutate(nextStatus)
  }

  return (
    <div>
      <PageHeader
        title={order.orderNumber}
        subtitle={`Placed ${new Date(order.createdAt).toLocaleString('en-NG')}`}
        action={
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={() => {
                const ok = printOrderTicket(order, restaurant?.name ?? 'Restaurant')
                if (!ok) toast.error('Popup blocked — allow pop-ups to print tickets')
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Print kitchen ticket"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              Print
            </button>
            {canCancel && (
              <button
                onClick={() => setCancelModalOpen(true)}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                {cancelLabel}
              </button>
            )}
            {nextStatus && (
              <SmartNextStatusButton
                orderStatus={order.status}
                orderId={order._id}
                riderId={order.riderId}
                restaurantLat={restaurantLat}
                restaurantLng={restaurantLng}
                hasRider={hasRider}
                isPending={statusMutation.isPending}
                onClick={onNextStatusClick}
                label={NEXT_STATUS_LABEL[order.status]!}
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Order Items */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Items</h2>
          <div className="divide-y divide-gray-100">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-start justify-between py-3">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {item.quantity}× {item.name}
                  </p>
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
                <span className="ml-4 font-medium">
                  {formatMoney(item.itemTotal, order.currency)}
                </span>
              </div>
            ))}
          </div>

          {order.customerNote && (
            <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
              <strong>Customer note:</strong> {order.customerNote}
            </div>
          )}
        </div>

        {/* Summary */}
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">Delivery Address</h2>
              {/* Sprint 12 (S12-11): distance + far-delivery chip */}
              <div className="flex items-center gap-1.5">
                {order.deliveryDistanceKm != null && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 tabular-nums">
                    {order.deliveryDistanceKm} km away
                  </span>
                )}
                {order.isFarDelivery && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-800 ring-1 ring-inset ring-amber-300">
                    ★ Far delivery
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-700">{order.deliveryAddress.street}</p>
            <p className="text-sm text-gray-500">{order.deliveryAddress.city}, {order.deliveryAddress.state}</p>
          </div>

          {/* Rider section — only for active orders */}
          {[OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP].includes(order.status) && (
            <RiderCard
              orderId={order._id}
              riderId={order.riderId}
              orderStatus={order.status}
              readyAt={order.status === OrderStatus.READY ? order.updatedAt : null}
              restaurantLat={restaurantLat}
              restaurantLng={restaurantLng}
            />
          )}
        </div>
      </div>

      {/* "Mark Ready with no rider" confirmation modal */}
      {readyWarnOpen && nextStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setReadyWarnOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5 text-amber-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-1 text-base font-bold text-gray-900">No rider has accepted yet</h3>
            <p className="mb-5 text-sm leading-relaxed text-gray-500">
              We&apos;re still searching for a courier. If you bag the food now it may sit
              ~5 min before pickup and lose heat. You can hold for the rider or mark
              ready anyway.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setReadyWarnOpen(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Hold a moment
              </button>
              <button
                onClick={() => { setReadyWarnOpen(false); statusMutation.mutate(nextStatus) }}
                disabled={statusMutation.isPending}
                className="flex-1 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Mark ready anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel/Reject inline modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setCancelModalOpen(false); setCancelNote('') }}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-bold text-gray-900">{modalTitle}</h3>
            <p className="mb-4 text-sm text-gray-500">Choose a reason so the customer sees a clear message.</p>

            <label className="mb-1.5 block text-sm font-medium text-gray-700">Reason</label>
            <select
              value={cancelCode}
              onChange={(e) => setCancelCode(e.target.value as CancelReasonCode)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            >
              {CANCEL_REASON_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>

            {(cancelCode === 'other' || cancelNote.length > 0) && (
              <div className="mt-3">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {cancelCode === 'other' ? 'Details *' : 'Extra note (optional)'}
                </label>
                <textarea
                  rows={3}
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  maxLength={200}
                  placeholder={cancelCode === 'other' ? 'Tell the customer what happened' : 'Anything else the customer should know'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
            )}
            {cancelCode !== 'other' && cancelNote.length === 0 && (
              <button
                type="button"
                onClick={() => setCancelNote(' ')}
                className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                + Add a note for the customer
              </button>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => cancelMutation.mutate({ code: cancelCode, note: cancelNote })}
                disabled={cancelMutation.isPending || (cancelCode === 'other' && cancelNote.trim().length === 0)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Processing…' : modalTitle}
              </button>
              <button
                onClick={() => { setCancelModalOpen(false); setCancelNote('') }}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Keep order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SmartNextStatusButton({
  orderStatus,
  orderId,
  riderId,
  restaurantLat,
  restaurantLng,
  hasRider,
  isPending,
  onClick,
  label,
}: {
  orderStatus: OrderStatus
  orderId: string
  riderId: string | null
  restaurantLat: number | null
  restaurantLng: number | null
  hasRider: boolean
  isPending: boolean
  onClick: () => void
  label: string
}) {
  // Subscribe to rider tracking so the button can show a live ETA hint.
  const { etaMinutes, distanceKm } = useRiderTracking(
    hasRider ? orderId : null,
    riderId,
    restaurantLat,
    restaurantLng,
  )

  // Show ETA next to Mark Ready only when a rider is en route to the restaurant.
  const showEta =
    orderStatus === OrderStatus.PREPARING &&
    hasRider &&
    etaMinutes !== null &&
    distanceKm !== null &&
    distanceKm >= 0.1

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
    >
      {isPending
        ? 'Updating…'
        : showEta
        ? `${label} · rider in ${etaMinutes} min`
        : label}
    </button>
  )
}

function RiderCard({
  orderId,
  riderId,
  orderStatus,
  readyAt,
  restaurantLat,
  restaurantLng,
}: {
  orderId: string
  riderId: string | null
  orderStatus: OrderStatus
  /** When the order entered READY status (used to compute the holding-for-rider escalation). */
  readyAt: string | Date | null
  restaurantLat: number | null
  restaurantLng: number | null
}) {
  const { distanceKm, etaMinutes, status } = useRiderTracking(
    riderId ? orderId : null,
    riderId,
    restaurantLat,
    restaurantLng,
  )

  // Fetch rider contact (name + phone) for the tap-to-call button.
  const { data: contactData } = useQuery({
    queryKey: ['order', orderId, 'rider-contact'],
    queryFn: () => ordersApi.getRiderContact(orderId),
    enabled: !!riderId,
    staleTime: 5 * 60_000,
  })
  const rider: RiderContact | undefined = contactData?.data?.data

  // Tick once per second while the order is READY so the holding banner reveals after the threshold.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (orderStatus !== OrderStatus.READY) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [orderStatus])

  const secondsHolding = orderStatus === OrderStatus.READY && readyAt
    ? Math.floor((now - new Date(readyAt).getTime()) / 1000)
    : 0
  const isHolding =
    orderStatus === OrderStatus.READY &&
    secondsHolding > HOLDING_THRESHOLD_SEC &&
    (distanceKm === null || distanceKm >= 0.1)

  const isPrePickup = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(orderStatus)

  if (!riderId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-900">Rider</h2>
        <div className="flex items-center gap-3 rounded-lg border border-orange-100 bg-orange-50 px-4 py-3">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-orange-800">Dispatching a rider</p>
            <p className="text-xs text-orange-600 mt-0.5">Finding the nearest available rider…</p>
          </div>
        </div>
      </div>
    )
  }

  // Rider assigned
  const contextMsg = orderStatus === OrderStatus.PICKED_UP
    ? 'Order picked up — delivering to customer'
    : isPrePickup
    ? 'Heading to your restaurant to pick up the order'
    : 'En route to customer'

  const distanceLabel = distanceKm === null
    ? 'Locating rider…'
    : distanceKm < 0.1
    ? 'At your door'
    : distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} m away`
    : `${distanceKm.toFixed(1)} km away`

  const dotColor =
    status === 'arrived' ? 'bg-green-500' :
    status === 'nearby' ? 'bg-orange-500' :
    status === 'en_route' ? 'bg-blue-500' :
    'bg-green-400'

  const dotPing = status === 'en_route' || status === 'nearby'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-gray-900">Rider</h2>

      {/* Holding-for-rider banner — appears after order has been Ready for HOLDING_THRESHOLD_SEC */}
      {isHolding && (
        <div className="mb-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900">Holding for rider</p>
            <p className="mt-0.5 text-xs text-amber-800">
              Food has been ready for {Math.floor(secondsHolding / 60)}m {secondsHolding % 60}s.{' '}
              {distanceKm !== null
                ? `Rider is ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away${etaMinutes !== null ? ` · ETA ~${etaMinutes} min` : ''}.`
                : 'Locating rider…'}
            </p>
          </div>
        </div>
      )}

      {/* Rider assigned banner */}
      <div className="mb-3 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
          {rider
            ? `${rider.firstName[0] ?? ''}${rider.lastName[0] ?? ''}`.toUpperCase() || '?'
            : <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="5.5" cy="17.5" r="2" />
                <circle cx="18.5" cy="17.5" r="2" />
                <path strokeLinecap="round" d="M5.5 17.5h-1a2 2 0 01-2-2V14l3-5h9l3 4h1a1 1 0 010 2h-1m-13 2.5V14m7-6.5l2 3.5" />
              </svg>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-green-900">
            {rider ? `${rider.firstName} ${rider.lastName}` : 'Rider assigned'}
          </p>
          <p className="mt-0.5 text-xs text-green-700">
            {rider?.vehicleType && rider?.vehiclePlate
              ? <>{rider.vehicleType[0].toUpperCase() + rider.vehicleType.slice(1)} · <span className="font-mono">{rider.vehiclePlate}</span></>
              : contextMsg}
          </p>
        </div>
        {rider?.phone && (
          <a
            href={`tel:${rider.phone}`}
            className="flex h-9 items-center gap-1.5 rounded-full bg-green-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-green-700"
            title={`Call ${rider.firstName}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Call
          </a>
        )}
      </div>

      {/* Live tracking row */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          {dotPing && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className="flex-1 text-sm font-medium text-gray-700">{distanceLabel}</span>
        {etaMinutes !== null && distanceKm !== null && distanceKm >= 0.1 && (
          <span className="text-xs text-gray-400">~{etaMinutes} min ETA</span>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  children,
  bold,
}: {
  label: string
  value?: string
  children?: React.ReactNode
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-500">{label}</span>
      {children ?? (
        <span className={bold ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}>
          {value}
        </span>
      )}
    </div>
  )
}
