'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { myRestaurantApi, analyticsApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import {
  TrendingUp, ShoppingBag, DollarSign, XCircle,
  CheckCircle2, AlertTriangle, Package, Loader2,
} from 'lucide-react'
import '../../../../src/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | 'all'

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color, loading }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
  loading: boolean
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        {loading ? (
          <div className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-gray-100" />
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

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({
  data,
  color = 'bg-orange-400',
  valuePrefix = '',
}: {
  data: { label: string; value: number }[]
  color?: string
  valuePrefix?: string
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.value), 1)

  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center">
        <p className="text-sm text-gray-400">No data for this period</p>
      </div>
    )
  }

  return (
    <div className="flex h-44 items-end gap-1" onMouseLeave={() => setHoveredIdx(null)}>
      {data.map((d, i) => {
        const heightPct = Math.max((d.value / max) * 100, 3)
        const isHovered = hoveredIdx === i
        return (
          <div
            key={d.label}
            className="group relative flex flex-1 flex-col items-center gap-1 cursor-default"
            onMouseEnter={() => setHoveredIdx(i)}
          >
            {/* Tooltip */}
            {isHovered && (
              <div className="absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
                <p className="font-semibold">{d.label}</p>
                <p>{valuePrefix}{d.value.toLocaleString()}</p>
              </div>
            )}
            <div
              className={`w-full rounded-t-sm transition-all duration-200 ${color} ${isHovered ? 'opacity-100' : 'opacity-80'}`}
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-gray-400">No order data yet</p>
      </div>
    )
  }

  let offset = 0
  const r = 40
  const circumference = 2 * Math.PI * r

  return (
    <div className="flex items-center gap-6">
      <svg width="112" height="112" viewBox="0 0 120 120" className="flex-shrink-0">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="20" />
        {slices.filter((s) => s.value > 0).map((slice) => {
          const pct  = slice.value / total
          const dash = pct * circumference
          const gap  = circumference - dash
          const el   = (
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
        <text x="60" y="57" textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">{total}</text>
        <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#9ca3af">orders</text>
      </svg>
      <div className="flex flex-col gap-2.5 min-w-0">
        {slices.filter((s) => s.value > 0).map((slice) => (
          <div key={slice.label} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-xs text-gray-600 truncate">{slice.label}</span>
            <span className="ml-auto font-bold text-gray-900 text-xs tabular-nums pl-3">
              {slice.value}
              <span className="ml-1 text-[10px] font-normal text-gray-400">
                ({Math.round((slice.value / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ title, subtitle, children, loading }: {
  title: string; subtitle?: string; loading?: boolean; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {loading ? <div className="h-36 animate-pulse rounded-xl bg-gray-50" /> : children}
    </div>
  )
}

// ── Metric row ────────────────────────────────────────────────────────────────

function MetricRow({ label, value, bold, highlight }: {
  label: string; value: string; bold?: boolean; highlight?: string
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 last:pb-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-bold text-gray-900' : 'font-medium text-gray-700'} ${highlight ?? ''}`}>
        {value}
      </span>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function RestaurantAnalyticsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [range, setRange] = useState<Range>('30d')

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
  const currency     = restaurant?.currency ?? 'NGN'

  const { data: analyticsRes, isLoading, isError } = useQuery({
    queryKey: ['restaurant-analytics', restaurantId],
    queryFn:  () => analyticsApi.getRestaurant(restaurantId!).then((r) => r.data),
    enabled:  !!restaurantId,
    staleTime: 2 * 60_000,
  })

  const analytics = analyticsRes?.data

  // ── Derived values ─────────────────────────────────────────────────────────

  const totalOrders     = analytics?.orders.total ?? 0
  const completedOrders = analytics?.orders.completed ?? 0
  const cancelledOrders = analytics?.orders.cancelled ?? 0
  const activeOrders    = Math.max(totalOrders - completedOrders - cancelledOrders, 0)
  const completionRate  = analytics?.orders.completionRate ?? 0
  const cancelRate      = totalOrders > 0
    ? ((cancelledOrders / totalOrders) * 100).toFixed(1)
    : '0'
  const totalRevenue  = analytics?.revenue.totalKobo ?? 0
  const avgOrderValue = analytics?.revenue.avgOrderKobo ?? 0

  // Client-side range filter on dailyOrders
  const allDaily = analytics?.dailyOrders ?? []
  const filteredDaily = useMemo(() => {
    if (range === 'all') return allDaily
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (range === '7d' ? 7 : 30))
    return allDaily.filter((d) => new Date(d._id) >= cutoff)
  }, [allDaily, range])

  const dailyOrdersChart = filteredDaily.map((d) => ({
    label: d._id.slice(5), // "MM-DD"
    value: d.count,
  }))

  const dailyRevenueChart = filteredDaily.map((d) => ({
    label: d._id.slice(5),
    value: Math.round(d.revenue / 100), // kobo → naira
  }))

  // Period revenue (filtered days)
  const periodRevenue = filteredDaily.reduce((s, d) => s + d.revenue, 0)
  const periodOrders  = filteredDaily.reduce((s, d) => s + d.count, 0)

  const topItems    = analytics?.topItems ?? []
  const maxItemCount = Math.max(...topItems.map((i) => i.count), 1)

  const statusSlices = [
    { label: 'Delivered', value: completedOrders, color: '#22c55e' },
    { label: 'Cancelled', value: cancelledOrders, color: '#ef4444' },
    { label: 'Active',    value: activeOrders,    color: '#f97316' },
  ]

  const RANGE_TABS: { key: Range; label: string }[] = [
    { key: '7d',  label: '7 days'  },
    { key: '30d', label: '30 days' },
    { key: 'all', label: 'All time' },
  ]

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      {/* Header + range selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Performance insights for {restaurant?.name ?? 'your restaurant'}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 self-start">
          {RANGE_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                range === key
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <AlertTriangle size={16} />
          Failed to load analytics. Please refresh.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<DollarSign size={20} className="text-green-600" />}
          label="Period Revenue"
          value={formatMoney(periodRevenue, currency)}
          sub={`${periodOrders} orders`}
          color="bg-green-50"
          loading={isLoading}
        />
        <KpiCard
          icon={<ShoppingBag size={20} className="text-violet-600" />}
          label="Total Orders"
          value={totalOrders}
          sub="All time"
          color="bg-violet-50"
          loading={isLoading}
        />
        <KpiCard
          icon={<TrendingUp size={20} className="text-orange-500" />}
          label="Avg Order Value"
          value={formatMoney(avgOrderValue, currency)}
          color="bg-orange-50"
          loading={isLoading}
        />
        <KpiCard
          icon={<XCircle size={20} className="text-red-500" />}
          label="Cancel Rate"
          value={`${cancelRate}%`}
          sub={`${cancelledOrders} cancelled`}
          color="bg-red-50"
          loading={isLoading}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Order Volume" subtitle={`Daily orders · ${RANGE_TABS.find((t) => t.key === range)?.label}`} loading={isLoading}>
          <BarChart data={dailyOrdersChart} color="bg-orange-400" />
        </Card>
        <Card title="Revenue Trend" subtitle={`Daily revenue (₦) · ${RANGE_TABS.find((t) => t.key === range)?.label}`} loading={isLoading}>
          <BarChart data={dailyRevenueChart} color="bg-emerald-400" valuePrefix="₦" />
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Order Breakdown" subtitle="All-time by status" loading={isLoading}>
          <DonutChart slices={statusSlices} />
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-50 pt-4">
            {statusSlices.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Key Metrics" subtitle="Lifetime summary" loading={isLoading}>
          <MetricRow label="Total orders"      value={String(totalOrders)} />
          <MetricRow label="Completed"         value={String(completedOrders)} highlight="text-emerald-600" />
          <MetricRow label="Cancelled"         value={String(cancelledOrders)} highlight="text-red-500" />
          <MetricRow label="Active now"        value={String(activeOrders)} />
          <MetricRow label="Completion rate"   value={`${completionRate.toFixed(1)}%`} />
          <MetricRow label="Cancellation rate" value={`${cancelRate}%`} />
          <MetricRow label="Avg order value"   value={formatMoney(avgOrderValue, currency)} />
          <MetricRow label="Total revenue"     value={formatMoney(totalRevenue, currency)} bold />
        </Card>

        <Card title="Top Items" subtitle="Most ordered (all time)" loading={isLoading}>
          {topItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Package size={28} className="text-gray-200" />
              <p className="text-sm text-gray-400">No completed orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topItems.slice(0, 6).map((item, i) => (
                <div key={item.name} className="flex items-center gap-2.5">
                  <span className="h-6 w-6 flex shrink-0 items-center justify-center rounded-full bg-orange-50 text-[10px] font-bold text-orange-600">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-xs font-medium text-gray-700">{item.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums shrink-0">{item.count}×</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top items full table */}
      {topItems.length > 0 && (
        <Card title="Full Item Rankings" subtitle="Ranked by number of times ordered" loading={isLoading}>
          <div className="space-y-3.5">
            {topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-800">{item.name}</span>
                    <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                      {item.count}× · {formatMoney(item.revenue, currency)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-orange-400 transition-all duration-700"
                      style={{ width: `${(item.count / maxItemCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Completion rate card */}
      {!isLoading && totalOrders > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Completion Rate</h3>
                <p className="text-xs text-gray-400 mt-0.5">Orders successfully delivered</p>
              </div>
              <CheckCircle2 size={20} className="text-emerald-500" />
            </div>
            <div className="flex items-end gap-3">
              <p className="text-4xl font-bold text-gray-900 leading-none tabular-nums">
                {completionRate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-400 mb-1">{completedOrders} of {totalOrders} orders</p>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Cancellation Rate</h3>
                <p className="text-xs text-gray-400 mt-0.5">Orders cancelled before delivery</p>
              </div>
              <XCircle size={20} className="text-red-400" />
            </div>
            <div className="flex items-end gap-3">
              <p className="text-4xl font-bold text-gray-900 leading-none tabular-nums">{cancelRate}%</p>
              <p className="text-sm text-gray-400 mb-1">{cancelledOrders} of {totalOrders} orders</p>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${parseFloat(cancelRate) > 15 ? 'bg-red-500' : parseFloat(cancelRate) > 8 ? 'bg-amber-400' : 'bg-green-400'}`}
                style={{ width: `${cancelRate}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
