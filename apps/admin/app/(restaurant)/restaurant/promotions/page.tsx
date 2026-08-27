'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Percent, Minus, Truck, Zap, Copy, Loader2, Tag,
  CheckCircle2, Clock, XCircle, BarChart2, Users,
  Ticket, ChevronRight, RefreshCw,
} from 'lucide-react'
import { restaurantCouponsApi } from '@grandxl/api-client'
import type { Coupon } from '@grandxl/types'
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog'
import '../../../../src/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

type CouponType = 'percentage' | 'fixed_amount' | 'free_delivery'
type FilterKey  = 'all' | 'active' | 'scheduled' | 'expired' | 'inactive'

interface FormState {
  code:           string
  type:           CouponType
  value:          string
  minOrderAmount: string
  maxDiscount:    string
  usageLimit:     string
  perUserLimit:   string
  startDate:      string
  endDate:        string
}

const EMPTY_FORM: FormState = {
  code:           '',
  type:           'percentage',
  value:          '',
  minOrderAmount: '',
  maxDiscount:    '',
  usageLimit:     '',
  perUserLimit:   '1',
  startDate:      new Date().toISOString().slice(0, 10),
  endDate:        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNaira(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function couponStatus(c: Coupon): { label: string; color: string; dot: string; key: FilterKey } {
  const now = Date.now()
  if (!c.isActive)                              return { label: 'Inactive',  color: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400',   key: 'inactive'  }
  if (new Date(c.endDate).getTime()   < now)    return { label: 'Expired',   color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400',  key: 'expired'   }
  if (new Date(c.startDate).getTime() > now)    return { label: 'Scheduled', color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400',   key: 'scheduled' }
  return                                               { label: 'Active',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400', key: 'active' }
}

function daysLabel(endDate: string) {
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return { text: 'Expired',        cls: 'text-red-400'    }
  if (days === 0) return { text: 'Expires today',  cls: 'text-amber-500'  }
  if (days === 1) return { text: 'Expires tomorrow', cls: 'text-amber-500' }
  if (days <= 3)  return { text: `${days}d left`, cls: 'text-amber-500'  }
  return                 { text: `${days}d left`, cls: 'text-gray-400'   }
}

function generateCode() {
  const words = ['SAVE', 'FRESH', 'DEAL', 'GRAND', 'TASTY', 'JOLLOF', 'CHOP']
  const word  = words[Math.floor(Math.random() * words.length)]
  const num   = Math.floor(Math.random() * 90) + 10
  return `${word}${num}`
}

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`))
}

// ── Coupon type buttons ───────────────────────────────────────────────────────

const TYPES = [
  { value: 'percentage'   as CouponType, label: 'Percentage',    icon: Percent, desc: '% off subtotal' },
  { value: 'fixed_amount' as CouponType, label: 'Fixed amount',  icon: Minus,   desc: '₦ off order'    },
  { value: 'free_delivery' as CouponType, label: 'Free delivery', icon: Truck,   desc: 'No delivery fee' },
]

// ── inputCls ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 ' +
  'focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 transition'

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number | string; color: string
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── Coupon card ───────────────────────────────────────────────────────────────

function CouponCard({ c, onDeactivate }: { c: Coupon; onDeactivate: () => void }) {
  const status  = couponStatus(c)
  const expiry  = daysLabel(String(c.endDate))
  const usePct  = c.usageLimit > 0 ? Math.min(100, (c.usageCount / c.usageLimit) * 100) : null

  const discountLine =
    c.type === 'percentage'    ? `${c.value}% off subtotal`
    : c.type === 'fixed_amount' ? `${formatNaira(c.value)} off`
    : 'Free delivery'

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <Ticket size={15} className="text-orange-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-bold tracking-widest text-gray-900 uppercase truncate">
                {c.code}
              </span>
              <button
                onClick={() => copyText(c.code, c.code)}
                className="text-gray-300 hover:text-orange-500 transition-colors cursor-pointer shrink-0"
                aria-label="Copy code"
              >
                <Copy size={12} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{discountLine}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1.5 ${status.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* Usage progress */}
      {usePct !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>{c.usageCount} used</span>
            <span>{c.usageLimit} limit</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usePct >= 90 ? 'bg-red-400' : usePct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${usePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <div className="flex items-center gap-3">
          {c.minOrderAmount > 0 && (
            <span>Min {formatNaira(c.minOrderAmount)}</span>
          )}
          {c.usageLimit === 0 && (
            <span className="flex items-center gap-0.5">
              <Users size={9} /> Unlimited uses
            </span>
          )}
        </div>
        <span className={expiry.cls}>{expiry.text}</span>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <Clock size={10} />
        <span>
          {new Date(c.startDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
          {' '}→{' '}
          {new Date(c.endDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Actions */}
      {c.isActive && (
        <button
          onClick={onDeactivate}
          className="w-full rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer mt-1"
        >
          Deactivate
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const qc = useQueryClient()
  const [form, setForm]           = useState<FormState>(EMPTY_FORM)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [filter, setFilter]       = useState<FilterKey>('all')
  const [errors, setErrors]       = useState<Partial<Record<keyof FormState, string>>>({})

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ['restaurant', 'coupons'],
    queryFn:  () => restaurantCouponsApi.list().then((r) => r.data.data as unknown as Coupon[]),
  })

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active    = coupons.filter((c) => couponStatus(c).key === 'active').length
    const scheduled = coupons.filter((c) => couponStatus(c).key === 'scheduled').length
    const expired   = coupons.filter((c) => couponStatus(c).key === 'expired').length
    const redemptions = coupons.reduce((s, c) => s + (c.usageCount ?? 0), 0)
    return { active, scheduled, expired, redemptions }
  }, [coupons])

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (filter === 'all') return coupons
    return coupons.filter((c) => couponStatus(c).key === filter)
  }, [coupons, filter])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () => restaurantCouponsApi.create({
      code:           form.code.trim().toUpperCase(),
      type:           form.type,
      value:          parseInt(form.value || '0', 10),
      minOrderAmount: form.minOrderAmount ? parseInt(form.minOrderAmount, 10) * 100 : undefined,
      maxDiscount:    form.maxDiscount    ? parseInt(form.maxDiscount,    10) * 100 : undefined,
      usageLimit:     form.usageLimit     ? parseInt(form.usageLimit,     10) : undefined,
      perUserLimit:   form.perUserLimit   ? parseInt(form.perUserLimit,   10) : undefined,
      startDate:      new Date(form.startDate).toISOString(),
      endDate:        new Date(form.endDate).toISOString(),
    }),
    onSuccess: () => {
      toast.success('Promotion created')
      setForm(EMPTY_FORM)
      setErrors({})
      void qc.invalidateQueries({ queryKey: ['restaurant', 'coupons'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Could not create promotion'
      toast.error(msg)
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => restaurantCouponsApi.deactivate(id),
    onSuccess: () => {
      toast.success('Promotion deactivated')
      setConfirmingId(null)
      void qc.invalidateQueries({ queryKey: ['restaurant', 'coupons'] })
    },
    onError: () => toast.error('Could not deactivate'),
  })

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!form.code.trim() || form.code.trim().length < 3)
      errs.code = 'Code must be at least 3 characters'
    if (form.type !== 'free_delivery' && (!form.value || parseInt(form.value, 10) < 1))
      errs.value = 'Enter a valid discount value'
    if (form.type === 'percentage' && parseInt(form.value, 10) > 100)
      errs.value = 'Percentage cannot exceed 100'
    if (!form.startDate) errs.startDate = 'Required'
    if (!form.endDate)   errs.endDate   = 'Required'
    if (form.startDate && form.endDate && form.endDate <= form.startDate)
      errs.endDate = 'End date must be after start date'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) createMutation.mutate()
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  const previewDiscount =
    form.type === 'percentage'    ? (form.value ? `${form.value}% off` : '—% off')
    : form.type === 'fixed_amount' ? (form.value ? `₦${parseInt(form.value, 10)} off` : '₦— off')
    : 'Free delivery'

  const FILTER_TABS: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all',       label: 'All',       count: coupons.length },
    { key: 'active',    label: 'Active',    count: stats.active    },
    { key: 'scheduled', label: 'Scheduled', count: stats.scheduled },
    { key: 'expired',   label: 'Expired',   count: stats.expired   },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create discount codes customers enter at checkout</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          label="Active coupons"
          value={stats.active}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<Clock size={18} className="text-blue-600" />}
          label="Scheduled"
          value={stats.scheduled}
          color="bg-blue-50"
        />
        <StatCard
          icon={<XCircle size={18} className="text-amber-500" />}
          label="Expired"
          value={stats.expired}
          color="bg-amber-50"
        />
        <StatCard
          icon={<BarChart2 size={18} className="text-orange-500" />}
          label="Total redemptions"
          value={stats.redemptions}
          color="bg-orange-50"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* ── Create form ────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          {/* Form header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-50">
            <div className="h-8 w-8 rounded-xl bg-orange-50 flex items-center justify-center">
              <Tag size={16} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Create a coupon</h2>
              <p className="text-xs text-gray-400 mt-0.5">Customers enter the code at checkout</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Code */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Coupon code</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    className={`${inputCls} uppercase tracking-widest font-mono ${errors.code ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                    placeholder="e.g. WELCOME10"
                    minLength={3}
                    maxLength={20}
                    value={form.code}
                    onChange={(e) => {
                      setForm({ ...form, code: e.target.value.toUpperCase() })
                      if (errors.code) setErrors({ ...errors, code: undefined })
                    }}
                  />
                  {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, code: generateCode() })}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw size={13} />
                  Generate
                </button>
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Discount type</label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, type: value, value: '' })
                      setErrors({ ...errors, value: undefined })
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 transition-all cursor-pointer ${
                      form.type === value
                        ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100'
                        : 'border-gray-200 bg-gray-50 hover:border-orange-300 hover:bg-orange-50/50'
                    }`}
                  >
                    <Icon size={18} className={form.type === value ? 'text-orange-600' : 'text-gray-400'} />
                    <span className={`text-xs font-semibold ${form.type === value ? 'text-orange-700' : 'text-gray-600'}`}>
                      {label}
                    </span>
                    <span className="text-[10px] text-gray-400 text-center leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Discount value + max cap */}
            {form.type !== 'free_delivery' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">
                    {form.type === 'percentage' ? 'Discount percentage' : 'Discount amount (₦)'}
                  </label>
                  <div className="relative">
                    {form.type === 'percentage' ? (
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">%</span>
                    ) : (
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">₦</span>
                    )}
                    <input
                      type="number"
                      min={1}
                      max={form.type === 'percentage' ? 100 : undefined}
                      value={form.value}
                      onChange={(e) => {
                        setForm({ ...form, value: e.target.value })
                        if (errors.value) setErrors({ ...errors, value: undefined })
                      }}
                      placeholder={form.type === 'percentage' ? '10' : '500'}
                      className={`${inputCls} ${form.type === 'percentage' ? 'pr-9' : 'pl-8'} ${errors.value ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                    />
                  </div>
                  {errors.value && <p className="text-xs text-red-500">{errors.value}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">
                    Max discount cap
                    <span className="ml-1 text-xs font-normal text-gray-400">(₦, leave blank = no cap)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">₦</span>
                    <input
                      type="number"
                      min={0}
                      value={form.maxDiscount}
                      onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                      placeholder="No cap"
                      className={inputCls + ' pl-8'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Min order + usage limits */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Min order
                  <span className="ml-1 text-xs font-normal text-gray-400">(₦)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                  <input
                    type="number"
                    min={0}
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    placeholder="Any amount"
                    className={inputCls + ' pl-8'}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Total uses
                  <span className="ml-1 text-xs font-normal text-gray-400">(blank = unlimited)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                  placeholder="Unlimited"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Per customer
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.perUserLimit}
                  onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Date range */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">Start date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">End date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => {
                    setForm({ ...form, endDate: e.target.value })
                    if (errors.endDate) setErrors({ ...errors, endDate: undefined })
                  }}
                  className={`${inputCls} ${errors.endDate ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                />
                {errors.endDate && <p className="text-xs text-red-500">{errors.endDate}</p>}
              </div>
            </div>

            {/* Live preview strip */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <Ticket size={16} className="text-orange-600" />
                </div>
                <div>
                  <p className="font-mono text-sm font-bold tracking-widest text-gray-900 uppercase">
                    {form.code || 'YOUR CODE'}
                  </p>
                  <p className="text-xs text-gray-500">{previewDiscount}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
                <span>Preview</span>
                <ChevronRight size={11} />
              </div>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-xl bg-orange-600 py-3.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60 transition-colors cursor-pointer min-h-[52px] flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Zap size={15} />
                  Create promotion
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Coupon list ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Filter tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {FILTER_TABS.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filter === key
                    ? 'bg-orange-600 text-white shadow-sm shadow-orange-200'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {label} {count > 0 && <span className={`ml-1 ${filter === key ? 'opacity-80' : 'text-gray-400'}`}>({count})</span>}
              </button>
            ))}
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 animate-pulse space-y-3">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-xl bg-gray-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                    <div className="h-6 w-20 bg-gray-100 rounded-full" />
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 px-6 text-center">
              <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <Ticket size={24} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-600 text-sm">
                {filter === 'all' ? 'No promotions yet' : `No ${filter} promotions`}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {filter === 'all'
                  ? 'Create your first coupon using the form on the left.'
                  : 'Try switching to a different filter.'}
              </p>
              {/* Sprint 12 (S12-14): Show-all CTA only for the filtered case;
                  the 'all' state's copy already points to the form on the left. */}
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 cursor-pointer transition-colors"
                >
                  Show all promotions
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => (
                <CouponCard
                  key={c._id}
                  c={c}
                  onDeactivate={() => setConfirmingId(c._id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmingId}
        title="Deactivate promotion?"
        description="The code will stop working immediately for all customers. This cannot be undone."
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => confirmingId && deactivateMutation.mutate(confirmingId)}
        onCancel={() => setConfirmingId(null)}
      />
    </div>
  )
}
