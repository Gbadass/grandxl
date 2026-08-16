'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { platformConfigApi } from '@grandxl/api-client'
import type { CreateCouponDto } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { Coupon } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatusBadge } from '../../../src/components/ui/StatusBadge'
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import '../../../src/lib/axios'

const EMPTY_FORM: CreateCouponDto = {
  code: '',
  type: 'percentage',
  value: 0,
  minOrderAmount: 0,
  maxDiscount: 0,
  usageLimit: 100,
  perUserLimit: 1,
  startDate: '',
  endDate: '',
}

export default function CouponsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateCouponDto>(EMPTY_FORM)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'coupons', page],
    queryFn: () => platformConfigApi.listCoupons({ page, limit: 20 }),
    enabled: isAuthenticated,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      platformConfigApi.createCoupon({
        ...form,
        minOrderAmount: Math.round(Number(form.minOrderAmount) * 100),
        maxDiscount: Math.round(Number(form.maxDiscount) * 100),
        value: form.type === 'percentage' ? Number(form.value) : Math.round(Number(form.value) * 100),
      }),
    onSuccess: () => {
      toast.success('Coupon created')
      void qc.invalidateQueries({ queryKey: ['platform', 'coupons'] })
      setForm(EMPTY_FORM)
      setShowForm(false)
    },
    onError: () => toast.error('Failed to create coupon'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => platformConfigApi.deactivateCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deactivated')
      void qc.invalidateQueries({ queryKey: ['platform', 'coupons'] })
      setDeactivateId(null)
    },
    onError: () => toast.error('Failed to deactivate'),
  })

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (c) => <span className="font-mono text-xs font-bold tracking-widest text-gray-900">{c.code}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (c) => (
        <span className="capitalize text-gray-600">{c.type.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (c) => (
        <span className="font-medium text-gray-900">
          {c.type === 'percentage' ? `${c.value}%` : c.type === 'free_delivery' ? 'Free delivery' : formatMoney(c.value, 'NGN')}
        </span>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      render: (c) => (
        <span className="text-gray-600">{c.usageCount} / {c.usageLimit}</span>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (c) => (
        <span className="text-xs text-gray-400">
          {new Date(c.endDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <StatusBadge
          label={c.isActive ? 'Active' : 'Inactive'}
          variant={c.isActive ? 'green' : 'gray'}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (c) => c.isActive ? (
        <button
          onClick={(e) => { e.stopPropagation(); setDeactivateId(c._id) }}
          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Deactivate
        </button>
      ) : null,
    },
  ]

  if (isInitializing) return null

  return (
    <div>
      <PageHeader
        title="Coupons"
        subtitle="Manage promotional discount codes"
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Coupon
          </button>
        }
      />

      {/* Create Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Create Coupon</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="GRANDXL20"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono uppercase tracking-widest focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CreateCouponDto['type'] })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="percentage">Percentage off</option>
                <option value="fixed_amount">Fixed amount off</option>
                <option value="free_delivery">Free delivery</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {form.type === 'percentage' ? 'Discount (%)' : form.type === 'free_delivery' ? 'Value (ignore)' : 'Discount (₦)'}
              </label>
              <input
                type="number"
                min="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Min Order Amount (₦)</label>
              <input
                type="number"
                min="0"
                value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Max Discount Cap (₦)</label>
              <input
                type="number"
                min="0"
                value={form.maxDiscount}
                onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Total Usage Limit</label>
              <input
                type="number"
                min="1"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Per User Limit</label>
              <input
                type="number"
                min="1"
                value={form.perUserLimit}
                onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.code || !form.startDate || !form.endDate}
              className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Coupon'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={(data?.data?.data?.data ?? []) as Coupon[]}
        loading={isLoading}
        total={data?.data?.data?.meta?.total}
        page={page}
        limit={20}
        onPageChange={setPage}
        emptyMessage="No coupons yet"
      />

      <ConfirmDialog
        open={deactivateId !== null}
        title="Deactivate Coupon"
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateId && deactivateMutation.mutate(deactivateId)}
        onCancel={() => setDeactivateId(null)}
      >
        <p className="text-sm text-gray-600">This coupon will stop working immediately for all users.</p>
      </ConfirmDialog>
    </div>
  )
}
