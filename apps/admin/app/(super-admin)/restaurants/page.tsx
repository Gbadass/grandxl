'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { adminRestaurantsApi } from '@grandxl/api-client'
import { RestaurantApprovalStatus, UserRole } from '@grandxl/types'
import type { Restaurant } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { StatusBadge } from '../../../src/components/ui/StatusBadge'
import '../../../src/lib/axios'

const STATUS_TABS: { label: string; value: RestaurantApprovalStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: RestaurantApprovalStatus.PENDING_REVIEW },
  { label: 'Approved', value: RestaurantApprovalStatus.APPROVED },
  { label: 'Rejected', value: RestaurantApprovalStatus.REJECTED },
  { label: 'Suspended', value: RestaurantApprovalStatus.SUSPENDED },
]

export default function RestaurantsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [status, setStatus] = useState<RestaurantApprovalStatus | undefined>(undefined)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'restaurants', status, page],
    queryFn: () => adminRestaurantsApi.list({ status, page, limit: 20 }),
    enabled: isAuthenticated,
  })

  const columns: Column<Restaurant>[] = [
    {
      key: 'name',
      header: 'Restaurant',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.name}</p>
          <p className="text-xs text-gray-400">{r.address.city}, {r.address.state}</p>
        </div>
      ),
    },
    {
      key: 'cuisine',
      header: 'Cuisine',
      render: (r) => <span className="text-gray-500">{r.cuisine?.slice(0, 2).join(', ')}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge
          label={r.approvalStatus.replace(/_/g, ' ')}
          restaurantStatus={r.approvalStatus}
        />
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-gray-700">
          {r.ratingCount > 0 ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-amber-400">
                <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
              </svg>
              {r.rating.toFixed(1)}
              <span className="text-gray-400">({r.ratingCount})</span>
            </>
          ) : '—'}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Joined',
      render: (r) => (
        <span className="text-xs text-gray-400">
          {new Date(r.createdAt).toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
  ]

  if (isInitializing) return null

  return (
    <div>
      <PageHeader title="Restaurants" subtitle="Manage restaurant applications and listings" />

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => { setStatus(tab.value); setPage(1) }}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
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
        data={(data?.data?.data?.data ?? []) as Restaurant[]}
        loading={isLoading}
        total={data?.data?.data?.meta?.total}
        page={page}
        limit={20}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/restaurants/${r._id}`)}
        emptyMessage="No restaurants found"
      />
    </div>
  )
}
