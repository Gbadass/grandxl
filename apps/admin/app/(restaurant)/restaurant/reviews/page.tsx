'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { myRestaurantApi, reviewsApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { Review } from '@grandxl/types'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { DataTable, type Column } from '../../../../src/components/ui/DataTable'
import '../../../../src/lib/axios'

function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className={`h-3.5 w-3.5 ${i < Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`}>
          <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
        </svg>
      ))}
    </span>
  )
}

export default function RestaurantReviewsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data: restaurantsData } = useQuery({
    queryKey: ['my-restaurants'],
    queryFn: () => myRestaurantApi.list(),
    enabled: isAuthenticated,
  })

  const restaurantId = restaurantsData?.data?.data?.[0]?._id

  const { data, isLoading } = useQuery({
    queryKey: ['my-reviews', restaurantId, page],
    queryFn: () => reviewsApi.getByRestaurant(restaurantId!, { page, limit: 20 }),
    enabled: !!restaurantId,
  })

  const reviews = (data?.data?.data?.data ?? []) as Review[]

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.restaurantRating, 0) / reviews.length).toFixed(1)
    : null

  // Rating distribution (5 → 1)
  const dist = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.restaurantRating) === star).length
    const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0
    return { star, count, pct }
  })

  const columns: Column<Review>[] = [
    {
      key: 'rating',
      header: 'Rating',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Stars rating={r.restaurantRating} />
          <span className="text-sm font-medium text-gray-900">{r.restaurantRating}/5</span>
        </div>
      ),
    },
    {
      key: 'breakdown',
      header: 'Breakdown',
      render: (r) => (
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {r.foodRating !== null && <span>Food: <strong>{r.foodRating}/5</strong></span>}
          {r.riderRating !== null && <span>Rider: <strong>{r.riderRating}/5</strong></span>}
        </div>
      ),
    },
    {
      key: 'comment',
      header: 'Comment',
      render: (r) => (
        <p className="max-w-sm truncate text-sm text-gray-700">
          {r.comment ?? <span className="italic text-gray-400">No comment</span>}
        </p>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (r) => (
        <span className="text-xs text-gray-400">
          {new Date(r.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
  ]

  if (isInitializing) return null

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Customer feedback for your restaurant" />

      {avgRating && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white px-6 py-4 sm:flex-row sm:items-start">
          {/* Average rating block */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{avgRating}</p>
              <Stars rating={parseFloat(avgRating)} />
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div>
              <p className="text-sm font-medium text-gray-900">Average restaurant rating</p>
              <p className="text-xs text-gray-400">Based on {data?.data?.data?.meta?.total ?? reviews.length} reviews</p>
            </div>
          </div>

          {/* Distribution bars */}
          <div className="flex-1 sm:pl-4 sm:border-l sm:border-gray-200">
            <div className="space-y-1.5">
              {dist.map(({ star, count, pct }) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-6 flex-shrink-0 text-right text-xs font-medium text-gray-500">{star}★</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-2">
                    <div
                      className="h-2 rounded-full bg-amber-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-14 flex-shrink-0 text-xs text-gray-400">
                    {pct}% ({count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={reviews}
        loading={isLoading}
        total={data?.data?.data?.meta?.total}
        page={page}
        limit={20}
        onPageChange={setPage}
        emptyMessage="No reviews yet"
      />
    </div>
  )
}
