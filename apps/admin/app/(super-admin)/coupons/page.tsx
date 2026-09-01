'use client'

// S13-15: Promo code creation UI. Full rewrite of the /coupons page —
// stats strip, search + status tabs, modal-based create form with auto-gen
// code + live preview + restaurant multi-select + datetime precision,
// row-click detail slide-over with copy-code + deactivate.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { platformConfigApi, adminRestaurantsApi } from '@grandxl/api-client'
import type { CreateCouponDto } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { Coupon, Restaurant } from '@grandxl/types'
import { formatMoney, parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog'
import '../../../src/lib/axios'

// ── Helpers ──────────────────────────────────────────────────────────────────
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0/1/I to avoid confusion

function autoGenerateCode(): string {
  const prefix = 'GXL'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return `${prefix}${suffix}`
}

function daysUntil(date: Date | string): number {
  const ms = new Date(date).getTime() - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function toDateTimeLocal(iso: string | Date): string {
  // <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in local time.
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type StatusFilter = 'all' | 'active' | 'scheduled' | 'expired' | 'inactive'

function couponStatus(c: Coupon): StatusFilter {
  const now = Date.now()
  const start = new Date(c.startDate).getTime()
  const end   = new Date(c.endDate).getTime()
  if (!c.isActive) return 'inactive'
  if (start > now) return 'scheduled'
  if (end < now)   return 'expired'
  return 'active'
}

function statusTone(s: StatusFilter): string {
  if (s === 'active')    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (s === 'scheduled') return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (s === 'expired')   return 'bg-gray-100 text-gray-600 ring-gray-200'
  return 'bg-red-50 text-red-700 ring-red-200' // inactive
}

// ── Filter pill ──────────────────────────────────────────────────────────────
function FilterPill({
  active, onClick, children, count,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-lg px-3.5 py-2 text-xs font-medium transition-all duration-150 ${
        active
          ? 'bg-gray-900 text-white shadow-sm'
          : 'border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-900'
      }`}
    >
      {children}
      {count != null && (
        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
        }`}>{count}</span>
      )}
    </button>
  )
}

// ── Restaurant multi-select ──────────────────────────────────────────────────
function RestaurantMultiSelect({
  selected, onChange, restaurants,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  restaurants: Restaurant[]
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = useMemo(
    () => restaurants.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())),
    [restaurants, q],
  )
  const label = selected.length === 0
    ? 'All restaurants (default)'
    : `${selected.length} restaurant${selected.length === 1 ? '' : 's'} selected`

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-800 hover:border-gray-300"
      >
        <span className={selected.length ? '' : 'text-gray-500'}>{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4 text-gray-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search restaurants…"
              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-gray-400 focus:outline-none"
              autoFocus
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-1 text-[10px] text-red-500 hover:underline"
              >
                Clear selection ({selected.length})
              </button>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="p-3 text-center text-xs text-gray-500">No matches</p>
            )}
            {filtered.map((r) => (
              <label
                key={r._id}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(r._id)}
                  onChange={() => toggle(r._id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 accent-orange-500"
                />
                <span className="truncate text-gray-800">{r.name}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full border-t border-gray-100 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}

// ── Form state ───────────────────────────────────────────────────────────────
interface FormState {
  code: string
  type: 'percentage' | 'fixed_amount' | 'free_delivery'
  valueDisplay: string       // % OR ₦ display value
  minOrderNaira: string
  maxDiscountNaira: string
  usageLimit: string
  perUserLimit: string
  applicableRestaurants: string[]
  startDate: string          // datetime-local
  endDate: string
}

function nowPlusHours(h: number): string {
  const d = new Date(Date.now() + h * 3600_000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const BLANK_FORM: FormState = {
  code: '',
  type: 'percentage',
  valueDisplay: '10',
  minOrderNaira: '0',
  maxDiscountNaira: '0',
  usageLimit: '100',
  perUserLimit: '1',
  applicableRestaurants: [],
  startDate: nowPlusHours(0),
  endDate:   nowPlusHours(24 * 30),
}

// ── Live preview ─────────────────────────────────────────────────────────────
function CouponPreview({ form }: { form: FormState }) {
  const value = parseFloat(form.valueDisplay) || 0
  const minOrder = parseFloat(form.minOrderNaira) || 0
  const maxDisc  = parseFloat(form.maxDiscountNaira) || 0

  let discount = ''
  if (form.type === 'percentage') discount = `${value}% off`
  else if (form.type === 'fixed_amount') discount = `₦${value.toLocaleString()} off`
  else discount = 'Free delivery'

  const parts = [discount]
  if (minOrder > 0) parts.push(`on orders ≥ ₦${minOrder.toLocaleString()}`)
  if (maxDisc > 0 && form.type === 'percentage') parts.push(`(max ₦${maxDisc.toLocaleString()})`)
  if (form.applicableRestaurants.length > 0) parts.push(`· ${form.applicableRestaurants.length} restaurant${form.applicableRestaurants.length === 1 ? '' : 's'}`)

  return (
    <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-700">Preview</p>
      <p className="mt-1 font-mono text-xs font-bold tracking-widest text-orange-900">
        {form.code || 'CODE-PENDING'}
      </p>
      <p className="mt-1 text-xs text-orange-800">{parts.join(' ')}</p>
    </div>
  )
}

// ── Detail slide-over ────────────────────────────────────────────────────────
function CouponDetailPanel({
  coupon, restaurantsById, onClose, onDeactivate, deactivating,
}: {
  coupon: Coupon | null
  restaurantsById: Map<string, Restaurant>
  onClose: () => void
  onDeactivate: (id: string) => void
  deactivating: boolean
}) {
  if (!coupon) return null
  const status = couponStatus(coupon)
  const usagePct = coupon.usageLimit > 0 ? Math.min(100, (coupon.usageCount / coupon.usageLimit) * 100) : 0
  const scopedRestaurants = coupon.applicableRestaurants
    .map((id) => restaurantsById.get(id)?.name)
    .filter(Boolean) as string[]

  const code = coupon.code  // narrow closure over stable string
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(`Copied "${code}"`)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl ring-1 ring-gray-200"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Coupon</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Code + status */}
          <div className="border-b border-gray-100 px-6 py-6 text-center">
            <button
              onClick={copyCode}
              className="group inline-flex items-center gap-2 rounded-xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 font-mono text-xl font-bold tracking-widest text-orange-800 hover:bg-orange-100"
              title="Copy code"
            >
              {coupon.code}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4 opacity-40 group-hover:opacity-100">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
            </button>
            <p className="mt-3">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(status)}`}>
                {status === 'active'    && 'Active'}
                {status === 'scheduled' && 'Starts in the future'}
                {status === 'expired'   && 'Expired'}
                {status === 'inactive'  && 'Deactivated'}
              </span>
            </p>
          </div>

          {/* Details */}
          <dl className="divide-y divide-gray-100 px-6 py-2">
            <Row label="Type" value={coupon.type.replace('_', ' ')} />
            <Row label="Discount" value={
              coupon.type === 'percentage' ? `${coupon.value}%`
              : coupon.type === 'free_delivery' ? 'Free delivery'
              : formatMoney(coupon.value, 'NGN')
            } />
            <Row label="Min order" value={coupon.minOrderAmount > 0 ? formatMoney(coupon.minOrderAmount, 'NGN') : 'None'} />
            <Row label="Max discount" value={coupon.maxDiscount > 0 ? formatMoney(coupon.maxDiscount, 'NGN') : 'No cap'} />
            <Row label="Per-user limit" value={String(coupon.perUserLimit)} />
            <Row label="Usage limit" value={coupon.usageLimit > 0 ? String(coupon.usageLimit) : 'Unlimited'} />
            <Row label="Starts" value={new Date(coupon.startDate).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            <Row label="Ends"   value={new Date(coupon.endDate).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          </dl>

          {/* Usage bar */}
          <div className="px-6 py-4">
            <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
              <span>Redemptions</span>
              <span className="font-mono text-gray-700">{coupon.usageCount}{coupon.usageLimit > 0 && ` / ${coupon.usageLimit}`}</span>
            </div>
            {coupon.usageLimit > 0 && (
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full rounded-full ${usagePct >= 100 ? 'bg-red-500' : usagePct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                />
              </div>
            )}
          </div>

          {/* Restaurant scope */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Applies to</p>
            {scopedRestaurants.length === 0 ? (
              <p className="mt-1 text-sm text-gray-800">All restaurants on the platform</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {scopedRestaurants.map((n) => (
                  <li key={n} className="rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-700">{n}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {coupon.isActive && (
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
            <button
              onClick={() => onDeactivate(coupon._id)}
              disabled={deactivating}
              className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deactivating ? 'Deactivating…' : 'Deactivate coupon'}
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2.5 text-sm">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 capitalize text-right">{value}</dd>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CouponsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [tab, setTab]         = useState<StatusFilter>('all')
  const [search, setSearch]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState<FormState>(BLANK_FORM)
  const [selected, setSelected] = useState<Coupon | null>(null)
  const [deactivateConfirm, setDeactivateConfirm] = useState<Coupon | null>(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data: couponsData, isLoading } = useQuery({
    queryKey: ['platform', 'coupons'],
    queryFn: async () => {
      const res = await platformConfigApi.listCoupons({ page: 1, limit: 200 })
      return res.data.data
    },
    enabled: isAuthenticated && !isInitializing,
  })

  // Restaurants for the multi-select + detail-panel name lookup. High limit so
  // the picker shows the full list (platform likely has <500 restaurants).
  const { data: restaurantsData } = useQuery({
    queryKey: ['admin', 'restaurants', 'for-coupon-picker'],
    queryFn: async () => {
      const res = await adminRestaurantsApi.list({ page: 1, limit: 200 })
      return res.data.data
    },
    enabled: isAuthenticated && !isInitializing,
    staleTime: 60_000,
  })

  const coupons = couponsData?.data ?? []
  const restaurants = restaurantsData?.data ?? []
  const restaurantsById = useMemo(
    () => new Map(restaurants.map((r) => [r._id, r])),
    [restaurants],
  )

  // Client-side filter (coupons collection is small; simpler than server round-trip per tab)
  const filtered = useMemo(() => {
    return coupons.filter((c) => {
      if (tab !== 'all' && couponStatus(c) !== tab) return false
      if (search && !c.code.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [coupons, tab, search])

  // Stats
  const activeCount    = useMemo(() => coupons.filter((c) => couponStatus(c) === 'active').length, [coupons])
  const scheduledCount = useMemo(() => coupons.filter((c) => couponStatus(c) === 'scheduled').length, [coupons])
  const expiredCount   = useMemo(() => coupons.filter((c) => couponStatus(c) === 'expired').length, [coupons])
  const inactiveCount  = useMemo(() => coupons.filter((c) => couponStatus(c) === 'inactive').length, [coupons])
  const totalRedemptions = useMemo(() => coupons.reduce((sum, c) => sum + c.usageCount, 0), [coupons])

  // Sync detail panel with latest data after mutations
  useEffect(() => {
    if (!selected) return
    const fresh = coupons.find((c) => c._id === selected._id)
    if (fresh) setSelected(fresh)
    else       setSelected(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupons])

  // Client-side duplicate check — the server also enforces via unique index,
  // but early client feedback saves a round-trip on typing.
  const codeConflict = form.code.length >= 3 && coupons.some((c) => c.code.toUpperCase() === form.code.toUpperCase())

  const createMutation = useMutation({
    mutationFn: async () => {
      // Value normalization: percentage stays as-is; fixed_amount converts naira→kobo.
      const rawValue = parseFloat(form.valueDisplay) || 0
      const value = form.type === 'percentage' ? rawValue : Math.round(rawValue * 100)
      const dto: CreateCouponDto = {
        code:                  form.code.trim(),
        type:                  form.type,
        value,
        minOrderAmount:        Math.round((parseFloat(form.minOrderNaira) || 0) * 100),
        maxDiscount:           Math.round((parseFloat(form.maxDiscountNaira) || 0) * 100),
        usageLimit:            parseInt(form.usageLimit) || 0,
        perUserLimit:          parseInt(form.perUserLimit) || 1,
        applicableRestaurants: form.applicableRestaurants.length > 0 ? form.applicableRestaurants : undefined,
        startDate:             new Date(form.startDate).toISOString(),
        endDate:               new Date(form.endDate).toISOString(),
      }
      return platformConfigApi.createCoupon(dto)
    },
    onSuccess: () => {
      toast.success('Coupon created')
      void qc.invalidateQueries({ queryKey: ['platform', 'coupons'] })
      setForm(BLANK_FORM)
      setShowForm(false)
    },
    onError: (e) => toast.error(parseApiError(e, 'Failed to create coupon')),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => platformConfigApi.deactivateCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deactivated')
      void qc.invalidateQueries({ queryKey: ['platform', 'coupons'] })
      setDeactivateConfirm(null)
    },
    onError: (e) => toast.error(parseApiError(e, 'Failed to deactivate')),
  })

  function saveForm() {
    if (form.code.trim().length < 3) { toast.error('Code must be at least 3 characters'); return }
    if (codeConflict) { toast.error('That code is already in use'); return }
    if (form.type !== 'free_delivery' && (parseFloat(form.valueDisplay) || 0) <= 0) {
      toast.error('Discount value must be > 0'); return
    }
    if (new Date(form.endDate).getTime() <= new Date(form.startDate).getTime()) {
      toast.error('End date must be after start date'); return
    }
    createMutation.mutate()
  }

  async function copyRowCode(e: React.MouseEvent, code: string) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      toast.success(`Copied "${code}"`)
    } catch {
      toast.error('Could not copy')
    }
  }

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold tracking-widest text-gray-900">{c.code}</span>
          <button
            onClick={(e) => copyRowCode(e, c.code)}
            className="cursor-pointer text-gray-400 hover:text-gray-700"
            title="Copy code"
            aria-label="Copy code"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
          </button>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Discount',
      render: (c) => (
        <span className="font-medium text-gray-900">
          {c.type === 'percentage' && `${c.value}%`}
          {c.type === 'fixed_amount' && formatMoney(c.value, 'NGN')}
          {c.type === 'free_delivery' && 'Free delivery'}
        </span>
      ),
    },
    {
      key: 'usage',
      header: 'Redemptions',
      render: (c) => (
        <span className="text-xs text-gray-600">
          {c.usageCount}{c.usageLimit > 0 && ` / ${c.usageLimit}`}
        </span>
      ),
    },
    {
      key: 'scope',
      header: 'Applies to',
      render: (c) => (
        <span className="text-xs text-gray-500">
          {c.applicableRestaurants.length === 0
            ? 'All restaurants'
            : `${c.applicableRestaurants.length} restaurant${c.applicableRestaurants.length === 1 ? '' : 's'}`}
        </span>
      ),
    },
    {
      key: 'ends',
      header: 'Ends',
      render: (c) => {
        const days = daysUntil(c.endDate)
        const isExpired = days < 0
        const isExpiring = days >= 0 && days <= 7
        return (
          <div>
            <p className="text-xs text-gray-700">
              {new Date(c.endDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
            </p>
            {isExpiring && !isExpired && (
              <p className="text-[10px] font-semibold text-amber-600">Expires in {days}d</p>
            )}
            {isExpired && (
              <p className="text-[10px] font-semibold text-gray-400">Expired</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => {
        const s = couponStatus(c)
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusTone(s)}`}>
            {s === 'active' && 'Active'}
            {s === 'scheduled' && 'Scheduled'}
            {s === 'expired' && 'Expired'}
            {s === 'inactive' && 'Deactivated'}
          </span>
        )
      },
    },
  ]

  if (isInitializing || !isAuthenticated) return null

  return (
    <div>
      <PageHeader
        title="Promo codes"
        subtitle="Discount codes that customers redeem at checkout. Percentage, fixed amount, or free delivery — with optional restaurant scope."
        action={
          <motion.button
            onClick={() => { setForm({ ...BLANK_FORM, code: autoGenerateCode() }); setShowForm(true) }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.1 }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New code
          </motion.button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatsCard title="Total codes"       value={String(coupons.length)}    sub="all statuses" />
        <StatsCard title="Active now"        value={String(activeCount)}       sub={scheduledCount ? `${scheduledCount} scheduled` : 'live and redeemable'} />
        <StatsCard title="Total redemptions" value={String(totalRedemptions)}  sub="all time" />
        <StatsCard title="Expired / off"     value={String(expiredCount + inactiveCount)} sub={`${expiredCount} expired · ${inactiveCount} deactivated`} />
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterPill active={tab === 'all'}       onClick={() => setTab('all')}       count={coupons.length}>All</FilterPill>
          <FilterPill active={tab === 'active'}    onClick={() => setTab('active')}    count={activeCount}>Active</FilterPill>
          <FilterPill active={tab === 'scheduled'} onClick={() => setTab('scheduled')} count={scheduledCount}>Scheduled</FilterPill>
          <FilterPill active={tab === 'expired'}   onClick={() => setTab('expired')}   count={expiredCount}>Expired</FilterPill>
          <FilterPill active={tab === 'inactive'}  onClick={() => setTab('inactive')}  count={inactiveCount}>Deactivated</FilterPill>
        </div>
        <div className="relative md:w-64">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search codes"
            className="w-full rounded-lg border border-gray-200 bg-white px-9 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        emptyMessage={search
          ? `No codes match "${search}"`
          : tab === 'all' ? 'No promo codes yet — click "New code" to create your first one.'
          : `No ${tab} codes.`}
        onRowClick={(row) => setSelected(row)}
      />

      {/* Create modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => !createMutation.isPending && setShowForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">New promo code</h3>
                <button
                  onClick={() => !createMutation.isPending && setShowForm(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      placeholder="GRANDXL20"
                      className={`flex-1 rounded-lg border px-3 py-2 font-mono text-sm uppercase tracking-widest focus:outline-none ${
                        codeConflict ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-gray-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, code: autoGenerateCode() })}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    >
                      Auto-generate
                    </button>
                  </div>
                  {codeConflict && (
                    <p className="mt-1 text-[10px] text-red-500">A coupon with this code already exists.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as FormState['type'] })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                    >
                      <option value="percentage">Percentage off</option>
                      <option value="fixed_amount">Fixed amount off</option>
                      <option value="free_delivery">Free delivery</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                      {form.type === 'percentage' ? 'Percent (%)' : form.type === 'free_delivery' ? 'N/A' : 'Amount (₦)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step={form.type === 'percentage' ? '1' : '0.01'}
                      value={form.valueDisplay}
                      onChange={(e) => setForm({ ...form, valueDisplay: e.target.value })}
                      disabled={form.type === 'free_delivery'}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Min order (₦)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.minOrderNaira}
                      onChange={(e) => setForm({ ...form, minOrderNaira: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-gray-500">0 = no minimum</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Max discount cap (₦)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.maxDiscountNaira}
                      onChange={(e) => setForm({ ...form, maxDiscountNaira: e.target.value })}
                      disabled={form.type !== 'percentage'}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <p className="mt-1 text-[10px] text-gray-500">Only for percentage · 0 = no cap</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Total usage limit</label>
                    <input
                      type="number"
                      min="0"
                      value={form.usageLimit}
                      onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-gray-500">0 = unlimited</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Per-customer limit</label>
                    <input
                      type="number"
                      min="1"
                      value={form.perUserLimit}
                      onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Applies to restaurants</label>
                  <RestaurantMultiSelect
                    selected={form.applicableRestaurants}
                    onChange={(ids) => setForm({ ...form, applicableRestaurants: ids })}
                    restaurants={restaurants}
                  />
                  <p className="mt-1 text-[10px] text-gray-500">Leave empty for all restaurants.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Starts</label>
                    <input
                      type="datetime-local"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Ends</label>
                    <input
                      type="datetime-local"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                <CouponPreview form={form} />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => !createMutation.isPending && setShowForm(false)}
                  disabled={createMutation.isPending}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <motion.button
                  onClick={saveForm}
                  disabled={createMutation.isPending || codeConflict}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create code'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <CouponDetailPanel
            coupon={selected}
            restaurantsById={restaurantsById}
            onClose={() => setSelected(null)}
            onDeactivate={(id) => setDeactivateConfirm(coupons.find((c) => c._id === id) ?? null)}
            deactivating={deactivateMutation.isPending}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deactivateConfirm}
        title="Deactivate coupon?"
        description={deactivateConfirm ? `"${deactivateConfirm.code}" will stop working immediately for all customers. Redemptions to date remain in the history.` : ''}
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateConfirm && deactivateMutation.mutate(deactivateConfirm._id)}
        onCancel={() => setDeactivateConfirm(null)}
      />
    </div>
  )
}
