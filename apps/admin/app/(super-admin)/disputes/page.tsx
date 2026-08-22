'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { disputesApi } from '@grandxl/api-client'
import type { Dispute, DisputeStatus } from '@grandxl/types'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import '../../../src/lib/axios'

const STATUS_FILTERS: { value: DisputeStatus | undefined; label: string }[] = [
  { value: undefined,        label: 'All'          },
  { value: 'open',           label: 'Open'         },
  { value: 'under_review',   label: 'Under Review' },
  { value: 'resolved',       label: 'Resolved'     },
  { value: 'closed',         label: 'Closed'       },
]

function statusBadge(s: DisputeStatus) {
  switch (s) {
    case 'open':         return { label: 'Open',         color: 'bg-red-100 text-red-700'       }
    case 'under_review': return { label: 'Under Review', color: 'bg-amber-100 text-amber-700'   }
    case 'resolved':     return { label: 'Resolved',     color: 'bg-emerald-100 text-emerald-700' }
    case 'closed':       return { label: 'Closed',       color: 'bg-gray-100 text-gray-600'     }
  }
}

interface ReviewState {
  dispute: Dispute
}

function DisputeModal({
  dispute,
  onClose,
  onResolve,
  isResolving,
}: {
  dispute: Dispute
  onClose: () => void
  onResolve: (resolution: string) => void
  isResolving: boolean
}) {
  const [resolution, setResolution] = useState(dispute.resolution ?? '')
  const badge = statusBadge(dispute.status)
  const canResolve = dispute.status === 'open' || dispute.status === 'under_review'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end">
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Dispute Review</h2>
            <p className="text-sm text-gray-500">Order #{dispute.orderId.slice(-8).toUpperCase()}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status + Type */}
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.color}`}>
              {badge.label}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              {dispute.type}
            </span>
          </div>

          {/* Details card */}
          <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Order</p>
              <p className="mt-0.5 font-mono text-sm text-gray-800">{dispute.orderId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Customer</p>
              <p className="mt-0.5 font-mono text-sm text-gray-800">{dispute.customerId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Submitted</p>
              <p className="mt-0.5 text-sm text-gray-800">
                {new Date(dispute.createdAt).toLocaleString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Description</p>
              <p className="mt-0.5 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {dispute.description}
              </p>
            </div>
            {dispute.resolution && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Resolution</p>
                <p className="mt-0.5 text-sm text-emerald-700 leading-relaxed">{dispute.resolution}</p>
              </div>
            )}
          </div>

          {/* Resolution textarea — only shown when dispute can be resolved */}
          {canResolve && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Resolution
              </label>
              <textarea
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                rows={4}
                placeholder="Describe how this dispute was resolved…"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {canResolve && (
          <div className="border-t px-6 py-4">
            <button
              onClick={() => onResolve(resolution)}
              disabled={isResolving || !resolution.trim()}
              className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 active:bg-orange-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isResolving ? 'Resolving…' : 'Mark Resolved'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminDisputesPage() {
  const qc = useQueryClient()
  const [status, setStatus] = useState<DisputeStatus | undefined>(undefined)
  const [reviewState, setReviewState] = useState<ReviewState | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'disputes', status],
    queryFn: () =>
      disputesApi.listAll({ status, limit: 100 }).then((r) => r.data.data),
  })

  const items: Dispute[] = data?.data ?? []

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      disputesApi.resolve(id, resolution),
    onSuccess: () => {
      toast.success('Dispute marked as resolved')
      setReviewState(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'disputes'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not resolve dispute'
      toast.error(msg)
    },
  })

  function openReview(dispute: Dispute) {
    setReviewState({ dispute })
  }

  function handleResolve(resolution: string) {
    if (!reviewState) return
    resolveMutation.mutate({ id: reviewState.dispute._id, resolution })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disputes"
        subtitle="Review and resolve customer disputes"
      />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 border-b">
        {STATUS_FILTERS.map((f) => {
          const isActive = status === f.value
          return (
            <button
              key={f.label}
              onClick={() => setStatus(f.value)}
              className={`relative px-4 py-2 text-sm font-medium transition ${
                isActive ? 'text-orange-600' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {f.label}
              {isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-orange-600" />}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No disputes in this view</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((d) => {
                const badge = statusBadge(d.status)
                return (
                  <tr key={d._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      #{d.orderId.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {d.customerId.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{d.type}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(d.createdAt).toLocaleString('en-NG', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openReview(d)}
                        className="rounded-md bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-over modal */}
      {reviewState && (
        <DisputeModal
          dispute={reviewState.dispute}
          onClose={() => setReviewState(null)}
          onResolve={handleResolve}
          isResolving={resolveMutation.isPending}
        />
      )}
    </div>
  )
}
