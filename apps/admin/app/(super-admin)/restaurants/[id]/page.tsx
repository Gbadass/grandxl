'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminRestaurantsApi, adminUsersApi } from '@grandxl/api-client'
import type { User } from '@grandxl/types'
import { RestaurantApprovalStatus, UserRole } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { StatusBadge } from '../../../../src/components/ui/StatusBadge'
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog'
import '../../../../src/lib/axios'

type Action = 'approve' | 'reject' | 'suspend' | 'reinstate' | 'request-info' | 'terminate' | 'transfer' | null


export default function RestaurantDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [action, setAction] = useState<Action>(null)
  const [reason, setReason] = useState('')

  // Transfer-ownership modal state — kept separate so an aborted lookup
  // doesn't bleed into the reject/suspend/etc. reason field.
  //
  // Status `self_ok`  = matched user is current owner AND already has the role → block
  // Status `self_fix` = matched user is current owner but LACKS the role → allow (heal drift)
  const [transferIdentifier, setTransferIdentifier] = useState('')
  const [transferLookup, setTransferLookup] = useState<{
    status: 'idle' | 'loading' | 'found' | 'not_found' | 'self_ok' | 'self_fix'
    user: User | null
  }>({ status: 'idle', user: null })
  const transferLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      if (action === 'transfer') return adminRestaurantsApi.transferOwnership(id, { newOwnerIdentifier: transferIdentifier.trim() })
      throw new Error('Unknown action')
    },
    onSuccess: () => {
      toast.success(
        action === 'transfer'
          ? transferLookup.status === 'self_fix'
            ? 'Restaurant Owner role granted'
            : 'Ownership transferred'
          : 'Action completed',
      )
      void qc.invalidateQueries({ queryKey: ['admin', 'restaurant', id] })
      void qc.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
      setAction(null)
      setReason('')
      setTransferIdentifier('')
      setTransferLookup({ status: 'idle', user: null })
    },
    onError: (e) => toast.error(parseApiError(e, 'Action failed — please try again')),
  })

  // Debounced lookup so the admin sees who they're transferring to before
  // confirming. Same UX as the onboard flow. Compares against the current
  // owner to catch no-op transfers before hitting the backend.
  const lookupNewOwner = useCallback((raw: string) => {
    if (transferLookupTimer.current) clearTimeout(transferLookupTimer.current)
    const value = raw.trim()
    if (!value) {
      setTransferLookup({ status: 'idle', user: null })
      return
    }
    setTransferLookup({ status: 'loading', user: null })
    transferLookupTimer.current = setTimeout(async () => {
      try {
        const res = await adminUsersApi.list({ search: value, limit: 1 })
        const users = res.data.data.data
        const matched = users[0]
        if (matched && (matched.phone === value || matched.email === value.toLowerCase())) {
          if (restaurant && matched._id === restaurant.ownerId) {
            // Same person as current owner. Distinguish role-drift (heal) from
            // true no-op so the confirm button + copy react correctly.
            const hasOwnerRole = matched.roles?.includes(UserRole.RESTAURANT_OWNER)
            setTransferLookup({ status: hasOwnerRole ? 'self_ok' : 'self_fix', user: matched })
          } else {
            setTransferLookup({ status: 'found', user: matched })
          }
        } else {
          setTransferLookup({ status: 'not_found', user: null })
        }
      } catch {
        setTransferLookup({ status: 'idle', user: null })
      }
    }, 500)
  }, [restaurant])

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
            onClick={() => setAction('transfer')}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Transfer Ownership
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
            : action === 'transfer'
            ? 'Transfer Ownership'
            : 'Request More Information'
        }
        confirmLabel={
          action === 'approve' || action === 'reinstate'
            ? 'Confirm'
            : action === 'terminate'
            ? 'Terminate'
            : action === 'transfer'
            ? transferLookup.status === 'self_fix'
              ? 'Grant Owner Role'
              : 'Transfer'
            : action === 'reject' || action === 'suspend'
            ? action.charAt(0).toUpperCase() + action.slice(1)
            : 'Send Request'
        }
        confirmVariant={action === 'reject' || action === 'suspend' || action === 'terminate' ? 'danger' : 'primary'}
        loading={mutation.isPending}
        confirmDisabled={
          action === 'transfer' &&
          transferLookup.status !== 'found' &&
          transferLookup.status !== 'self_fix'
        }
        onConfirm={() => mutation.mutate()}
        onCancel={() => {
          setAction(null)
          setReason('')
          setTransferIdentifier('')
          setTransferLookup({ status: 'idle', user: null })
        }}
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
        {action === 'transfer' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Reassigns <strong className="text-gray-900">{restaurant.name}</strong> to a different existing GrandXL user.
              The new owner is granted the <strong>Restaurant Owner</strong> role automatically. The previous owner keeps
              their existing role (they may own other restaurants).
            </p>
            <input
              type="text"
              value={transferIdentifier}
              onChange={(e) => {
                setTransferIdentifier(e.target.value)
                lookupNewOwner(e.target.value)
              }}
              placeholder="New owner phone (+2348012345678) or email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              autoFocus
            />
            {transferLookup.status === 'loading' && (
              <p className="text-xs text-gray-500">Looking up account…</p>
            )}
            {transferLookup.status === 'not_found' && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                No GrandXL account found for this identifier. The new owner must already have an account —
                create one first via the onboarding flow if needed.
              </div>
            )}
            {transferLookup.status === 'self_ok' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                This user is already the current owner and has the Restaurant Owner role — no change needed.
              </div>
            )}
            {transferLookup.status === 'self_fix' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <p className="font-semibold">Role drift detected</p>
                <p className="mt-0.5">
                  {transferLookup.user?.firstName} {transferLookup.user?.lastName} is already this
                  restaurant&apos;s owner in the database but is missing the <strong>Restaurant Owner</strong> role
                  (likely legacy data). Confirming will grant the role — no ownership change.
                </p>
              </div>
            )}
            {transferLookup.status === 'found' && transferLookup.user && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                <p className="font-semibold">
                  {transferLookup.user.firstName} {transferLookup.user.lastName}
                </p>
                <p className="mt-0.5">
                  {transferLookup.user.email && <>Email: {transferLookup.user.email} · </>}
                  Phone: {transferLookup.user.phone ?? '—'}
                </p>
                {transferLookup.user.roles?.includes(UserRole.SUPER_ADMIN) && (
                  <p className="mt-1 font-medium text-amber-700">
                    ⚠ This user is a super admin. Transferring will also give them the Restaurant Owner role.
                  </p>
                )}
              </div>
            )}
          </div>
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
