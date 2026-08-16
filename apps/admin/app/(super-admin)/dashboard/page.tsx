'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { adminRestaurantsApi, adminOrdersApi, adminRidersApi } from '@grandxl/api-client'
import { RestaurantApprovalStatus, UserRole } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { StatusBadge } from '../../../src/components/ui/StatusBadge'
import type { Order } from '@grandxl/types'
import '../../../src/lib/axios'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function SuperAdminDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, isInitializing, user, router])

  const { data: pendingRestaurants, isLoading: loadingPending } = useQuery({
    queryKey: ['admin', 'restaurants', 'pending'],
    queryFn: () => adminRestaurantsApi.list({ status: RestaurantApprovalStatus.PENDING_REVIEW, limit: 1 }),
    enabled: isAuthenticated,
  })

  const { data: allRestaurants, isLoading: loadingRestaurants } = useQuery({
    queryKey: ['admin', 'restaurants', 'all'],
    queryFn: () => adminRestaurantsApi.list({ limit: 1 }),
    enabled: isAuthenticated,
  })

  const { data: recentOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: () => adminOrdersApi.list({ limit: 8 }),
    enabled: isAuthenticated,
  })

  const { data: riders, isLoading: loadingRiders } = useQuery({
    queryKey: ['admin', 'riders', 'all'],
    queryFn: () => adminRidersApi.list({ limit: 1 }),
    enabled: isAuthenticated,
  })

  const pendingCount = pendingRestaurants?.data?.data?.meta?.total ?? 0

  const orderColumns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Order',
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
      key: 'total',
      header: 'Total',
      render: (o) => (
        <span className="font-semibold text-gray-900">{formatMoney(o.pricing.total, o.currency)}</span>
      ),
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
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {getGreeting()}, {user?.firstName ?? 'Admin'} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-400">{formatDate()}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Restaurants"
          value={allRestaurants?.data?.data?.meta?.total ?? 0}
          icon="restaurants"
          loading={loadingRestaurants}
        />
        <StatsCard
          title="Pending Approvals"
          value={pendingCount}
          icon="pending"
          sub={pendingCount > 0 ? 'Needs attention' : 'All clear'}
          loading={loadingPending}
        />
        <StatsCard
          title="Total Riders"
          value={riders?.data?.data?.meta?.total ?? 0}
          icon="riders"
          loading={loadingRiders}
        />
        <StatsCard
          title="Total Orders"
          value={recentOrders?.data?.data?.meta?.total ?? 0}
          icon="orders"
          loading={loadingOrders}
        />
      </div>

      {/* Recent orders */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
            <p className="mt-0.5 text-xs text-gray-400">Latest 8 orders across all restaurants</p>
          </div>
          <button
            onClick={() => router.push('/orders')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-white hover:text-gray-900"
          >
            View all orders
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
        <DataTable
          columns={orderColumns}
          data={(recentOrders?.data?.data?.data ?? []) as Order[]}
          loading={loadingOrders}
          emptyMessage="No orders yet"
          onRowClick={(o) => router.push(`/orders/${o._id}`)}
        />
      </div>
    </div>
  )
}
