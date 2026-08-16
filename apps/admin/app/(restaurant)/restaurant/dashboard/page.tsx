'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { myRestaurantApi, ordersApi } from '@grandxl/api-client'
import { OrderStatus, RestaurantApprovalStatus, UserRole } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { StatsCard } from '../../../../src/components/ui/StatsCard'
import { DataTable, type Column } from '../../../../src/components/ui/DataTable'
import { StatusBadge } from '../../../../src/components/ui/StatusBadge'
import { socket } from '../../../../src/lib/socket'
import '../../../../src/lib/axios'

function timeAgo(dateStr: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function RestaurantDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()

  // Per-order reject reason state: orderId -> reason string
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  // Which orders have the reject input open
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

  // Pending orders — needs attention
  const { data: pendingOrdersData, isLoading: loadingPending } = useQuery({
    queryKey: ['my-orders', restaurantId, 'pending'],
    queryFn: () => myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.PENDING, limit: 10 }),
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  })

  // Active (confirmed + preparing)
  const { data: activeOrders, isLoading: loadingActive } = useQuery({
    queryKey: ['my-orders', restaurantId, 'active'],
    queryFn: async () => {
      const [c, p] = await Promise.all([
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.CONFIRMED, limit: 50 }),
        myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.PREPARING, limit: 50 }),
      ])
      const confirmed = (c.data?.data?.data ?? []) as Order[]
      const preparing = (p.data?.data?.data ?? []) as Order[]
      return [...confirmed, ...preparing]
    },
    enabled: !!restaurantId,
  })

  const { data: recentOrders, isLoading: loadingRecent } = useQuery({
    queryKey: ['my-orders', restaurantId, 'recent'],
    queryFn: () => myRestaurantApi.getOrders(restaurantId!, { limit: 10 }),
    enabled: !!restaurantId,
  })

  // Socket: invalidate pending query on new order
  useEffect(() => {
    if (!restaurantId) return
    function onNewOrder() {
      void qc.invalidateQueries({ queryKey: ['my-orders', restaurantId, 'pending'] })
    }
    socket.on('order:new', onNewOrder)
    return () => { socket.off('order:new', onNewOrder) }
  }, [restaurantId, qc])

  const toggleMutation = useMutation({
    mutationFn: (isOpen: boolean) =>
      myRestaurantApi.update(restaurantId!, { isOpen } as Parameters<typeof myRestaurantApi.update>[1]),
    onSuccess: (_, isOpen) => {
      toast.success(isOpen ? 'Restaurant is now open' : 'Restaurant is now closed')
      void qc.invalidateQueries({ queryKey: ['my-restaurants'] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  const submitReviewMutation = useMutation({
    mutationFn: () => myRestaurantApi.submitForReview(restaurantId!),
    onSuccess: () => {
      toast.success('Submitted for review')
      void qc.invalidateQueries({ queryKey: ['my-restaurants'] })
    },
    onError: () => toast.error('Submission failed'),
  })

  const acceptMutation = useMutation({
    mutationFn: (orderId: string) =>
      ordersApi.updateStatus(orderId, { status: OrderStatus.CONFIRMED }),
    onSuccess: () => {
      toast.success('Order accepted')
      void qc.invalidateQueries({ queryKey: ['my-orders', restaurantId, 'pending'] })
      void qc.invalidateQueries({ queryKey: ['my-orders', restaurantId, 'active'] })
    },
    onError: () => toast.error('Failed to accept order'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      ordersApi.updateStatus(orderId, { status: OrderStatus.CANCELLED, cancelReason: reason || 'Rejected by restaurant' }),
    onSuccess: (_, { orderId }) => {
      toast.success('Order rejected')
      setRejectOpen((prev) => ({ ...prev, [orderId]: false }))
      setRejectReasons((prev) => ({ ...prev, [orderId]: '' }))
      void qc.invalidateQueries({ queryKey: ['my-orders', restaurantId, 'pending'] })
    },
    onError: () => toast.error('Failed to reject order'),
  })

  const pendingList = (pendingOrdersData?.data?.data?.data ?? []) as Order[]
  const recentList = (recentOrders?.data?.data?.data ?? []) as Order[]

  const todayRevenue = recentList
    .filter((o) => {
      const d = new Date(o.createdAt)
      const now = new Date()
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, o) => sum + o.pricing.total, 0)

  const ordersToday = recentList.filter((o) => {
    const d = new Date(o.createdAt)
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const orderColumns: Column<Order>[] = [
    { key: 'number', header: 'Order #', render: (o) => <span className="font-mono text-xs font-semibold">{o.orderNumber}</span> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge label={o.status} orderStatus={o.status} /> },
    { key: 'items', header: 'Items', render: (o) => <span>{o.items.length} item(s)</span> },
    { key: 'total', header: 'Total', render: (o) => <span className="font-semibold">{formatMoney(o.pricing.total, o.currency)}</span> },
    { key: 'date', header: 'Time', render: (o) => <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span> },
  ]

  if (isInitializing) return null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const approvalStatus = restaurant?.approvalStatus

  return (
    <div className="space-y-6">
      {/* Approval banners */}
      {approvalStatus === RestaurantApprovalStatus.PENDING_REVIEW && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-900">Application under review</p>
            <p className="mt-0.5 text-xs text-amber-700">Our team is reviewing your restaurant. You&apos;ll be notified once approved.</p>
          </div>
        </div>
      )}

      {approvalStatus === RestaurantApprovalStatus.INFO_REQUESTED && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-orange-900">More information needed</p>
              {restaurant?.approvalNote && <p className="mt-0.5 text-xs leading-relaxed text-orange-800">{restaurant.approvalNote}</p>}
              <p className="mt-1 text-xs text-orange-700">Update your details in Settings and resubmit.</p>
            </div>
          </div>
          <button
            onClick={() => submitReviewMutation.mutate()}
            disabled={submitReviewMutation.isPending}
            className="flex-shrink-0 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
          >
            {submitReviewMutation.isPending ? 'Submitting…' : 'Resubmit'}
          </button>
        </div>
      )}

      {approvalStatus === RestaurantApprovalStatus.REJECTED && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-900">Application rejected</p>
              {restaurant?.approvalNote && <p className="mt-0.5 text-xs text-red-700">{restaurant.approvalNote}</p>}
            </div>
          </div>
          <button
            onClick={() => submitReviewMutation.mutate()}
            disabled={submitReviewMutation.isPending}
            className="flex-shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {submitReviewMutation.isPending ? 'Submitting…' : 'Resubmit'}
          </button>
        </div>
      )}

      {approvalStatus === RestaurantApprovalStatus.SUSPENDED && (
        <div className="flex items-start gap-3 rounded-xl border border-gray-300 bg-gray-100 px-4 py-3.5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-gray-900">Restaurant suspended</p>
            {restaurant?.approvalNote && <p className="mt-0.5 text-xs text-gray-600">{restaurant.approvalNote}</p>}
            <p className="mt-0.5 text-xs text-gray-500">Contact support to reinstate your account.</p>
          </div>
        </div>
      )}

      {/* Greeting + open/close toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {greeting}, {user?.firstName ?? 'Chef'}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {restaurant ? restaurant.name : 'Your restaurant overview'}
          </p>
        </div>

        {restaurant && approvalStatus === RestaurantApprovalStatus.APPROVED && (
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            restaurant.isOpen ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
          }`}>
            <div>
              <p className="text-xs font-medium text-gray-500">Status</p>
              <p className={`text-sm font-bold ${restaurant.isOpen ? 'text-green-700' : 'text-gray-500'}`}>
                {restaurant.isOpen ? 'Open for orders' : 'Closed'}
              </p>
            </div>
            <button
              onClick={() => toggleMutation.mutate(!restaurant.isOpen)}
              disabled={toggleMutation.isPending}
              className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                restaurant.isOpen ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                restaurant.isOpen ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        )}
      </div>

      {/* Needs Attention — urgent PENDING orders */}
      {(loadingPending || pendingList.length > 0) && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <h2 className="text-sm font-bold text-red-800">
              {loadingPending ? 'Loading orders…' : `${pendingList.length} order${pendingList.length !== 1 ? 's' : ''} need${pendingList.length === 1 ? 's' : ''} attention`}
            </h2>
          </div>

          {loadingPending && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-red-100" />)}
            </div>
          )}

          {!loadingPending && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingList.map((order) => {
                const isRejectOpen = rejectOpen[order._id] ?? false
                const rejectReason = rejectReasons[order._id] ?? ''
                const itemSummary = order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')

                return (
                  <div key={order._id} className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-bold text-gray-900">{order.orderNumber}</span>
                        <span className="ml-2 text-xs text-red-500 font-medium">{timeAgo(order.createdAt)}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{formatMoney(order.pricing.total, order.currency)}</span>
                    </div>

                    <p className="mb-3 line-clamp-2 text-xs text-gray-600">
                      {itemSummary.length > 70 ? itemSummary.slice(0, 70) + '…' : itemSummary}
                    </p>

                    {!isRejectOpen ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptMutation.mutate(order._id)}
                          disabled={acceptMutation.isPending}
                          className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => setRejectOpen((prev) => ({ ...prev, [order._id]: true }))}
                          className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReasons((prev) => ({ ...prev, [order._id]: e.target.value }))}
                          placeholder="Out of stock"
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => rejectMutation.mutate({ orderId: order._id, reason: rejectReason })}
                            disabled={rejectMutation.isPending}
                            className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirm Reject
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
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Today's Revenue" value={formatMoney(todayRevenue, restaurant?.currency ?? 'NGN')} icon="revenue" loading={loadingRecent} />
        <StatsCard title="Orders Today" value={ordersToday} icon="orders" loading={loadingRecent} />
        <StatsCard
          title="Pending"
          value={pendingList.length}
          icon="active"
          loading={loadingPending}
        />
        <StatsCard title="Active in Kitchen" value={activeOrders?.length ?? 0} icon="active" loading={loadingActive} />
      </div>

      {/* Recent orders */}
      <div>
        <h2 className="mb-1 text-base font-semibold text-gray-900">Recent Orders</h2>
        <p className="mb-4 text-xs text-gray-400">Latest activity for your restaurant</p>
        <DataTable
          columns={orderColumns}
          data={recentList}
          loading={loadingRecent}
          emptyMessage="No orders yet"
          onRowClick={(o) => router.push(`/restaurant/orders/${o._id}`)}
        />
      </div>
    </div>
  )
}
