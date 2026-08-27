'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { myRestaurantApi, ordersApi } from '@grandxl/api-client'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { CancelReasonCode, Order } from '@grandxl/types'
import { CANCEL_REASON_OPTIONS, labelForCode } from '../../../../src/lib/cancelReasons'
import { printOrderTicket } from '../../../../src/lib/orderTicket'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { DataTable, type Column } from '../../../../src/components/ui/DataTable'
import { StatusBadge } from '../../../../src/components/ui/StatusBadge'
import { OrderLifecycleStrip } from '../../../../src/components/restaurant/OrderLifecycleStrip'
import { DispatchStatus } from '../../../../src/components/restaurant/DispatchStatus'
import { motion } from 'framer-motion'
import '../../../../src/lib/axios'

const ACTIVE_STATUSES = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY]

const STATUS_TABS: { label: string; value: 'live' | OrderStatus | undefined }[] = [
  { label: 'Live',      value: 'live'                   },
  { label: 'All',       value: undefined                },
  { label: 'Pending',   value: OrderStatus.PENDING      },
  { label: 'Confirmed', value: OrderStatus.CONFIRMED    },
  { label: 'Preparing', value: OrderStatus.PREPARING    },
  { label: 'Ready',     value: OrderStatus.READY        },
  { label: 'Delivered', value: OrderStatus.DELIVERED    },
  { label: 'Cancelled', value: OrderStatus.CANCELLED    },
]

const STATUS_GROUP_LABEL: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.CONFIRMED]: 'Confirmed — Rider coming',
  [OrderStatus.PREPARING]: 'Preparing',
  [OrderStatus.READY]:     'Ready for pickup',
}

function timeAgo(dateStr: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function isStale(order: Order): boolean {
  if (order.status !== OrderStatus.CONFIRMED) return false
  if (order.riderId) return false
  const ageMs = Date.now() - new Date(order.updatedAt).getTime()
  return ageMs > 90 * 60 * 1000
}

export default function RestaurantOrdersPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'live' | OrderStatus | undefined>('live')
  const [page, setPage] = useState(1)
  const [confirmClear, setConfirmClear] = useState(false)
  // Per-order reject state: structured code + optional free-text note ("other")
  const [rejectCode, setRejectCode] = useState<Record<string, CancelReasonCode>>({})
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({})
  const [rejectOpen, setRejectOpen] = useState<Record<string, boolean>>({})

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
  const restaurantId = restaurant?._id
  const restaurantCoords = restaurant?.address?.coordinates?.coordinates
  const restaurantLat = restaurantCoords ? restaurantCoords[1] : null
  const restaurantLng = restaurantCoords ? restaurantCoords[0] : null

  // Live: fetch PENDING + CONFIRMED + PREPARING + READY — 10s polling so kitchen never misses an update
  const { data: liveData, isLoading: liveLoading, isError: liveError, refetch: refetchLive } = useQuery({
    queryKey: ['my-orders-live', restaurantId],
    queryFn: async () => {
      const [p, c, pr, r] = await Promise.all([
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.PENDING,    limit: 20 }),
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.CONFIRMED,  limit: 50 }),
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.PREPARING,  limit: 50 }),
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.READY,      limit: 50 }),
      ])
      return {
        pending:   (p.data?.data?.data ?? []) as Order[],
        active: [
          ...(c.data?.data?.data ?? []),
          ...(pr.data?.data?.data ?? []),
          ...(r.data?.data?.data ?? []),
        ] as Order[],
      }
    },
    enabled: !!restaurantId && activeTab === 'live',
    refetchInterval: 10_000,
    retry: 3,
  })

  // Other tabs: normal paginated fetch
  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', restaurantId, activeTab, page],
    queryFn: () =>
      myRestaurantApi.getOrders(restaurantId!, {
        status: activeTab as OrderStatus | undefined,
        page,
        limit: 20,
      }),
    enabled: !!restaurantId && activeTab !== 'live',
  })

  const acceptMutation = useMutation({
    mutationFn: (orderId: string) =>
      ordersApi.updateStatus(orderId, { status: OrderStatus.CONFIRMED }),
    onSuccess: () => {
      toast.success('Order accepted')
      void qc.invalidateQueries({ queryKey: ['my-orders-live', restaurantId] })
    },
    onError: () => toast.error('Failed to accept order'),
  })

  const clearMutation = useMutation({
    mutationFn: () => myRestaurantApi.clearOrderHistory(restaurantId!),
    onSuccess: (res) => {
      const n = res.data?.data?.cleared ?? 0
      toast.success(`${n} order${n !== 1 ? 's' : ''} cleared from history`)
      setConfirmClear(false)
      void qc.invalidateQueries({ queryKey: ['my-orders'] })
    },
    onError: () => toast.error('Failed to clear history'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ orderId, code, note }: { orderId: string; code: CancelReasonCode; note: string }) => {
      // For "other" the note is the whole message; for everything else we send
      // the human-readable label so customers see the same thing the restaurant
      // picked, and append the note when they typed one.
      const label = labelForCode(code)
      const text = code === 'other' ? note.trim() : note.trim() ? `${label} — ${note.trim()}` : label
      return ordersApi.updateStatus(orderId, {
        status: OrderStatus.CANCELLED,
        cancelReasonCode: code,
        cancelReason: text,
      })
    },
    onSuccess: (_, { orderId }) => {
      toast.success('Order rejected')
      setRejectOpen((prev) => ({ ...prev, [orderId]: false }))
      setRejectNote((prev) => ({ ...prev, [orderId]: '' }))
      void qc.invalidateQueries({ queryKey: ['my-orders-live', restaurantId] })
    },
    onError: () => toast.error('Failed to reject order'),
  })

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Order #',
      render: (o) => <span className="font-mono text-xs font-semibold text-gray-900">{o.orderNumber}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => <StatusBadge label={o.status} orderStatus={o.status} />,
    },
    {
      key: 'items',
      header: 'Items',
      render: (o) => (
        <span className="text-sm text-gray-500">
          {o.items.map((i) => i.name).join(', ').slice(0, 40)}
          {o.items.map((i) => i.name).join(', ').length > 40 ? '…' : ''}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (o) => <span className="font-semibold">{formatMoney(o.pricing.total, o.currency)}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (o) => (
        <span className="text-xs text-gray-400">
          {new Date(o.createdAt).toLocaleDateString('en-NG', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      ),
    },
  ]

  const pendingCount = liveData?.pending.length ?? 0
  const activeCount = liveData?.active.length ?? 0
  const liveCount = pendingCount + activeCount

  if (isInitializing) return null

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Orders" subtitle="Your restaurant's orders" />
        {activeTab !== 'live' && restaurantId && (
          <button
            onClick={() => setConfirmClear(true)}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:border-red-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Clear History
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-0 border-b border-gray-200">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value
          return (
            <button
              key={tab.label}
              onClick={() => { setActiveTab(tab.value); setPage(1) }}
              className={`relative border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.value === 'live' && liveCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white">
                  {liveCount}
                </span>
              )}
              {tab.value === 'live' && (
                <span className="ml-1.5 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 align-middle" />
              )}
            </button>
          )
        })}
      </div>

      {/* Live view */}
      {activeTab === 'live' && (
        <>
          {/* Live tab header with manual refresh */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {liveLoading ? 'Refreshing…' : liveError ? 'Could not load orders' : `${liveCount} active order${liveCount === 1 ? '' : 's'}`}
            </p>
            <button
              onClick={() => void refetchLive()}
              disabled={liveLoading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
            >
              <svg className={`h-3.5 w-3.5 ${liveLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {liveLoading && !liveData && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          )}

          {liveError && !liveLoading && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50 py-16 text-center">
              <svg className="mb-3 h-10 w-10 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-medium text-red-500">Could not load orders</p>
              <p className="mt-1 text-sm text-red-400">Server may be reconnecting — your orders are safe</p>
              <button
                onClick={() => void refetchLive()}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
              >
                Try again
              </button>
            </div>
          )}

          {!liveLoading && !liveError && liveCount === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
              <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="font-medium text-gray-400">No active orders right now</p>
              <p className="mt-1 text-sm text-gray-400">New orders will appear here automatically</p>
            </div>
          )}

          {!liveError && liveData && liveCount > 0 && (
            <div className="space-y-6">
              {/* Pending group — needs attention */}
              {liveData.pending.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-500">
                    Needs Attention ({liveData.pending.length})
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {liveData.pending.map((order) => {
                      const isRejectOpen = rejectOpen[order._id] ?? false
                      const code = rejectCode[order._id] ?? 'out_of_stock'
                      const note = rejectNote[order._id] ?? ''
                      const noteRequired = code === 'other'
                      const canConfirm = !noteRequired || note.trim().length > 0
                      const itemSummary = order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')

                      return (
                        <div
                          key={order._id}
                          className="rounded-xl border-2 border-red-300 bg-white p-4 shadow-sm"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono text-sm font-bold text-gray-900">{order.orderNumber}</span>
                              <span className="ml-2 text-xs text-red-500 font-medium">{timeAgo(order.createdAt)}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{formatMoney(order.pricing.total, order.currency)}</span>
                          </div>

                          {/* Sprint 12 (S12-11): distance + far-delivery signalling */}
                          {(order.deliveryDistanceKm != null || order.isFarDelivery) && (
                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                              {order.deliveryDistanceKm != null && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 tabular-nums">
                                  {order.deliveryDistanceKm} km away
                                </span>
                              )}
                              {order.isFarDelivery && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-800 ring-1 ring-inset ring-amber-300">
                                  ★ Far delivery
                                </span>
                              )}
                            </div>
                          )}

                          <p className="mb-3 line-clamp-2 text-xs text-gray-600">
                            {itemSummary.length > 70 ? itemSummary.slice(0, 70) + '…' : itemSummary}
                          </p>

                          {!isRejectOpen ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => acceptMutation.mutate(order._id)}
                                disabled={acceptMutation.isPending}
                                className="flex-1 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const ok = printOrderTicket(order, restaurant?.name ?? 'Restaurant')
                                  if (!ok) toast.error('Popup blocked — allow pop-ups to print tickets')
                                }}
                                className="rounded-full border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                                aria-label="Print kitchen ticket"
                                title="Print kitchen ticket"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-3.5 w-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setRejectOpen((prev) => ({ ...prev, [order._id]: true }))
                                }}
                                className="text-xs font-medium text-red-600 underline hover:text-red-800"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <label className="block">
                                <span className="sr-only">Reason for rejection</span>
                                <select
                                  value={code}
                                  onChange={(e) =>
                                    setRejectCode((prev) => ({
                                      ...prev,
                                      [order._id]: e.target.value as CancelReasonCode,
                                    }))
                                  }
                                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                                >
                                  {CANCEL_REASON_OPTIONS.map((opt) => (
                                    <option key={opt.code} value={opt.code}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              {noteRequired && (
                                <input
                                  type="text"
                                  value={note}
                                  onChange={(e) =>
                                    setRejectNote((prev) => ({ ...prev, [order._id]: e.target.value }))
                                  }
                                  placeholder="Tell the customer what happened"
                                  maxLength={200}
                                  autoFocus
                                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                                />
                              )}

                              <div className="flex gap-2">
                                <button
                                  onClick={() => rejectMutation.mutate({ orderId: order._id, code, note })}
                                  disabled={rejectMutation.isPending || !canConfirm}
                                  className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setRejectOpen((prev) => ({ ...prev, [order._id]: false }))}
                                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Active groups (confirmed / preparing / ready) */}
              {ACTIVE_STATUSES.map((s) => {
                const group = liveData.active.filter((o) => o.status === s)
                if (group.length === 0) return null
                return (
                  <div key={s}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {STATUS_GROUP_LABEL[s]}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.map((order) => (
                        <LiveOrderCard
                          key={order._id}
                          order={order}
                          restaurantLat={restaurantLat}
                          restaurantLng={restaurantLng}
                          stale={isStale(order)}
                          onClick={() => router.push(`/restaurant/orders/${order._id}`)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Normal table view */}
      {activeTab !== 'live' && (
        <DataTable
          columns={columns}
          data={(data?.data?.data?.data ?? []) as Order[]}
          loading={isLoading}
          total={data?.data?.data?.meta?.total}
          page={page}
          limit={20}
          onPageChange={setPage}
          onRowClick={(o) => router.push(`/restaurant/orders/${o._id}`)}
          emptyMessage="No orders found"
        />
      )}

      {/* Confirm clear modal */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="mb-1 text-lg font-semibold text-gray-900">Clear order history?</h3>
            <p className="mb-6 text-sm text-gray-500">
              All <span className="font-medium text-gray-700">delivered</span> and <span className="font-medium text-gray-700">cancelled</span> orders will be removed from your view. This cannot be undone. Live and active orders are not affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {clearMutation.isPending ? 'Clearing…' : 'Yes, clear history'}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                disabled={clearMutation.isPending}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LiveOrderCard({
  order,
  restaurantLat,
  restaurantLng,
  stale,
  onClick,
}: {
  order: Order
  restaurantLat: number | null
  restaurantLng: number | null
  stale: boolean
  onClick: () => void
}) {
  const itemSummary = order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')
  const isActive = ACTIVE_STATUSES.includes(order.status)
  const hasRider = !!order.riderId && isActive
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
  const minutesSincePlaced = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60_000))

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, boxShadow: '0 12px 32px -16px rgb(0 0 0 / 0.18)' }}
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all"
    >
      {/* Accent strip — pulses for live orders */}
      <div className="absolute inset-y-0 left-0 w-1 overflow-hidden">
        <motion.div
          className="h-full w-full"
          style={{
            background: order.status === OrderStatus.CONFIRMED && !hasRider
              ? '#f97316'
              : order.status === OrderStatus.PREPARING ? '#f59e0b'
              : order.status === OrderStatus.READY ? '#10b981'
              : hasRider ? '#3b82f6'
              : '#e5e7eb',
          }}
          animate={order.status === OrderStatus.CONFIRMED && !hasRider ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      </div>

      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-extrabold tracking-tight text-gray-900">{order.orderNumber}</span>
            <span className="text-[11px] text-gray-400">· {timeAgo(order.createdAt)}</span>
            {stale && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                ⚠ Stale
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {itemCount} item{itemCount === 1 ? '' : 's'} · {formatMoney(order.pricing.total, order.currency)}
          </p>
        </div>
        <StatusBadge label={order.status} orderStatus={order.status} />
      </div>

      {/* Items */}
      <p className="mb-4 line-clamp-2 pl-2 text-xs leading-relaxed text-gray-600">
        {itemSummary.length > 90 ? itemSummary.slice(0, 90) + '…' : itemSummary}
      </p>

      {/* Lifecycle strip */}
      <div className="mb-3 pl-2 pr-1">
        <OrderLifecycleStrip status={order.status} hasRider={hasRider} />
      </div>

      {/* Dispatch status panel */}
      {isActive && (
        <div className="pl-2">
          <DispatchStatus
            orderId={order._id}
            status={order.status}
            riderId={order.riderId}
            restaurantLat={restaurantLat}
            restaurantLng={restaurantLng}
            searchingForMinutes={minutesSincePlaced}
            readyAt={order.status === OrderStatus.READY ? order.updatedAt : null}
          />
        </div>
      )}
    </motion.button>
  )
}
