'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { adminRidersApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { Rider, RiderUser } from '@grandxl/types'

function riderUser(r: Rider): RiderUser | null {
  return r.userId && typeof r.userId === 'object' ? r.userId as RiderUser : null
}
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { StatusBadge } from '../../../src/components/ui/StatusBadge'
import '../../../src/lib/axios'

export default function RidersPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'riders', page],
    queryFn: () => adminRidersApi.list({ page, limit: 20 }),
    enabled: isAuthenticated,
  })

  const columns: Column<Rider>[] = [
    {
      key: 'rider',
      header: 'Rider',
      render: (r) => {
        const u = riderUser(r)
        const initials = u ? `${u.firstName[0]}${u.lastName[0]}`.toUpperCase() : '?'
        const name     = u ? `${u.firstName} ${u.lastName}` : 'Unknown'
        const phone    = u?.phone ?? '—'
        return (
          <div className="flex items-center gap-3">
            {u?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.avatar} alt={name} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-600">
                {initials}
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">{name}</p>
              <p className="text-xs text-gray-400">{phone}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (r) => (
        <div>
          <p className="font-medium capitalize text-gray-900">{r.vehicleType}</p>
          <p className="text-xs text-gray-400">{r.vehiclePlate ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Verified',
      render: (r) => (
        <StatusBadge
          label={r.isVerified ? 'Verified' : 'Unverified'}
          variant={r.isVerified ? 'green' : 'yellow'}
        />
      ),
    },
    {
      key: 'online',
      header: 'Online',
      render: (r) => (
        <StatusBadge
          label={r.isOnline ? 'Online' : 'Offline'}
          variant={r.isOnline ? 'green' : 'gray'}
        />
      ),
    },
    {
      key: 'deliveries',
      header: 'Deliveries',
      render: (r) => <span className="font-medium">{r.totalDeliveries}</span>,
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
            </>
          ) : '—'}
        </span>
      ),
    },
  ]

  if (isInitializing) return null

  return (
    <div>
      <PageHeader title="Riders" subtitle="Manage rider applications and accounts" />
      <DataTable
        columns={columns}
        data={(data?.data?.data?.data ?? []) as Rider[]}
        loading={isLoading}
        total={data?.data?.data?.meta?.total}
        page={page}
        limit={20}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/riders/${r._id}`)}
        emptyMessage="No riders yet"
      />
    </div>
  )
}
