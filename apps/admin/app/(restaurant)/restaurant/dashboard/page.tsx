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
import { StatusBadge } from '../../../../src/components/ui/StatusBadge'
import { socket } from '../../../../src/lib/socket'
import {
  TrendingUp, ShoppingBag, Clock, Flame, ChevronRight,
  AlertTriangle, MessageSquare, RefreshCw, CheckCircle2, XCircle,
  AlertCircle, Ban, Info,
} from 'lucide-react'
import '../../../../src/lib/axios'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function isToday(dateStr: string | Date): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, loading }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
  loading?: boolean
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        {loading ? (
          <div className="mt-2 h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
        ) : (
          <p className="mt-1.5 text-3xl font-bold leading-none tracking-tight text-gray-900 tabular-nums">
            {value}
          </p>
        )}
        {sub && !loading && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

// ── Pending order card ────────────────────────────────────────────────────────

function PendingOrderCard({
  order,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: {
  order: Order
  onAccept: () => void
  onReject: (reason: string) => void
  accepting: boolean
  rejecting: boolean
}) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')

  const itemSummary = order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')

  return (
    <div className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
      {/* Urgent header */}
      <div className="bg-orange-50 border-b border-orange-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-sm font-bold text-gray-900">{order.orderNumber}</span>
          <span className="text-xs text-orange-600 font-medium">{timeAgo(order.createdAt)}</span>
        </div>
        <span className="text-sm font-bold text-gray-900">{formatMoney(order.pricing.total, order.currency)}</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Items */}
        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
          {itemSummary}
        </p>

        {/* Note */}
        {order.items.some((i) => i.note) && (
          <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2">
            <MessageSquare size={11} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 leading-snug line-clamp-2">
              {order.items.find((i) => i.note)?.note}
            </p>
          </div>
        )}

        {/* Actions */}
        {!rejectOpen ? (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onAccept}
              disabled={accepting || rejecting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 active:bg-green-800 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {accepting ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Accept
            </button>
            <button
              onClick={() => setRejectOpen(true)}
              disabled={accepting || rejecting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <XCircle size={13} />
              Reject
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (e.g. Out of stock)"
              autoFocus
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 transition"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onReject(reason)
                  setRejectOpen(false)
                }}
                disabled={rejecting}
                className="flex-1 rounded-xl bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {rejecting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => { setRejectOpen(false); setReason('') }}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Approval banner ───────────────────────────────────────────────────────────

function Banner({ icon, color, title, body, action }: {
  icon: React.ReactNode
  color: string
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl border px-5 py-4 ${color}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs mt-0.5 leading-relaxed opacity-80">{body}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RestaurantDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()

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

  // Pending orders
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
      return [
        ...((c.data?.data?.data ?? []) as Order[]),
        ...((p.data?.data?.data ?? []) as Order[]),
      ]
    },
    enabled: !!restaurantId,
  })

  // Recent orders
  const { data: recentOrders, isLoading: loadingRecent } = useQuery({
    queryKey: ['my-orders', restaurantId, 'recent'],
    queryFn: () => myRestaurantApi.getOrders(restaurantId!, { limit: 10 }),
    enabled: !!restaurantId,
  })

  // Socket: invalidate pending on new order
  useEffect(() => {
    if (!restaurantId) return
    function onNewOrder() {
      void qc.invalidateQueries({ queryKey: ['my-orders', restaurantId, 'pending'] })
    }
    socket.on('order:new', onNewOrder)
    return () => { socket.off('order:new', onNewOrder) }
  }, [restaurantId, qc])

  // Mutations
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
      ordersApi.updateStatus(orderId, {
        status: OrderStatus.CANCELLED,
        cancelReason: reason || 'Rejected by restaurant',
      }),
    onSuccess: () => {
      toast.success('Order rejected')
      void qc.invalidateQueries({ queryKey: ['my-orders', restaurantId, 'pending'] })
    },
    onError: () => toast.error('Failed to reject order'),
  })

  const pendingList = (pendingOrdersData?.data?.data?.data ?? []) as Order[]
  const recentList  = (recentOrders?.data?.data?.data ?? []) as Order[]

  const todayRevenue = recentList
    .filter((o) => isToday(o.createdAt))
    .reduce((sum, o) => sum + o.pricing.total, 0)

  const ordersToday = recentList.filter((o) => isToday(o.createdAt)).length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const approvalStatus = restaurant?.approvalStatus

  const resubmitBtn = (
    <button
      onClick={() => submitReviewMutation.mutate()}
      disabled={submitReviewMutation.isPending}
      className="rounded-xl border border-current/30 bg-white/80 px-3.5 py-2 text-xs font-semibold hover:bg-white disabled:opacity-50 cursor-pointer transition-colors"
    >
      {submitReviewMutation.isPending ? 'Submitting…' : 'Resubmit'}
    </button>
  )

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      {/* Approval banners */}
      {approvalStatus === RestaurantApprovalStatus.PENDING_REVIEW && (
        <Banner
          icon={<Clock size={16} className="text-amber-600" />}
          color="border-amber-200 bg-amber-50 text-amber-900"
          title="Application under review"
          body="Our team is reviewing your restaurant. You'll be notified once approved — usually within 24 hours."
        />
      )}

      {approvalStatus === RestaurantApprovalStatus.INFO_REQUESTED && (
        <Banner
          icon={<Info size={16} className="text-orange-600" />}
          color="border-orange-200 bg-orange-50 text-orange-900"
          title="More information needed"
          body={restaurant?.approvalNote ?? 'Please update your details in Settings and resubmit for review.'}
          action={resubmitBtn}
        />
      )}

      {approvalStatus === RestaurantApprovalStatus.REJECTED && (
        <Banner
          icon={<AlertCircle size={16} className="text-red-500" />}
          color="border-red-200 bg-red-50 text-red-900"
          title="Application rejected"
          body={restaurant?.approvalNote ?? 'Your application was not approved. Please update and resubmit.'}
          action={resubmitBtn}
        />
      )}

      {approvalStatus === RestaurantApprovalStatus.SUSPENDED && (
        <Banner
          icon={<Ban size={16} className="text-gray-500" />}
          color="border-gray-200 bg-gray-100 text-gray-800"
          title="Restaurant suspended"
          body={restaurant?.approvalNote ?? 'Contact support to reinstate your account.'}
        />
      )}

      {/* Greeting + open/close toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {greeting}, {user?.firstName ?? 'Chef'}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {restaurant?.name ?? 'Your restaurant overview'}
          </p>
        </div>

        {restaurant && approvalStatus === RestaurantApprovalStatus.APPROVED && (
          <button
            onClick={() => toggleMutation.mutate(!restaurant.isOpen)}
            disabled={toggleMutation.isPending}
            className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 transition-all cursor-pointer disabled:opacity-60 self-start ${
              restaurant.isOpen
                ? 'border-green-200 bg-green-50 hover:bg-green-100'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div
              className={`relative h-6 w-11 rounded-full transition-colors ${
                restaurant.isOpen ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                restaurant.isOpen ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-gray-500 leading-none">Restaurant</p>
              <p className={`text-sm font-bold mt-0.5 ${restaurant.isOpen ? 'text-green-700' : 'text-gray-600'}`}>
                {restaurant.isOpen ? 'Open for orders' : 'Currently closed'}
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Needs Attention — pending orders */}
      {(loadingPending || pendingList.length > 0) && (
        <div className="rounded-2xl border-2 border-orange-200 bg-orange-50/50 p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-bold text-gray-900">
              {loadingPending
                ? 'Loading new orders…'
                : `${pendingList.length} order${pendingList.length !== 1 ? 's' : ''} need${pendingList.length === 1 ? 's' : ''} your attention`}
            </h2>
            <span className="ml-auto text-xs text-gray-400">Refreshes every 30s</span>
          </div>

          {loadingPending ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-orange-100/60" />)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingList.map((order) => (
                <PendingOrderCard
                  key={order._id}
                  order={order}
                  onAccept={() => acceptMutation.mutate(order._id)}
                  onReject={(reason) => rejectMutation.mutate({ orderId: order._id, reason })}
                  accepting={acceptMutation.isPending && acceptMutation.variables === order._id}
                  rejecting={rejectMutation.isPending && rejectMutation.variables?.orderId === order._id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<TrendingUp size={20} className="text-green-600" />}
          label="Today's Revenue"
          value={formatMoney(todayRevenue, restaurant?.currency ?? 'NGN')}
          sub="From today's orders"
          color="bg-green-50"
          loading={loadingRecent}
        />
        <StatCard
          icon={<ShoppingBag size={20} className="text-violet-600" />}
          label="Orders Today"
          value={ordersToday}
          color="bg-violet-50"
          loading={loadingRecent}
        />
        <StatCard
          icon={<AlertTriangle size={20} className="text-amber-500" />}
          label="Pending"
          value={pendingList.length}
          sub={pendingList.length > 0 ? 'Needs action now' : 'All clear'}
          color="bg-amber-50"
          loading={loadingPending}
        />
        <StatCard
          icon={<Flame size={20} className="text-orange-500" />}
          label="In Kitchen"
          value={activeOrders?.length ?? 0}
          sub="Being prepared"
          color="bg-orange-50"
          loading={loadingActive}
        />
      </div>

      {/* Recent orders table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Recent Orders</h2>
            <p className="text-xs text-gray-400 mt-0.5">Latest activity for your restaurant</p>
          </div>
          <button
            onClick={() => router.push('/restaurant/orders')}
            className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 cursor-pointer transition-colors"
          >
            View all <ChevronRight size={13} />
          </button>
        </div>

        {loadingRecent ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : recentList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 px-6 text-center">
            <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={24} className="text-gray-200" />
            </div>
            <p className="font-semibold text-gray-600 text-sm">No orders yet</p>
            <p className="text-xs text-gray-400 mt-1.5">
              {approvalStatus === RestaurantApprovalStatus.APPROVED
                ? 'Your first order will appear here once customers start ordering.'
                : 'Orders will appear here once your restaurant is approved.'}
            </p>
            {/* Sprint 12 (S12-14): action CTA for approved restaurants — a
                populated, well-priced menu is the load-bearing prerequisite for
                orders. Points the owner at the next useful action instead of
                just describing the empty state. */}
            {approvalStatus === RestaurantApprovalStatus.APPROVED && (
              <button
                onClick={() => router.push('/restaurant/menu')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 cursor-pointer transition-colors"
              >
                Go to menu
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            {/* Sprint 12 (S12-13): horizontal-scroll wrapper so the 5-column grid
                stays readable on phones instead of squishing or overflowing the
                page. Rows still align to the header because both share the same
                grid template inside the same scrolling container. */}
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-gray-50">
                  {['Order #', 'Status', 'Items', 'Total', 'Time'].map((h) => (
                    <span key={h} className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{h}</span>
                  ))}
                </div>
                {/* Rows */}
                {recentList.map((o, idx) => (
                  <button
                    key={o._id}
                    onClick={() => router.push(`/restaurant/orders/${o._id}`)}
                    className={`w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3.5 text-left hover:bg-gray-50/60 transition-colors cursor-pointer ${
                      idx !== recentList.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <span className="font-mono text-sm font-semibold text-gray-900 whitespace-nowrap">{o.orderNumber}</span>
                    <StatusBadge label={o.status} orderStatus={o.status} />
                    <span className="text-sm text-gray-500 whitespace-nowrap">{o.items.length} item{o.items.length !== 1 ? 's' : ''}</span>
                    <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{formatMoney(o.pricing.total, o.currency)}</span>
                    <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
