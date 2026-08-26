'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { UserRole } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import {
  analyticsApi,
  referralsApi,
  type DispatchMetricsData,
  type QueueDepthData,
  type OrderTimeoutData,
  type RestaurantEngagementData,
  type RestaurantWaitTimeData,
  type RiderUtilizationData,
  type ReferralOverview,
} from '@grandxl/api-client'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import '../../../src/lib/axios'

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

  const { data: analyticsRes, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'platform'],
    queryFn:  () => analyticsApi.getPlatform().then((r) => r.data),
    staleTime: 2 * 60_000,
    enabled:  isAuthenticated,
  })

  const { data: dispatchRes, isLoading: dispatchLoading } = useQuery({
    queryKey: ['analytics', 'dispatch'],
    queryFn:  () => analyticsApi.getDispatchMetrics(7).then((r) => r.data),
    staleTime: 2 * 60_000,
    enabled:  isAuthenticated,
  })

  const { data: queueRes, isLoading: queueLoading } = useQuery({
    queryKey: ['analytics', 'queue-depth'],
    queryFn:  () => analyticsApi.getQueueDepth().then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled:  isAuthenticated,
  })

  const { data: timeoutRes,     isLoading: timeoutLoading    } = useQuery({
    queryKey: ['analytics', 'order-timeouts', 7],
    queryFn:  () => analyticsApi.getOrderTimeouts(7).then((r) => r.data),
    staleTime: 2 * 60_000, enabled: isAuthenticated,
  })
  const { data: engagementRes,  isLoading: engagementLoading } = useQuery({
    queryKey: ['analytics', 'restaurant-engagement', 30],
    queryFn:  () => analyticsApi.getRestaurantEngagement(30).then((r) => r.data),
    staleTime: 5 * 60_000, enabled: isAuthenticated,
  })
  const { data: waitTimesRes,   isLoading: waitTimesLoading  } = useQuery({
    queryKey: ['analytics', 'wait-times', 30],
    queryFn:  () => analyticsApi.getRestaurantWaitTimes(30).then((r) => r.data),
    staleTime: 5 * 60_000, enabled: isAuthenticated,
  })
  const { data: utilRes,        isLoading: utilLoading       } = useQuery({
    queryKey: ['analytics', 'rider-utilization', 7],
    queryFn:  () => analyticsApi.getRiderUtilization(7).then((r) => r.data),
    staleTime: 2 * 60_000, enabled: isAuthenticated,
  })
  const { data: referralRes,    isLoading: referralLoading   } = useQuery({
    queryKey: ['analytics', 'referrals', 30],
    queryFn:  () => referralsApi.getAdminOverview(30).then((r) => r.data),
    staleTime: 5 * 60_000, enabled: isAuthenticated,
  })

  const analytics = analyticsRes?.data

  // ── Derived display values ─────────────────────────────────────────────────

  const totalOrders     = analytics?.orders.total ?? 0
  const completedOrders = analytics?.orders.completed ?? 0
  const cancelledOrders = analytics?.orders.cancelled ?? 0
  const completionRate  = analytics?.orders.completionRate ?? 0
  const cancelRate      = totalOrders > 0
    ? ((cancelledOrders / totalOrders) * 100).toFixed(1)
    : '0'

  const totalRevenue      = analytics?.revenue.totalKobo ?? 0
  const commissionRevenue = analytics?.revenue.commissionKobo ?? 0

  const totalRestaurants  = analytics?.restaurants.total ?? 0
  const activeRestaurants = analytics?.restaurants.active ?? 0
  const totalRiders       = analytics?.riders.total ?? 0
  const activeRiders      = analytics?.riders.active ?? 0

  // Daily orders chart — use _id (date string) as label, count as value
  const dailyOrdersChart = (analytics?.dailyOrders ?? []).map((d) => ({
    label: d._id.slice(5), // "MM-DD" from "YYYY-MM-DD"
    value: d.count,
    color: 'bg-orange-400' as const,
  }))

  // Daily revenue chart — revenue is in kobo, display as naira (÷100)
  const dailyRevenueChart = (analytics?.dailyOrders ?? []).map((d) => ({
    label: d._id.slice(5),
    value: Math.round(d.revenue / 100),
    color: 'bg-green-400' as const,
  }))

  // Order status donut
  const statusSlices = [
    { label: 'Completed', value: completedOrders, color: '#22c55e' },
    { label: 'Cancelled', value: cancelledOrders, color: '#ef4444' },
    {
      label: 'Other',
      value: Math.max(totalOrders - completedOrders - cancelledOrders, 0),
      color: '#f59e0b',
    },
  ]

  // Top restaurants
  const topRestaurants = analytics?.topRestaurants ?? []

  const dispatch: DispatchMetricsData | undefined = dispatchRes?.data
  const queueData: QueueDepthData | undefined = queueRes?.data
  const timeout:    OrderTimeoutData         | undefined = timeoutRes?.data
  const engagement: RestaurantEngagementData | undefined = engagementRes?.data
  const waitTimes:  RestaurantWaitTimeData   | undefined = waitTimesRes?.data
  const util:       RiderUtilizationData     | undefined = utilRes?.data
  const referrals:  ReferralOverview         | undefined = referralRes?.data
  const QUEUE_LABELS: Record<string, string> = {
    'order-timeout':         'Order Timeout',
    'rider-dispatch':        'Rider Dispatch',
    'scheduled-order-release': 'Scheduled Orders',
    'settlement':            'Settlement',
  }

  function formatSeconds(s: number): string {
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const rs = s % 60
    return `${m}m ${rs}s`
  }

  if (isInitializing) return null

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Platform-wide performance metrics"
      />

      {isError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          Failed to load analytics data. Please refresh the page.
        </div>
      )}

      {/* ── Top KPI stats ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Gross Revenue"
          value={formatMoney(totalRevenue, 'NGN')}
          sub={`${completedOrders} completed orders`}
          icon="revenue"
          loading={isLoading}
        />
        <StatsCard
          title="Platform Commission"
          value={formatMoney(commissionRevenue, 'NGN')}
          sub="Commission collected"
          icon="analytics"
          loading={isLoading}
        />
        <StatsCard
          title="Completion Rate"
          value={`${completionRate.toFixed(1)}%`}
          sub={`Cancel rate: ${cancelRate}%`}
          icon="orders"
          loading={isLoading}
        />
        <StatsCard
          title="Total Orders"
          value={totalOrders.toLocaleString()}
          sub={`${activeRestaurants} active restaurants`}
          icon="users"
          loading={isLoading}
        />
      </div>

      {/* ── Restaurant & Rider summary ── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatsCard
          title="Active Restaurants"
          value={`${activeRestaurants} / ${totalRestaurants}`}
          sub="Active vs total restaurants"
          icon="restaurants"
          loading={isLoading}
        />
        <StatsCard
          title="Active Riders"
          value={`${activeRiders} / ${totalRiders}`}
          sub="Active vs total riders"
          icon="riders"
          loading={isLoading}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        <Card title="Order Volume — Daily Trend">
          {isLoading
            ? <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
            : dailyOrdersChart.length === 0
              ? <div className="flex h-40 items-center justify-center text-sm text-gray-400">No data yet</div>
              : <BarChart data={dailyOrdersChart} />
          }
        </Card>

        <Card title="Revenue (₦) — Daily Trend">
          {isLoading
            ? <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
            : dailyRevenueChart.length === 0
              ? <div className="flex h-40 items-center justify-center text-sm text-gray-400">No data yet</div>
              : <BarChart data={dailyRevenueChart} />
          }
        </Card>
      </div>

      {/* ── Order status + Restaurant/Rider health ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        <Card title="Orders by Status">
          {isLoading
            ? <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
            : <DonutChart slices={statusSlices} />
          }
        </Card>

        <Card title="Restaurant Health">
          {isLoading
            ? <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
            : (
              <div className="space-y-3">
                {[
                  { label: 'Active',    value: activeRestaurants,                    color: '#22c55e' },
                  { label: 'Inactive',  value: totalRestaurants - activeRestaurants, color: '#f59e0b' },
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
                    <span className="font-bold text-gray-900">{totalRestaurants}</span>
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
                  { label: 'Active',   value: activeRiders,                 color: '#3b82f6' },
                  { label: 'Inactive', value: totalRiders - activeRiders,   color: '#f59e0b' },
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
                    <span className="font-bold text-gray-900">{totalRiders}</span>
                  </div>
                </div>
              </div>
            )
          }
        </Card>
      </div>

      {/* ── Dispatch observability ── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Dispatch Health — last 7 days</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
          <StatsCard
            title="Avg Wait Time"
            value={dispatch ? `${Math.round(dispatch.avgWaitSeconds / 60)}m ${dispatch.avgWaitSeconds % 60}s` : '—'}
            sub="First broadcast → rider accepted"
            icon="riders"
            loading={dispatchLoading}
          />
          <StatsCard
            title="Avg Broadcast Rounds"
            value={dispatch ? String(dispatch.avgDispatchRounds) : '—'}
            sub={`Avg ${dispatch?.avgBroadcastCount ?? '—'} riders per round`}
            icon="orders"
            loading={dispatchLoading}
          />
          <StatsCard
            title="Force-Assigned"
            value={dispatch ? String(dispatch.forceAssignCount) : '—'}
            sub="Assigned after all 5 rounds"
            icon="analytics"
            loading={dispatchLoading}
          />
          <StatsCard
            title="No Rider Found"
            value={dispatch ? String(dispatch.noRiderCount) : '—'}
            sub="Orders with no rider assigned"
            icon="revenue"
            loading={dispatchLoading}
          />
        </div>
      </div>

      {/* ── Queue depth ── */}
      <Card title="BullMQ Queue Depth (live · refreshes every 30s)">
        {queueLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
        ) : !queueData ? (
          <p className="py-6 text-center text-sm text-gray-400">No queue data</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Queue</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-blue-500 text-right">Waiting</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-orange-500 text-right">Active</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-indigo-500 text-right">Delayed</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-red-500 text-right">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(queueData.queues).map(([name, counts]) => (
                  <tr key={name} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{QUEUE_LABELS[name] ?? name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-blue-700">{counts.waiting}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-orange-600 font-semibold">{counts.active}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-indigo-600">{counts.delayed}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${counts.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {counts.failed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6" />

      {/* ── Timeouts + engagement + utilization stat row ── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Operational Health
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
          <StatsCard
            title="Order Timeout Rate (7d)"
            value={timeout ? `${timeout.timeoutRate}%` : '—'}
            sub={timeout ? `${timeout.totalTimeouts} of ${timeout.totalOrders} orders` : ''}
            icon="orders"
            loading={timeoutLoading}
          />
          <StatsCard
            title="Restaurant Engagement (30d)"
            value={engagement ? `${engagement.engagementRate}%` : '—'}
            sub={engagement ? `${engagement.engagedOrders} of ${engagement.totalOrders} actively handled` : ''}
            icon="restaurants"
            loading={engagementLoading}
          />
          <StatsCard
            title="Avg Rider Utilization (7d)"
            value={util ? `${util.avgUtilization}%` : '—'}
            sub={util ? `${util.totalBusyHours}h busy / ${util.totalOnlineHours}h online` : ''}
            icon="riders"
            loading={utilLoading}
          />
          <StatsCard
            title="Active Riders (7d)"
            value={util ? String(util.riderCount) : '—'}
            sub="Riders with at least one session"
            icon="users"
            loading={utilLoading}
          />
        </div>
      </div>

      {/* ── Restaurants that need coaching (low engagement) ── */}
      <Card title="Least Engaged Restaurants — last 30 days (bottom 25)">
        {engagementLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
        ) : !engagement || engagement.worstRestaurants.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Not enough data yet</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Restaurant</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Orders</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Engaged</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Engagement %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {engagement.worstRestaurants.map((r) => (
                  <tr key={r.restaurantId} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name ?? r.restaurantId}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{r.total}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{r.engaged}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${r.engagementRate < 30 ? 'text-red-600' : r.engagementRate < 60 ? 'text-amber-600' : 'text-gray-600'}`}>
                      {r.engagementRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6" />

      {/* ── Restaurants that keep riders waiting ── */}
      <Card title="Slowest Restaurants — avg rider wait time (last 30 days)">
        {waitTimesLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
        ) : !waitTimes || waitTimes.restaurants.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Not enough data yet</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Restaurant</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Orders</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Avg Wait</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Max Wait</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {waitTimes.restaurants.map((r) => (
                  <tr key={r.restaurantId} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name ?? r.restaurantId}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{r.orderCount}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${r.avgWaitSeconds > 900 ? 'text-red-600' : r.avgWaitSeconds > 600 ? 'text-amber-600' : 'text-gray-600'}`}>
                      {formatSeconds(r.avgWaitSeconds)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{formatSeconds(r.maxWaitSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6" />

      {/* ── Rider utilization tables ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        <Card title="Top Utilized Riders (7d)">
          {utilLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
          ) : !util || util.topRiders.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Not enough data yet</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Rider</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Deliveries</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {util.topRiders.map((r) => (
                    <tr key={r.riderId}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.riderId.slice(-8)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">{r.deliveries}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-green-600">{r.utilization}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Least Utilized Riders (7d) — idle capacity">
          {utilLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
          ) : !util || util.bottomRiders.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Not enough data yet</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Rider</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Deliveries</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {util.bottomRiders.map((r) => (
                    <tr key={r.riderId}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.riderId.slice(-8)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">{r.deliveries}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-600">{r.utilization}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Referral growth (last 30 days) ── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Growth — Referrals (last 30 days)
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
          <StatsCard
            title="Total Referrals"
            value={referrals ? String(referrals.totalReferrals) : '—'}
            sub="Codes applied in period"
            icon="users"
            loading={referralLoading}
          />
          <StatsCard
            title="Rewarded"
            value={referrals ? String(referrals.rewardedReferrals) : '—'}
            sub="Referees completed first order"
            icon="orders"
            loading={referralLoading}
          />
          <StatsCard
            title="Pending"
            value={referrals ? String(referrals.pendingReferrals) : '—'}
            sub="Awaiting referee's first order"
            icon="analytics"
            loading={referralLoading}
          />
          <StatsCard
            title="Paid Out to Referrers"
            value={referrals ? formatMoney(referrals.totalRewardedKobo, 'NGN') : '—'}
            sub="Total wallet credits earned"
            icon="revenue"
            loading={referralLoading}
          />
        </div>
      </div>

      <Card title="Top Referrers (all time)">
        {referralLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
        ) : !referrals || referrals.topReferrers.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No referrals yet</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Referrer</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Rewarded</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Total Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {referrals.topReferrers.map((r, i) => (
                  <tr key={r.referrerId} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-600">
                          {i + 1}
                        </span>
                        {r.firstName ?? '?'} {r.lastName ?? ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{r.rewardedCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-green-600">
                      {formatMoney(r.totalEarnedKobo, 'NGN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6" />

      {/* ── Top restaurants table ── */}
      <Card title="Top Restaurants by Orders">
        {isLoading
          ? <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
          : topRestaurants.length === 0
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
                    {topRestaurants.map((r, i) => (
                      <tr key={r.name} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-600">
                              {i + 1}
                            </span>
                            {r.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{r.orderCount}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatMoney(r.revenue, 'NGN')}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-orange-400"
                                style={{ width: `${Math.round((r.orderCount / Math.max(topRestaurants[0]?.orderCount ?? 1, 1)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-gray-400 w-8 text-right">
                              {totalOrders > 0 ? Math.round((r.orderCount / totalOrders) * 100) : 0}%
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
