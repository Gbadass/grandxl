'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminRestaurantsApi } from '@grandxl/api-client'
import { RestaurantApprovalStatus, UserRole } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { StatusBadge } from '../../../../src/components/ui/StatusBadge'
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog'
import '../../../../src/lib/axios'

type Action = 'approve' | 'reject' | 'suspend' | 'reinstate' | 'request-info' | 'terminate' | null


export default function RestaurantDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [action, setAction] = useState<Action>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'restaurant', id],
    queryFn: () => adminRestaurantsApi.getById(id),
    enabled: !!id && isAuthenticated,
  })

  const restaurant = data?.data?.data

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === 'approve') return adminRestaurantsApi.approve(id)
      if (action === 'reinstate') return adminRestaurantsApi.reinstate(id)
      if (action === 'reject') return adminRestaurantsApi.reject(id, { reason })
      if (action === 'suspend') return adminRestaurantsApi.suspend(id, { reason })
      if (action === 'request-info') return adminRestaurantsApi.requestInfo(id, { message: reason })
      if (action === 'terminate') return adminRestaurantsApi.terminate(id, { reason })
      throw new Error('Unknown action')
    },
    onSuccess: () => {
      toast.success('Action completed')
      void qc.invalidateQueries({ queryKey: ['admin', 'restaurant', id] })
      void qc.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
      setAction(null)
      setReason('')
    },
    onError: (e) => toast.error(parseApiError(e, 'Action failed — please try again')),
  })

  if (isInitializing || isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
    )
  }

  if (!restaurant) {
    return <p className="text-gray-500">Restaurant not found.</p>
  }

  const approvalStatus = restaurant.approvalStatus
  const isPending = approvalStatus === RestaurantApprovalStatus.PENDING_REVIEW
  const isApproved = approvalStatus === RestaurantApprovalStatus.APPROVED
  const isSuspended = approvalStatus === RestaurantApprovalStatus.SUSPENDED
  const isRejected = approvalStatus === RestaurantApprovalStatus.REJECTED
  const isTerminated = approvalStatus === RestaurantApprovalStatus.TERMINATED

  const needsReason =
    action === 'reject' || action === 'suspend' || action === 'request-info' || action === 'terminate'

  return (
    <div>
      <PageHeader
        title={restaurant.name}
        subtitle={`${restaurant.address.city}, ${restaurant.address.state}`}
        action={
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            ← Back
          </button>
        }
      />

      {/* Status + Actions */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <StatusBadge
          label={approvalStatus.replace(/_/g, ' ')}
          restaurantStatus={approvalStatus}
        />
        <div className="flex-1" />
        {isPending && (
          <>
            <button
              onClick={() => setAction('approve')}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Approve
            </button>
            <button
              onClick={() => setAction('reject')}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Reject
            </button>
            <button
              onClick={() => setAction('request-info')}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Request Info
            </button>
          </>
        )}
        {isApproved && (
          <button
            onClick={() => setAction('suspend')}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Suspend
          </button>
        )}
        {(isSuspended || isRejected) && (
          <button
            onClick={() => setAction('reinstate')}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Reinstate
          </button>
        )}
        {!isTerminated && (
          <button
            onClick={() => setAction('terminate')}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Terminate
          </button>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Restaurant Info</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Phone" value={restaurant.phone} />
            <InfoRow label="Email" value={restaurant.email || '—'} />
            <InfoRow label="Cuisine" value={restaurant.cuisine?.join(', ') || '—'} />
            <InfoRow label="Rating" value={`${restaurant.rating.toFixed(1)} (${restaurant.ratingCount} reviews)`} />
            <InfoRow label="Est. delivery" value={`${restaurant.estimatedDeliveryTime ?? '—'} min`} />
            <InfoRow label="Min order" value={`₦${((restaurant.minOrderAmount ?? 0) / 100).toFixed(0)}`} />
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Address</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Street" value={restaurant.address.street} />
            <InfoRow label="City" value={restaurant.address.city} />
            <InfoRow label="State" value={restaurant.address.state} />
            <InfoRow label="Country" value={restaurant.address.country} />
          </dl>
        </div>

        {restaurant.approvalNote && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
            <h2 className="mb-2 font-semibold text-yellow-800">Approval Note</h2>
            <p className="text-sm text-yellow-700">{restaurant.approvalNote}</p>
          </div>
        )}

        {isTerminated && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 lg:col-span-2">
            <h2 className="mb-3 font-semibold text-red-800">Termination Details</h2>
            <dl className="space-y-3 text-sm">
              {restaurant.terminatedAt && (
                <InfoRow label="Terminated on" value={new Date(restaurant.terminatedAt).toLocaleString()} />
              )}
              {restaurant.terminationReason && (
                <InfoRow label="Reason" value={restaurant.terminationReason} />
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={action !== null}
        title={
          action === 'approve'
            ? 'Approve Restaurant'
            : action === 'reject'
            ? 'Reject Restaurant'
            : action === 'suspend'
            ? 'Suspend Restaurant'
            : action === 'reinstate'
            ? 'Reinstate Restaurant'
            : action === 'terminate'
            ? 'Terminate Restaurant'
            : 'Request More Information'
        }
        confirmLabel={
          action === 'approve' || action === 'reinstate'
            ? 'Confirm'
            : action === 'terminate'
            ? 'Terminate'
            : action === 'reject' || action === 'suspend'
            ? action.charAt(0).toUpperCase() + action.slice(1)
            : 'Send Request'
        }
        confirmVariant={action === 'reject' || action === 'suspend' || action === 'terminate' ? 'danger' : 'primary'}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        onCancel={() => { setAction(null); setReason('') }}
      >
        {needsReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={action === 'request-info' ? 'What information do you need?' : 'Reason…'}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        )}
      </ConfirmDialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 text-right">{value}</dd>
    </div>
  )
}
