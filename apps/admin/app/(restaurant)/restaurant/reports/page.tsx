'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { myRestaurantApi } from '@grandxl/api-client'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { StatsCard } from '../../../../src/components/ui/StatsCard'
import '../../../../src/lib/axios'

// ── Chart components ──────────────────────────────────────────────────────────

function BarChart({ data, color = 'bg-orange-400' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex h-36 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[9px] font-semibold text-gray-500 tabular-nums">
            {d.value > 0 ? d.value : ''}
          </span>
          <div
            className={`w-full rounded-t-sm transition-all ${color}`}
            style={{ height: `${Math.max((d.value / max) * 100, 3)}%` }}
          />
          <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0) return <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>

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
        <text x="60" y="63" textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">{total}</text>
      </svg>
      <div className="flex flex-col gap-2 min-w-0">
        {slices.filter((s) => s.value > 0).map((slice) => (
          <div key={slice.label} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-gray-600 truncate">{slice.label}</span>
            <span className="ml-auto font-semibold text-gray-900 tabular-nums pl-2">
              {Math.round((slice.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function RestaurantAnalyticsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

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

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['my-orders', restaurantId, 'analytics'],
    queryFn:  () => myRestaurantApi.getOrders(restaurantId!, { limit: 500 }),
    enabled:  !!restaurantId,
  })

  const allOrders = useMemo(
    () => (ordersData?.data?.data?.data ?? []) as Order[],
    [ordersData],
  )

  const delivered  = useMemo(() => allOrders.filter((o) => o.status === OrderStatus.DELIVERED), [allOrders])
  const cancelled  = useMemo(() => allOrders.filter((o) => o.status === OrderStatus.CANCELLED), [allOrders])
  const active     = useMemo(() => allOrders.filter((o) =>
    [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP]
      .includes(o.status as OrderStatus),
  ), [allOrders])

  // ── KPIs ──────────────────────────────────────────────────────────────────────

  const totalRevenue  = delivered.reduce((s, o) => s + o.pricing.total, 0)
  const avgOrderValue = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0
  const cancelRate    = allOrders.length > 0 ? ((cancelled.length / allOrders.length) * 100).toFixed(1) : '0'

  const now       = new Date()
  const todayStr  = now.toDateString()
  const weekAgo   = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0,0,0,0)
  const monthAgo  = new Date(now); monthAgo.setDate(1); monthAgo.setHours(0,0,0,0)

  const todayRevenue  = delivered.filter((o) => new Date(o.createdAt).toDateString() === todayStr).reduce((s, o) => s + o.pricing.total, 0)
  const weekRevenue   = delivered.filter((o) => new Date(o.createdAt) >= weekAgo).reduce((s, o) => s + o.pricing.total, 0)
  const monthRevenue  = delivered.filter((o) => new Date(o.createdAt) >= monthAgo).reduce((s, o) => s + o.pricing.total, 0)

  // ── Last 7 days bar charts ────────────────────────────────────────────────────

  const last7Orders = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d    = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    return {
      label: d.toLocaleDateString('en-NG', { weekday: 'short' }),
      value: allOrders.filter((o) => { const t = new Date(o.createdAt); return t >= d && t < next }).length,
    }
  }), [allOrders])

  const last7Revenue = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d    = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    const rev  = delivered.filter((o) => { const t = new Date(o.createdAt); return t >= d && t < next }).reduce((s, o) => s + o.pricing.total, 0)
    return {
      label: d.toLocaleDateString('en-NG', { weekday: 'short' }),
      value: Math.round(rev / 100),
    }
  }), [delivered])

  // ── Peak hours (0-23) ─────────────────────────────────────────────────────────

  const peakHours = useMemo(() => Array.from({ length: 24 }, (_, h) => ({
    label: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`,
    value: allOrders.filter((o) => new Date(o.createdAt).getHours() === h).length,
  })), [allOrders])

  // Show only 6a–11p for readability
  const peakHoursFiltered = peakHours.slice(6, 23)

  // ── Top menu items ────────────────────────────────────────────────────────────

  const topItems = useMemo(() => {
    const counts: Record<string, { name: string; count: number; revenue: number }> = {}
    delivered.forEach((order) => {
      order.items.forEach((item) => {
        if (!counts[item.menuItemId]) counts[item.menuItemId] = { name: item.name, count: 0, revenue: 0 }
        counts[item.menuItemId].count   += item.quantity
        counts[item.menuItemId].revenue += item.basePrice * item.quantity
      })
    })
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 8)
  }, [delivered])

  const maxItemCount = Math.max(...topItems.map((i) => i.count), 1)

  // ── Order status donut ────────────────────────────────────────────────────────

  const statusSlices = [
    { label: 'Delivered',   value: delivered.length,  color: '#22c55e' },
    { label: 'Cancelled',   value: cancelled.length,  color: '#ef4444' },
    { label: 'Active',      value: active.length,     color: '#f97316' },
  ]

  if (isInitializing) return null

  return (
    <div>
      <PageHeader title="Analytics" subtitle={`Performance insights for ${restaurant?.name ?? 'your restaurant'}`} />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Total Revenue"    value={formatMoney(totalRevenue, currency)}  icon="revenue"    loading={isLoading} />
        <StatsCard title="Total Orders"     value={allOrders.length}                     icon="orders"     loading={isLoading} />
        <StatsCard title="Avg Order Value"  value={formatMoney(avgOrderValue, currency)} icon="analytics"  loading={isLoading} />
        <StatsCard title="Cancellation Rate" value={`${cancelRate}%`}                   icon="active"     loading={isLoading} />
      </div>

      {/* Period revenue strip */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Today's Revenue",      value: todayRevenue  },
          { label: "This Week's Revenue",  value: weekRevenue   },
          { label: "This Month's Revenue", value: monthRevenue  },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">
              {isLoading ? <span className="block h-6 w-28 animate-pulse rounded bg-gray-100" /> : formatMoney(value, currency)}
            </p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Order Volume" subtitle="Last 7 days">
          <BarChart data={last7Orders} color="bg-orange-400" />
        </Card>
        <Card title="Revenue Trend" subtitle="Last 7 days (₦ hundreds)">
          <BarChart data={last7Revenue} color="bg-green-400" />
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Order Breakdown" subtitle="All-time by status">
          <DonutChart slices={statusSlices} />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-50 pt-4">
            <Stat label="Delivered"  value={delivered.length} color="text-green-600" />
            <Stat label="Cancelled"  value={cancelled.length} color="text-red-500"   />
            <Stat label="Active"     value={active.length}    color="text-orange-500" />
          </div>
        </Card>

        <Card title="Peak Hours" subtitle="Orders by hour of day" >
          <BarChart data={peakHoursFiltered} color="bg-violet-400" />
        </Card>

        <Card title="Key Metrics" subtitle="Lifetime summary">
          <div className="space-y-3 text-sm">
            <MetricRow label="Total orders"        value={String(allOrders.length)} />
            <MetricRow label="Delivered"           value={String(delivered.length)} />
            <MetricRow label="Cancelled"           value={String(cancelled.length)} />
            <MetricRow label="Active now"          value={String(active.length)} />
            <MetricRow label="Avg order value"     value={formatMoney(avgOrderValue, currency)} />
            <MetricRow label="Cancellation rate"   value={`${cancelRate}%`} />
            <MetricRow label="Total revenue"       value={formatMoney(totalRevenue, currency)} bold />
          </div>
        </Card>
      </div>

      {/* Top menu items */}
      <Card title="Top Menu Items" subtitle="Ranked by number of times ordered">
        {topItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No completed orders yet</p>
        ) : (
          <div className="space-y-3">
            {topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-800">{item.name}</span>
                    <span className="flex-shrink-0 text-xs text-gray-500">{item.count}× — {formatMoney(item.revenue, currency)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-orange-400 transition-all"
                      style={{ width: `${(item.count / maxItemCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  )
}

function MetricRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}>{value}</span>
    </div>
  )
}
