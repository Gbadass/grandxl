'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { UserRole, OrderStatus, RestaurantApprovalStatus } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { adminOrdersApi, adminRestaurantsApi, adminRidersApi, adminUsersApi } from '@grandxl/api-client'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import '../../../src/lib/axios'

// ── Helpers ────────────────────────────────────────────────────────────────────

function startOf(unit: 'day' | 'week' | 'month'): Date {
  const d = new Date()
  if (unit === 'day')   { d.setHours(0, 0, 0, 0); return d }
  if (unit === 'week')  { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d }
  d.setDate(1); d.setHours(0, 0, 0, 0); return d
}

const STATUS_LABEL: Record<string, string> = {
  [OrderStatus.PENDING]:    'Pending',
  [OrderStatus.CONFIRMED]:  'Confirmed',
  [OrderStatus.PREPARING]:  'Preparing',
  [OrderStatus.READY]:      'Ready',
  [OrderStatus.PICKED_UP]:  'On the way',
  [OrderStatus.DELIVERED]:  'Delivered',
  [OrderStatus.CANCELLED]:  'Cancelled',
}

const STATUS_COLOR: Record<string, string> = {
  [OrderStatus.PENDING]:    'bg-amber-500',
  [OrderStatus.CONFIRMED]:  'bg-blue-500',
  [OrderStatus.PREPARING]:  'bg-orange-500',
  [OrderStatus.READY]:      'bg-teal-500',
  [OrderStatus.PICKED_UP]:  'bg-violet-500',
  [OrderStatus.DELIVERED]:  'bg-green-500',
  [OrderStatus.CANCELLED]:  'bg-red-500',
}

// ── Simple bar chart using divs ────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-gray-500">
            {d.value > 0 ? d.value.toLocaleString() : ''}
          </span>
          <div
            className={`w-full rounded-t-md transition-all ${d.color ?? 'bg-orange-400'}`}
            style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
          />
          <span className="text-[10px] text-gray-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Donut chart using SVG ──────────────────────────────────────────────────────

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0) return <div className="flex h-32 items-center justify-center text-sm text-gray-400">No data</div>

  let offset = 0
  const r = 40
  const circumference = 2 * Math.PI * r

  return (
    <div className="flex items-center gap-6">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="20" />
        {slices.filter((s) => s.value > 0).map((slice) => {
          const pct   = slice.value / total
          const dash  = pct * circumference
          const gap   = circumference - dash
          const el    = (
            <circle
              key={slice.label}
              cx="60" cy="60" r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="20"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circumference}
              style={{ transformOrigin: '60px 60px', transform: 'rotate(-90deg)' }}
            />
          )
          offset += pct
          return el
        })}
        <text x="60" y="64" textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        {slices.filter((s) => s.value > 0).map((slice) => (
          <div key={slice.label} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-xs text-gray-600">{slice.label}</span>
            <span className="ml-auto text-xs font-semibold text-gray-900 tabular-nums">
              {Math.round((slice.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section card wrapper ───────────────────────────────────────────────────────

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm ring-1 ring-gray-950/[0.03]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  // Fetch large slices — analytics computes from existing endpoints
  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ['analytics', 'orders'],
    queryFn:  () => adminOrdersApi.list({ limit: 200 }).then((r) => r.data),
    staleTime: 2 * 60_000,
  })

  const { data: restaurantsRes, isLoading: restLoading } = useQuery({
    queryKey: ['analytics', 'restaurants'],
    queryFn:  () => adminRestaurantsApi.list({ limit: 200 }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: ridersRes, isLoading: ridersLoading } = useQuery({
    queryKey: ['analytics', 'riders'],
    queryFn:  () => adminRidersApi.list({ limit: 200 }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: usersRes, isLoading: usersLoading } = useQuery({
    queryKey: ['analytics', 'users'],
    queryFn:  () => adminUsersApi.list({ limit: 1 }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const isLoading = ordersLoading || restLoading || ridersLoading || usersLoading

  const orders      = useMemo(() => ordersRes?.data?.data ?? [], [ordersRes])
  const restaurants = useMemo(() => restaurantsRes?.data?.data ?? [], [restaurantsRes])
  const riders      = useMemo(() => ridersRes?.data?.data ?? [], [ridersRes])

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const todayStart  = startOf('day')
  const weekStart   = startOf('week')
  const monthStart  = startOf('month')

  const delivered = orders.filter((o) => o.status === OrderStatus.DELIVERED)

  const grossRevenue      = delivered.reduce((s, o) => s + o.pricing.total, 0)
  const platformRevenue   = delivered.reduce((s, o) => s + o.pricing.serviceFee, 0)
  const todayRevenue      = delivered.filter((o) => new Date(o.createdAt) >= todayStart).reduce((s, o) => s + o.pricing.total, 0)
  const weekRevenue       = delivered.filter((o) => new Date(o.createdAt) >= weekStart).reduce((s, o) => s + o.pricing.total, 0)
  const monthRevenue      = delivered.filter((o) => new Date(o.createdAt) >= monthStart).reduce((s, o) => s + o.pricing.total, 0)

  const cancelledCount    = orders.filter((o) => o.status === OrderStatus.CANCELLED).length
  const cancelRate        = orders.length > 0 ? ((cancelledCount / orders.length) * 100).toFixed(1) : '0'

  const avgOrderValue     = delivered.length > 0
    ? Math.round(delivered.reduce((s, o) => s + o.pricing.total, 0) / delivered.length)
    : 0

  const approvedRests     = restaurants.filter((r) => r.approvalStatus === RestaurantApprovalStatus.APPROVED).length
  const pendingRests      = restaurants.filter((r) => r.approvalStatus === RestaurantApprovalStatus.PENDING_REVIEW).length
  const onlineRiders      = riders.filter((r) => r.isOnline).length
  const verifiedRiders    = riders.filter((r) => r.isVerified).length

  // Order status breakdown for donut
  const statusCounts = Object.values(OrderStatus).map((s) => ({
    label: STATUS_LABEL[s] ?? s,
    value: orders.filter((o) => o.status === s).length,
    color: STATUS_COLOR[s] ?? '#94a3b8',
  }))

  // Last 7 days order volume bar chart
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d    = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    return {
      label: d.toLocaleDateString('en-NG', { weekday: 'short' }),
      value: orders.filter((o) => {
        const t = new Date(o.createdAt)
        return t >= d && t < next
      }).length,
    }
  })

  // Last 7 days revenue bar chart
  const last7Revenue = Array.from({ length: 7 }, (_, i) => {
    const d    = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    return {
      label: d.toLocaleDateString('en-NG', { weekday: 'short' }),
      value: Math.round(
        delivered
          .filter((o) => { const t = new Date(o.createdAt); return t >= d && t < next })
          .reduce((s, o) => s + o.pricing.total / 100, 0)
      ),
      color: 'bg-green-400',
    }
  })

  // Top restaurants by order count
  const restOrderCount = restaurants.map((r) => ({
    name: r.name,
    count: orders.filter((o) => o.restaurantId === r._id).length,
    revenue: delivered.filter((o) => o.restaurantId === r._id).reduce((s, o) => s + o.pricing.total, 0),
  })).sort((a, b) => b.count - a.count).slice(0, 8)

  if (isInitializing) return null

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Platform-wide performance metrics"
      />

      {/* ── Top KPI stats ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Gross Revenue"
          value={formatMoney(grossRevenue, 'NGN')}
          sub={`${delivered.length} delivered orders`}
          icon="revenue"
          loading={isLoading}
        />
        <StatsCard
          title="Platform Revenue"
          value={formatMoney(platformRevenue, 'NGN')}
          sub="Service fees collected"
          icon="analytics"
          loading={isLoading}
        />
        <StatsCard
          title="Avg Order Value"
          value={formatMoney(avgOrderValue, 'NGN')}
          sub={`Cancel rate: ${cancelRate}%`}
          icon="orders"
          loading={isLoading}
        />
        <StatsCard
          title="Total Users"
          value={usersRes?.data?.meta?.total?.toLocaleString() ?? '—'}
          sub={`${approvedRests} active restaurants`}
          icon="users"
          loading={isLoading}
        />
      </div>

      {/* ── Time-period revenue ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatsCard
          title="Today's Revenue"
          value={formatMoney(todayRevenue, 'NGN')}
          icon="revenue"
          loading={isLoading}
        />
        <StatsCard
          title="This Week"
          value={formatMoney(weekRevenue, 'NGN')}
          icon="revenue"
          loading={isLoading}
        />
        <StatsCard
          title="This Month"
          value={formatMoney(monthRevenue, 'NGN')}
          icon="revenue"
          loading={isLoading}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        <Card title="Order Volume — Last 7 Days">
          {isLoading
            ? <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
            : <BarChart data={last7.map((d) => ({ ...d, color: 'bg-orange-400' }))} />
          }
        </Card>

        <Card title="Revenue (₦) — Last 7 Days">
          {isLoading
            ? <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
            : <BarChart data={last7Revenue} />
          }
        </Card>
      </div>

      {/* ── Order status + Restaurant/Rider health ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        <Card title="Orders by Status">
          {isLoading
            ? <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
            : <DonutChart slices={statusCounts} />
          }
        </Card>

        <Card title="Restaurant Health">
          {isLoading
            ? <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
            : (
              <div className="space-y-3">
                {[
                  { label: 'Approved & Active', value: approvedRests, color: '#22c55e' },
                  { label: 'Pending Review',    value: pendingRests,  color: '#f59e0b' },
                  { label: 'Rejected / Suspended', value: restaurants.length - approvedRests - pendingRests, color: '#ef4444' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                    <span className="flex-1 text-sm text-gray-600">{row.label}</span>
                    <span className="text-sm font-bold tabular-nums text-gray-900">{row.value}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Total restaurants</span>
                    <span className="font-bold text-gray-900">{restaurants.length}</span>
                  </div>
                </div>
              </div>
            )
          }
        </Card>

        <Card title="Rider Health">
          {isLoading
            ? <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
            : (
              <div className="space-y-3">
                {[
                  { label: 'Verified',    value: verifiedRiders,                    color: '#22c55e' },
                  { label: 'Online now',  value: onlineRiders,                      color: '#3b82f6' },
                  { label: 'Unverified',  value: riders.length - verifiedRiders,    color: '#f59e0b' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                    <span className="flex-1 text-sm text-gray-600">{row.label}</span>
                    <span className="text-sm font-bold tabular-nums text-gray-900">{row.value}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Total riders</span>
                    <span className="font-bold text-gray-900">{riders.length}</span>
                  </div>
                </div>
              </div>
            )
          }
        </Card>
      </div>

      {/* ── Top restaurants table ── */}
      <Card title="Top Restaurants by Orders">
        {isLoading
          ? <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
          : restOrderCount.length === 0
            ? <p className="py-8 text-center text-sm text-gray-400">No order data yet</p>
            : (
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Restaurant</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Orders</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Revenue</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {restOrderCount.map((r, i) => (
                      <tr key={r.name} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-600">
                              {i + 1}
                            </span>
                            {r.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{r.count}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatMoney(r.revenue, 'NGN')}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-orange-400"
                                style={{ width: `${Math.round((r.count / Math.max(restOrderCount[0]?.count, 1)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-gray-400 w-8 text-right">
                              {orders.length > 0 ? Math.round((r.count / orders.length) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </Card>
    </div>
  )
}
