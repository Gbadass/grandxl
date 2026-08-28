'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminRidersApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { RiderUser } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { StatusBadge } from '../../../../src/components/ui/StatusBadge'
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog'
import '../../../../src/lib/axios'

// Sprint 13 (S13-7): reject_kyc added — bounces uploaded docs back with a
// reason so the rider knows what to fix before they can be verified.
type Action = 'verify' | 'reject_kyc' | 'suspend' | 'reinstate' | 'terminate' | null

export default function RiderDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [action, setAction] = useState<Action>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'rider', id],
    queryFn: () => adminRidersApi.getById(id),
    enabled: !!id && isAuthenticated,
  })

  const rider = data?.data?.data
  const riderUser: RiderUser | null =
    rider?.userId && typeof rider.userId === 'object' ? rider.userId as RiderUser : null
  const riderName = riderUser ? `${riderUser.firstName} ${riderUser.lastName}` : 'Rider'

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === 'verify')     return adminRidersApi.verify(id)
      if (action === 'reject_kyc') return adminRidersApi.rejectKyc(id, reason)
      if (action === 'reinstate')  return adminRidersApi.reinstate(id)
      if (action === 'suspend')    return adminRidersApi.suspend(id, { reason })
      if (action === 'terminate')  return adminRidersApi.terminate(id, { reason })
      throw new Error('Unknown action')
    },
    onSuccess: () => {
      toast.success('Action completed')
      void qc.invalidateQueries({ queryKey: ['admin', 'rider', id] })
      void qc.invalidateQueries({ queryKey: ['admin', 'riders'] })
      setAction(null)
      setReason('')
    },
    onError: () => toast.error('Action failed — please try again'),
  })

  if (isInitializing || isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
    )
  }

  if (!rider) return <p className="text-gray-500">Rider not found.</p>

  const isTerminated = !!rider.terminatedAt
  const isSuspended  = rider.isSuspended && !isTerminated
  const needsReason  = action === 'suspend' || action === 'terminate' || action === 'reject_kyc'

  const docs = [
    { label: 'Government ID',    key: 'idCard',        url: rider.documents.idCard        },
    { label: "Driver's License", key: 'driverLicense',  url: rider.documents.driverLicense },
    { label: 'Vehicle Photo',    key: 'vehiclePhoto',   url: rider.documents.vehiclePhoto  },
  ]
  const allDocsUploaded = docs.every((d) => !!d.url)

  return (
    <div>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="Document" className="max-h-[85vh] rounded-xl object-contain" />
            <button
              onClick={() => setLightbox(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <PageHeader
        title={riderName}
        subtitle={`${rider.vehicleType}${rider.vehiclePlate ? ` · ${rider.vehiclePlate}` : ''} · ID: ${rider._id}`}
        action={
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            ← Back
          </button>
        }
      />

      {/* Status + Actions bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          {isTerminated ? (
            <StatusBadge label="Terminated" variant="red" />
          ) : isSuspended ? (
            <StatusBadge label="Suspended" variant="red" />
          ) : rider.isVerified ? (
            <StatusBadge label="Verified" variant="green" />
          ) : (
            <StatusBadge label="Pending KYC" variant="yellow" />
          )}
          <StatusBadge
            label={rider.isOnline ? 'Online' : 'Offline'}
            variant={rider.isOnline ? 'green' : 'gray'}
          />
        </div>
        <div className="flex-1" />

        {/* Verify — only when unverified, not suspended/terminated */}
        {!rider.isVerified && !isSuspended && !isTerminated && (
          <button
            onClick={() => setAction('verify')}
            disabled={!allDocsUploaded}
            title={!allDocsUploaded ? 'Rider must upload all 3 documents first' : ''}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Verify Rider
          </button>
        )}

        {/* Sprint 13 (S13-7): Reject KYC — only when docs uploaded, not yet
            verified, not suspended/terminated. Bounces docs back with a reason
            instead of the admin having to silently leave the rider stuck. */}
        {!rider.isVerified && !isSuspended && !isTerminated && allDocsUploaded && (
          <button
            onClick={() => setAction('reject_kyc')}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Reject KYC
          </button>
        )}

        {/* Suspend — only active, non-terminated riders */}
        {!isSuspended && !isTerminated && (
          <button
            onClick={() => setAction('suspend')}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            Suspend
          </button>
        )}

        {/* Reinstate — only suspended */}
        {isSuspended && (
          <button
            onClick={() => setAction('reinstate')}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Reinstate
          </button>
        )}

        {/* Terminate — permanent, always show unless already terminated */}
        {!isTerminated && (
          <button
            onClick={() => setAction('terminate')}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Terminate
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contact */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center gap-4">
            {riderUser?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={riderUser.avatar} alt={riderName} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-600">
                {riderUser ? `${riderUser.firstName[0]}${riderUser.lastName[0]}`.toUpperCase() : '?'}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-gray-900">{riderName}</p>
              <p className="text-sm text-gray-400">{riderUser?.phone ?? '—'}</p>
            </div>
          </div>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Phone"  value={riderUser?.phone ?? '—'} />
            <InfoRow label="Email"  value={riderUser?.email ?? '—'} />
          </dl>
        </div>

        {/* Rider info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Rider Info</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Vehicle type"     value={rider.vehicleType} />
            <InfoRow label="Vehicle plate"    value={rider.vehiclePlate ?? '—'} />
            <InfoRow label="Total deliveries" value={String(rider.totalDeliveries)} />
            <InfoRow label="Rating"           value={rider.ratingCount > 0 ? `${rider.rating.toFixed(1)} (${rider.ratingCount})` : '—'} />
            <InfoRow label="Member since"     value={new Date(rider.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
          </dl>
        </div>

        {/* Earnings */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Earnings</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Total earned"    value={formatMoney(rider.earnings.totalKobo, 'NGN')} />
            <InfoRow label="Pending payout"  value={formatMoney(Math.max(0, rider.earnings.pendingKobo), 'NGN')} />
          </dl>
        </div>

        {/* Suspension note */}
        {isSuspended && rider.suspensionReason && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="mb-2 font-semibold text-amber-800">Suspension Note</h2>
            <p className="text-sm text-amber-700">{rider.suspensionReason}</p>
          </div>
        )}

        {/* Termination details — full width */}
        {isTerminated && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 lg:col-span-2">
            <h2 className="mb-3 font-semibold text-red-800">Termination Details</h2>
            <dl className="space-y-3 text-sm">
              {rider.terminatedAt && (
                <InfoRow label="Terminated on" value={new Date(rider.terminatedAt).toLocaleString()} />
              )}
              {rider.terminationReason && (
                <InfoRow label="Reason" value={rider.terminationReason} />
              )}
            </dl>
          </div>
        )}

        {/* Documents — full width */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">KYC Documents</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                {allDocsUploaded
                  ? 'All documents uploaded — click to review before verifying'
                  : `${docs.filter((d) => d.url).length}/3 documents uploaded`}
              </p>
            </div>
            {!allDocsUploaded && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                Incomplete
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {docs.map((doc) => (
              <div key={doc.key} className="overflow-hidden rounded-xl border border-gray-200">
                {doc.url ? (
                  <button
                    onClick={() => setLightbox(doc.url!)}
                    className="group relative block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={doc.url}
                      alt={doc.label}
                      className="h-44 w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                      <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-800 opacity-0 transition-opacity group-hover:opacity-100">
                        View full
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="flex h-44 items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mb-2 h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      <p className="text-xs text-gray-400">Not uploaded</p>
                    </div>
                  </div>
                )}
                <div className={`flex items-center justify-between px-3 py-2.5 ${doc.url ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className="text-sm font-medium text-gray-700">{doc.label}</span>
                  <span className={`text-xs font-semibold ${doc.url ? 'text-green-600' : 'text-red-500'}`}>
                    {doc.url ? '✓ Uploaded' : '✗ Missing'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Sprint 13 (S13-7): rejection banner takes precedence over the
              docs-status banner — surfaces the reason admin sent last time so
              anyone reviewing knows what the rider was asked to fix. */}
          {!rider.isVerified && !isTerminated && rider.kycRejectionReason && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
                KYC previously rejected {rider.kycRejectedAt ? `on ${new Date(rider.kycRejectedAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
              </p>
              <p className="mt-1 text-sm text-red-900">&ldquo;{rider.kycRejectionReason}&rdquo;</p>
              <p className="mt-1 text-xs text-red-700">Rider was notified. Wait for re-upload, then verify to clear this state.</p>
            </div>
          )}

          {!rider.isVerified && !isTerminated && !rider.kycRejectionReason && (
            <div className={`mt-4 rounded-lg p-3 text-sm ${
              allDocsUploaded
                ? 'bg-green-50 text-green-800'
                : 'bg-amber-50 text-amber-800'
            }`}>
              {allDocsUploaded
                ? '✓ All documents received. Review the images above and click "Verify Rider" to approve or "Reject KYC" to ask for changes.'
                : '⚠ Rider has not uploaded all required documents yet. Ask them to complete the app onboarding.'}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={action !== null}
        title={
          action === 'verify'     ? 'Verify Rider' :
          action === 'reject_kyc' ? 'Reject KYC — ask rider to re-upload' :
          action === 'suspend'    ? 'Suspend Rider' :
          action === 'reinstate'  ? 'Reinstate Rider' :
          'Terminate Rider'
        }
        confirmLabel={
          action === 'verify' || action === 'reinstate' ? 'Confirm' :
          action === 'terminate' ? 'Terminate' :
          action === 'reject_kyc' ? 'Send rejection' :
          'Suspend'
        }
        confirmVariant={action === 'suspend' || action === 'terminate' || action === 'reject_kyc' ? 'danger' : 'primary'}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        onCancel={() => { setAction(null); setReason('') }}
      >
        {needsReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={action === 'reject_kyc'
              ? 'Tell the rider exactly what to fix (e.g. "License photo is blurry — retake in daylight")…'
              : 'Reason…'}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        )}
      </ConfirmDialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  )
}
