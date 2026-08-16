'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminOrdersApi } from '@grandxl/api-client'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { StatusBadge } from '../../../src/components/ui/StatusBadge'
import '../../../src/lib/axios'

const STATUS_TABS: { label: string; value: OrderStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: OrderStatus.PENDING },
  { label: 'Confirmed', value: OrderStatus.CONFIRMED },
  { label: 'Preparing', value: OrderStatus.PREPARING },
  { label: 'Picked up', value: OrderStatus.PICKED_UP },
  { label: 'Delivered', value: OrderStatus.DELIVERED },
  { label: 'Cancelled', value: OrderStatus.CANCELLED },
]

export default function SuperAdminOrdersPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [confirmClear, setConfirmClear] = useState(false)

  const clearMutation = useMutation({
    mutationFn: () => adminOrdersApi.clearAll(),
    onSuccess: (res) => {
      const n = res.data?.data?.cleared ?? 0
      toast.success(`${n} order${n !== 1 ? 's' : ''} cleared from the system`)
      setConfirmClear(false)
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
    },
    onError: () => toast.error('Failed to clear orders'),
  })

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', status, page],
    queryFn: () => adminOrdersApi.list({ status, page, limit: 20 }),
    enabled: isAuthenticated,
  })

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Order #',
      render: (o) => (
        <span className="font-mono text-xs font-semibold text-gray-900">{o.orderNumber}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => <StatusBadge label={o.status} orderStatus={o.status} />,
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (o) => (
        <StatusBadge label={o.payment.status} paymentStatus={o.payment.status} />
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (o) => (
        <span className="font-semibold">{formatMoney(o.pricing.total, o.currency)}</span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (o) => <span className="text-gray-500">{o.items.length} item(s)</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (o) => (
        <span className="text-xs text-gray-400">
          {new Date(o.createdAt).toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
  ]

  if (isInitializing) return null

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Orders" subtitle="All platform orders" />
        <button
          onClick={() => setConfirmClear(true)}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:border-red-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Clear All Orders
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => { setStatus(tab.value); setPage(1) }}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              status === tab.value
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={(data?.data?.data?.data ?? []) as Order[]}
        loading={isLoading}
        total={data?.data?.data?.meta?.total}
        page={page}
        limit={20}
        onPageChange={setPage}
        onRowClick={(o) => router.push(`/orders/${o._id}`)}
        emptyMessage="No orders found"
      />

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-1 text-lg font-semibold text-gray-900">Clear all system orders?</h3>
            <p className="mb-2 text-sm text-gray-500">
              This will remove <span className="font-semibold text-gray-700">every order</span> from all views — customers, restaurants, and riders. The records are retained in the database but hidden from all users.
            </p>
            <p className="mb-6 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              This action cannot be undone. Use only for system resets.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {clearMutation.isPending ? 'Clearing…' : 'Yes, clear everything'}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                disabled={clearMutation.isPending}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
