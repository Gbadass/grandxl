'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminReviewsApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { Review } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import '../../../src/lib/axios'

export default function ReviewsModerationPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews', 'flagged', page],
    queryFn: () => adminReviewsApi.getFlagged({ page, limit: 20 }),
    enabled: isAuthenticated,
  })

  const visibilityMutation = useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      adminReviewsApi.setVisibility(id, { isVisible }),
    onSuccess: (_, vars) => {
      toast.success(vars.isVisible ? 'Review restored' : 'Review hidden')
      void qc.invalidateQueries({ queryKey: ['admin', 'reviews', 'flagged'] })
    },
    onError: () => toast.error('Failed to update review'),
  })

  const columns: Column<Review>[] = [
    {
      key: 'ratings',
      header: 'Ratings',
      render: (r) => (
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 font-medium text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-amber-400">
              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
            </svg>
            {r.restaurantRating}/5
          </span>
          {r.riderRating !== null && (
            <span className="text-xs text-gray-400">Rider: {r.riderRating}/5</span>
          )}
          {r.foodRating !== null && (
            <span className="text-xs text-gray-400">Food: {r.foodRating}/5</span>
          )}
        </div>
      ),
    },
    {
      key: 'comment',
      header: 'Comment',
      render: (r) => (
        <p className="max-w-xs truncate text-sm text-gray-700">
          {r.comment ?? <span className="italic text-gray-400">No comment</span>}
        </p>
      ),
    },
    {
      key: 'date',
      header: 'Date',
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
    {
      key: 'visibility',
      header: 'Visibility',
      render: (r) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
          r.isVisible
            ? 'bg-green-50 text-green-700 ring-green-600/20'
            : 'bg-red-50 text-red-600 ring-red-500/20'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${r.isVisible ? 'bg-green-500' : 'bg-red-500'}`} />
          {r.isVisible ? 'Visible' : 'Hidden'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            visibilityMutation.mutate({ id: r._id, isVisible: !r.isVisible })
          }}
          disabled={visibilityMutation.isPending}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
            r.isVisible
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          }`}
        >
          {r.isVisible ? 'Hide' : 'Restore'}
        </button>
      ),
    },
  ]

  if (isInitializing) return null

  return (
    <div>
      <PageHeader
        title="Reviews"
        subtitle="Flagged reviews requiring moderation"
      />

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4 flex-shrink-0 text-amber-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-xs font-medium text-amber-800">
          These reviews were flagged by the system or customers. Hidden reviews are not shown on restaurant listings.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={(data?.data?.data?.data ?? []) as Review[]}
        loading={isLoading}
        total={data?.data?.data?.meta?.total}
        page={page}
        limit={20}
        onPageChange={setPage}
        emptyMessage="No flagged reviews"
      />
    </div>
  )
}
