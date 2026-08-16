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
import '../../../../src/lib/axios'

export default function RiderDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [lightbox, setLightbox] = useState<string | null>(null)

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

  const verifyMutation = useMutation({
    mutationFn: () => adminRidersApi.verify(id),
    onSuccess: () => {
      toast.success('Rider verified — they will be notified')
      void qc.invalidateQueries({ queryKey: ['admin', 'rider', id] })
      void qc.invalidateQueries({ queryKey: ['admin', 'riders'] })
    },
    onError: () => toast.error('Verification failed'),
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
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              ← Back
            </button>
            {!rider.isVerified && (
              <button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || !allDocsUploaded}
                title={!allDocsUploaded ? 'Rider must upload all 3 documents first' : ''}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifyMutation.isPending ? 'Verifying…' : 'Verify Rider'}
              </button>
            )}
          </div>
        }
      />

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
            <InfoRow label="Verified"         value={<StatusBadge label={rider.isVerified ? 'Verified' : 'Not verified'} variant={rider.isVerified ? 'green' : 'yellow'} />} />
            <InfoRow label="Status"           value={<StatusBadge label={rider.isOnline ? 'Online' : 'Offline'} variant={rider.isOnline ? 'green' : 'gray'} />} />
            <InfoRow label="Total deliveries" value={String(rider.totalDeliveries)} />
            <InfoRow label="Rating"           value={rider.ratingCount > 0 ? `${rider.rating.toFixed(1)} (${rider.ratingCount})` : '—'} />
          </dl>
        </div>

        {/* Earnings */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-gray-900">Earnings</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Total earned"    value={formatMoney(rider.earnings.totalKobo, 'NGN')} />
            <InfoRow label="Pending payout"  value={formatMoney(rider.earnings.pendingKobo, 'NGN')} />
          </dl>
        </div>

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

          {!rider.isVerified && (
            <div className={`mt-4 rounded-lg p-3 text-sm ${
              allDocsUploaded
                ? 'bg-green-50 text-green-800'
                : 'bg-amber-50 text-amber-800'
            }`}>
              {allDocsUploaded
                ? '✓ All documents received. Review the images above and click "Verify Rider" to approve.'
                : '⚠ Rider has not uploaded all required documents yet. Ask them to complete the app onboarding.'}
            </div>
          )}
        </div>
      </div>
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
