'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Download, ArrowDownRight, ArrowUpRight, TrendingUp,
  Wallet, CreditCard, Banknote, AlertTriangle, Calendar,
} from 'lucide-react'
import {
  myRestaurantApi, analyticsApi,
  type FinancialReportData, type FinancialReportDailyRow,
} from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import '../../../../src/lib/axios'

// ── Date helpers ─────────────────────────────────────────────────────────────

// Returns yyyy-mm-dd in local time. Native <input type=date> and our backend
// both want the calendar day the user picked, not a UTC-shifted version.
function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function firstOfMonth(offsetMonths = 0): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths, 1)
  return d
}

function lastOfMonth(offsetMonths = 0): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths + 1, 0)
  return d
}

// ── Range presets ────────────────────────────────────────────────────────────

type PresetKey = 'today' | '7d' | '30d' | 'mtd' | 'last-month' | 'custom'

interface Preset {
  key:   PresetKey
  label: string
  from:  () => Date
  to:    () => Date
}

const PRESETS: Preset[] = [
  { key: 'today',      label: 'Today',       from: () => new Date(),         to: () => new Date() },
  { key: '7d',         label: '7 days',      from: () => daysAgo(6),         to: () => new Date() },
  { key: '30d',        label: '30 days',     from: () => daysAgo(29),        to: () => new Date() },
  { key: 'mtd',        label: 'Month to date', from: () => firstOfMonth(0),  to: () => new Date() },
  { key: 'last-month', label: 'Last month',  from: () => firstOfMonth(-1),   to: () => lastOfMonth(-1) },
]

// ── Delta chip ───────────────────────────────────────────────────────────────

function DeltaChip({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <ArrowUpRight size={10} /> new
      </span>
    )
  }
  const pct = ((current - previous) / previous) * 100
  const up  = pct >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, delta, accent, loading }: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  delta?: React.ReactNode
  accent?: boolean
  loading?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-widest ${accent ? 'text-emerald-700' : 'text-gray-500'}`}>
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-32 animate-pulse rounded-lg bg-gray-100" />
          ) : (
            <p className={`mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums ${
              accent ? 'text-emerald-900' : 'text-gray-900'
            }`}>
              {value}
            </p>
          )}
          {sub && !loading && (
            <p className={`mt-1.5 text-xs ${accent ? 'text-emerald-700/80' : 'text-gray-500'}`}>{sub}</p>
          )}
        </div>
        {icon && (
          <div className={`shrink-0 rounded-xl p-2.5 ${accent ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-500'}`}>
            {icon}
          </div>
        )}
      </div>
      {delta && !loading && <div className="mt-3">{delta}</div>}
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Card({ title, subtitle, children, action }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── CSV builder ──────────────────────────────────────────────────────────────

function buildCsv(rows: FinancialReportDailyRow[], from: string, to: string): string {
  const header = [
    'Date', 'Orders', 'Gross (kobo)', 'Net (kobo)',
    'Delivery fee (kobo)', 'Service fee (kobo)', 'Discount (kobo)',
  ]
  const body = rows.map((r) => [
    r.date, r.orders, r.grossKobo, r.netKobo,
    r.deliveryFeeKobo, r.serviceFeeKobo, r.discountKobo,
  ])
  // Excel opens CSV correctly only with the BOM. Users on Windows would otherwise
  // see mojibake for the ₦ symbol we include in comments elsewhere.
  const bom = '﻿'
  const meta = `# GrandXL financial report,${from},to,${to},,,\n`
  return (
    bom + meta +
    header.join(',') + '\n' +
    body.map((row) => row.join(',')).join('\n') + '\n'
  )
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Method icon helper ───────────────────────────────────────────────────────

function methodIcon(method: string) {
  if (method === 'paystack') return <CreditCard size={14} className="text-indigo-500" />
  if (method === 'wallet')   return <Wallet     size={14} className="text-orange-500" />
  return <Banknote size={14} className="text-emerald-600" />
}

function methodLabel(method: string) {
  if (method === 'paystack') return 'Paystack (card)'
  if (method === 'wallet')   return 'Wallet'
  if (method === 'cash')     return 'Cash on delivery'
  return method
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RestaurantFinancePage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  // Default range: last 30 days.
  const [preset, setPreset] = useState<PresetKey>('30d')
  const [from,   setFrom]   = useState<string>(toIsoDate(daysAgo(29)))
  const [to,     setTo]     = useState<string>(toIsoDate(new Date()))

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER)) {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, isInitializing, user, router])

  const { data: restaurantsData } = useQuery({
    queryKey: ['my-restaurants'],
    queryFn:  () => myRestaurantApi.list(),
    enabled:  isAuthenticated,
  })
  const restaurant   = restaurantsData?.data?.data?.[0]
  const restaurantId = restaurant?._id
  const currency     = restaurant?.currency ?? 'NGN'

  const { data: reportRes, isLoading, isError, error } = useQuery({
    queryKey: ['restaurant-financial-report', restaurantId, from, to],
    queryFn:  () => analyticsApi.getRestaurantFinancialReport(restaurantId!, from, to).then((r) => r.data),
    enabled:  !!restaurantId,
    staleTime: 60_000,
  })

  const report: FinancialReportData | undefined = reportRes?.data

  function applyPreset(p: Preset) {
    setPreset(p.key)
    setFrom(toIsoDate(p.from()))
    setTo(toIsoDate(p.to()))
  }

  function onCustomFrom(v: string) {
    setPreset('custom')
    setFrom(v)
  }

  function onCustomTo(v: string) {
    setPreset('custom')
    setTo(v)
  }

  function onExport() {
    if (!report) return
    if (report.daily.length === 0) {
      toast.error('No delivered orders in this period — nothing to export.')
      return
    }
    const filename = `grandxl-finance-${restaurant?.name?.replace(/[^\w-]+/g, '_') ?? 'restaurant'}-${from}-to-${to}.csv`
    downloadCsv(buildCsv(report.daily, from, to), filename)
    toast.success('Report downloaded')
  }

  const totals   = report?.totals
  const prev     = report?.previousTotals
  const dayCount = report?.period.days ?? 0

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        subtitle="Money in, money out — reconcile against your bank statements"
        action={
          <button
            onClick={onExport}
            disabled={!report || isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={15} />
            Export CSV
          </button>
        }
      />

      {/* ── Date range picker ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
            <Calendar size={14} />
            Range
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  preset === p.key
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => onCustomFrom(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={to}
              min={from}
              max={toIsoDate(new Date())}
              onChange={(e) => onCustomTo(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>
        {report && (
          <p className="mt-3 text-xs text-gray-400">
            Showing {dayCount} day{dayCount === 1 ? '' : 's'} · compared to previous {dayCount} day
            {dayCount === 1 ? '' : 's'} ({report.previousPeriod.from.slice(0, 10)} → {report.previousPeriod.to.slice(0, 10)})
          </p>
        )}
      </div>

      {isError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <AlertTriangle size={16} />
          {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load report.'}
        </div>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Gross revenue"
          value={formatMoney(totals?.grossKobo ?? 0, currency)}
          sub={`${totals?.ordersDelivered ?? 0} delivered order${(totals?.ordersDelivered ?? 0) === 1 ? '' : 's'}`}
          icon={<TrendingUp size={18} />}
          delta={<DeltaChip current={totals?.grossKobo ?? 0} previous={prev?.grossKobo ?? 0} />}
          loading={isLoading}
        />
        <KpiCard
          label="Net to you"
          value={formatMoney(totals?.netKobo ?? 0, currency)}
          sub="After discounts, before payout"
          accent
          loading={isLoading}
        />
        <KpiCard
          label="Fees paid"
          value={formatMoney((totals?.deliveryFeeKobo ?? 0) + (totals?.serviceFeeKobo ?? 0), currency)}
          sub="Delivery to riders + service to GrandXL"
          loading={isLoading}
        />
        <KpiCard
          label="Refunded"
          value={formatMoney(totals?.refundedKobo ?? 0, currency)}
          sub={`${totals?.ordersRefunded ?? 0} refund${(totals?.ordersRefunded ?? 0) === 1 ? '' : 's'}`}
          loading={isLoading}
        />
      </div>

      {/* ── Money trail + payment method breakdown ────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title="Money trail" subtitle="Where the customer's money went">
            <div className="divide-y divide-gray-100">
              <Row label="Subtotal (food only)"                value={formatMoney(totals?.subtotalKobo ?? 0, currency)} />
              <Row label="Delivery fee → rider"                value={formatMoney(totals?.deliveryFeeKobo ?? 0, currency)} muted />
              <Row label="Service fee → GrandXL"               value={formatMoney(totals?.serviceFeeKobo ?? 0, currency)} muted />
              <Row label="VAT"                                 value={formatMoney(totals?.vatKobo ?? 0, currency)} muted />
              <Row label="Rider tip (pass-through to rider)"   value={formatMoney(totals?.tipKobo ?? 0, currency)} muted />
              <Row label="Discounts absorbed"                  value={`− ${formatMoney(totals?.discountKobo ?? 0, currency)}`} muted />
              <Row label="Refunded"                            value={`− ${formatMoney(totals?.refundedKobo ?? 0, currency)}`} muted />
              <div className="py-1" />
              <Row label="Customer paid (gross)"               value={formatMoney(totals?.grossKobo ?? 0, currency)} bold />
              <Row label="Net to you"                          value={formatMoney(totals?.netKobo ?? 0, currency)} bold accent />
              <Row label="Average order value"                 value={formatMoney(totals?.avgOrderKobo ?? 0, currency)} />
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="By payment method" subtitle="Delivered orders only">
            {report && report.byPaymentMethod.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] uppercase tracking-widest text-gray-400">
                  <tr>
                    <th className="pb-3 font-semibold">Method</th>
                    <th className="pb-3 text-right font-semibold">Orders</th>
                    <th className="pb-3 text-right font-semibold">Gross</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.byPaymentMethod.map((row) => (
                    <tr key={row.method}>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2 text-gray-800">
                          {methodIcon(row.method)}
                          <span className="font-medium">{methodLabel(row.method)}</span>
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums text-gray-700">{row.orders}</td>
                      <td className="py-3 text-right font-semibold tabular-nums text-gray-900">
                        {formatMoney(row.grossKobo, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-6 text-center text-xs text-gray-400">
                {isLoading ? 'Loading…' : 'No delivered orders in this period.'}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* ── Cancellations by reason ────────────────────────────────────────── */}
      {report && report.byCancelReason.length > 0 && (
        <Card
          title={`Cancellations by reason (${totals?.ordersCancelled ?? 0})`}
          subtitle="Structured reasons since Sprint 12 rollout"
        >
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-gray-400">
              <tr>
                <th className="pb-3 font-semibold">Reason</th>
                <th className="pb-3 text-right font-semibold">Count</th>
                <th className="pb-3 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.byCancelReason.map((row) => {
                const total = report.byCancelReason.reduce((s, r) => s + r.count, 0)
                const pct   = total > 0 ? (row.count / total) * 100 : 0
                return (
                  <tr key={row.code ?? 'legacy'}>
                    <td className="py-3 text-gray-800">
                      <span className="font-medium">{row.label}</span>
                      {row.code && <code className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{row.code}</code>}
                    </td>
                    <td className="py-3 text-right tabular-nums text-gray-700">{row.count}</td>
                    <td className="py-3 text-right tabular-nums text-gray-500">{pct.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Daily breakdown ────────────────────────────────────────────────── */}
      <Card
        title="Daily breakdown"
        subtitle="Delivered orders only"
        action={
          report && report.daily.length > 0 && (
            <p className="text-xs text-gray-400">{report.daily.length} day{report.daily.length === 1 ? '' : 's'} with sales</p>
          )
        }
      >
        {report && report.daily.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-[10px] uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="pb-3 pr-4 font-semibold">Date</th>
                  <th className="pb-3 pr-4 text-right font-semibold">Orders</th>
                  <th className="pb-3 pr-4 text-right font-semibold">Gross</th>
                  <th className="pb-3 pr-4 text-right font-semibold">Net</th>
                  <th className="pb-3 pr-4 text-right font-semibold">Delivery fees</th>
                  <th className="pb-3 pr-4 text-right font-semibold">Service fees</th>
                  <th className="pb-3 text-right font-semibold">Discounts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.daily.map((r) => (
                  <motion.tr
                    key={r.date}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <td className="py-2.5 pr-4 font-medium text-gray-800 tabular-nums">{r.date}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-700">{r.orders}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold tabular-nums text-gray-900">{formatMoney(r.grossKobo, currency)}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold tabular-nums text-emerald-700">{formatMoney(r.netKobo, currency)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-500">{formatMoney(r.deliveryFeeKobo, currency)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-500">{formatMoney(r.serviceFeeKobo, currency)}</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-500">{formatMoney(r.discountKobo, currency)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-gray-400">
            {isLoading ? 'Loading…' : 'No delivered orders in this period.'}
          </p>
        )}
      </Card>
    </div>
  )
}

// ── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, value, muted, bold, accent }: {
  label: string
  value: React.ReactNode
  muted?: boolean
  bold?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <p className={`text-sm ${muted ? 'text-gray-500' : 'text-gray-800'}`}>{label}</p>
      <div className={[
        'text-sm tabular-nums',
        bold ? 'font-bold' : 'font-medium',
        accent ? 'text-emerald-700' : 'text-gray-900',
      ].join(' ')}>
        {value}
      </div>
    </div>
  )
}
