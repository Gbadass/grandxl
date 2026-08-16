'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { restaurantCouponsApi } from '@grandxl/api-client'
import type { Coupon } from '@grandxl/types'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog'
import '../../../../src/lib/axios'

type CouponType = 'percentage' | 'fixed_amount' | 'free_delivery'

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

function formatNaira(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function couponStatusBadge(c: Coupon) {
  const now = Date.now()
  if (!c.isActive)                     return { label: 'Inactive', color: 'bg-gray-100 text-gray-600' }
  if (new Date(c.endDate).getTime()   < now) return { label: 'Expired',  color: 'bg-amber-100 text-amber-700' }
  if (new Date(c.startDate).getTime() > now) return { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' }
  return { label: 'Active', color: 'bg-emerald-100 text-emerald-700' }
}

export default function PromotionsPage() {
  const qc = useQueryClient()
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ['restaurant', 'coupons'],
    queryFn:  () => restaurantCouponsApi.list().then((r) => r.data.data as unknown as Coupon[]),
  })

  const createMutation = useMutation({
    mutationFn: () => restaurantCouponsApi.create({
      code:           form.code.trim().toUpperCase(),
      type:           form.type,
      value:          parseInt(form.value, 10),
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
      qc.invalidateQueries({ queryKey: ['restaurant', 'coupons'] })
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
      qc.invalidateQueries({ queryKey: ['restaurant', 'coupons'] })
    },
    onError: () => toast.error('Could not deactivate'),
  })

  const valuePlaceholder = form.type === 'percentage'
    ? '10 (means 10%)'
    : form.type === 'fixed_amount'
      ? '500 (means ₦500 off)'
      : 'Ignored for free delivery'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        subtitle="Create coupons that apply only at your restaurant"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create form */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Create a coupon</h2>
          <p className="mt-1 text-sm text-gray-500">
            Customers enter the code at checkout. Discount applies only to orders from this restaurant.
          </p>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Code</label>
                <input
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm uppercase tracking-wide shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  placeholder="WELCOME10"
                  required
                  minLength={3}
                  maxLength={20}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
                >
                  <option value="percentage">Percentage off subtotal</option>
                  <option value="fixed_amount">Fixed naira off</option>
                  <option value="free_delivery">Free delivery</option>
                </select>
              </div>
            </div>

            {form.type !== 'free_delivery' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {form.type === 'percentage' ? 'Discount (%)' : 'Discount (₦)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    placeholder={valuePlaceholder}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max discount (₦, 0 = no cap)</label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    placeholder="0"
                    value={form.maxDiscount}
                    onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Min order (₦)</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Total uses (0 = ∞)</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Per customer</label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  value={form.perUserLimit}
                  onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Starts</label>
                <input
                  type="date"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ends</label>
                <input
                  type="date"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-md bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create promotion'}
            </button>
          </form>
        </div>

        {/* Coupon list */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Your promotions</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-gray-500">Loading…</p>
          ) : coupons.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No coupons yet. Create your first one on the left.</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100">
              {coupons.map((c) => {
                const badge = couponStatusBadge(c)
                return (
                  <li key={c._id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold tracking-wide text-gray-900">{c.code}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.color}`}>{badge.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {c.type === 'percentage'   && `${c.value}% off subtotal`}
                        {c.type === 'fixed_amount' && `${formatNaira(c.value)} off`}
                        {c.type === 'free_delivery' && 'Free delivery'}
                        {c.minOrderAmount > 0 && `  ·  min ${formatNaira(c.minOrderAmount)}`}
                        {c.usageLimit > 0 && `  ·  ${c.usageCount}/${c.usageLimit} used`}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(c.startDate).toLocaleDateString()} → {new Date(c.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    {c.isActive && (
                      <button
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmingId(c._id)}
                      >
                        Deactivate
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmingId}
        title="Deactivate promotion?"
        description="The code will stop applying immediately. This can't be undone."
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => confirmingId && deactivateMutation.mutate(confirmingId)}
        onCancel={() => setConfirmingId(null)}
      />
    </div>
  )
}
