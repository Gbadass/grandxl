'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminRefundsApi } from '@grandxl/api-client'
import type { RefundRequest, RefundStatus } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog'
import '../../../src/lib/axios'

const STATUS_FILTERS: { value: RefundStatus | undefined; label: string }[] = [
  { value: undefined,   label: 'All'       },
  { value: 'pending',   label: 'Pending'   },
  { value: 'approved',  label: 'Approved'  },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected',  label: 'Rejected'  },
  { value: 'failed',    label: 'Failed'    },
]

function formatNaira(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function statusBadge(s: RefundStatus) {
  switch (s) {
    case 'pending':   return { label: 'Pending',   color: 'bg-amber-100 text-amber-700'   }
    case 'approved':  return { label: 'Processing', color: 'bg-blue-100 text-blue-700'    }
    case 'completed': return { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' }
    case 'rejected':  return { label: 'Rejected',  color: 'bg-gray-100 text-gray-600'     }
    case 'failed':    return { label: 'Failed',    color: 'bg-red-100 text-red-700'       }
  }
}

interface DecisionState {
  refundId: string
  decision: 'approve' | 'reject'
  method:   'original' | 'wallet'
  note:     string
}

export default function AdminRefundsPage() {
  const qc = useQueryClient()
  const [status, setStatus]                 = useState<RefundStatus | undefined>('pending')
  const [decisionState, setDecisionState]   = useState<DecisionState | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'refunds', status],
    queryFn:  () => adminRefundsApi.list({ status, limit: 100 }).then((r) => r.data.data),
  })

  const items: RefundRequest[] = data?.items ?? []

  const decideMutation = useMutation({
    mutationFn: () => {
      if (!decisionState) throw new Error('No decision context')
      return adminRefundsApi.decide(decisionState.refundId, {
        decision:     decisionState.decision,
        method:       decisionState.decision === 'approve' ? decisionState.method : undefined,
        decisionNote: decisionState.note || undefined,
      })
    },
    onSuccess: () => {
      toast.success(decisionState?.decision === 'approve' ? 'Refund approved' : 'Refund rejected')
      setDecisionState(null)
      qc.invalidateQueries({ queryKey: ['admin', 'refunds'] })
    },
    onError: (err: unknown) => toast.error(parseApiError(err, 'Decision failed')),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds & Disputes"
        subtitle="Review and decide on customer refund requests"
      />

      {/* Status tabs */}
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

      {/* List */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No refund requests in this view</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
              <tr>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((r) => {
                const badge = statusBadge(r.status)
                return (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(r.createdAt).toLocaleString('en-NG', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.orderId.slice(-8)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatNaira(r.amountKobo)}</td>
                    <td className="px-4 py-3 max-w-xs text-gray-600 truncate" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.color}`}>
                        {badge.label}
                      </span>
                      {r.decisionNote && (
                        <div className="mt-1 text-xs text-gray-500 italic max-w-xs truncate" title={r.decisionNote}>
                          {r.decisionNote}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'pending' && (
                        <div className="inline-flex gap-2">
                          <button
                            className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            onClick={() => setDecisionState({
                              refundId: r._id, decision: 'approve', method: 'wallet', note: '',
                            })}
                          >
                            Approve
                          </button>
                          <button
                            className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                            onClick={() => setDecisionState({
                              refundId: r._id, decision: 'reject', method: 'wallet', note: '',
                            })}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Decision dialog */}
      {decisionState && (
        <ConfirmDialog
          open
          title={decisionState.decision === 'approve' ? 'Approve refund?' : 'Reject refund?'}
          description={
            decisionState.decision === 'approve'
              ? 'Pick the refund method. Wallet credits land instantly; original card takes 5–10 business days via Paystack.'
              : 'The customer will see the rejection in their order detail. Adding a note is recommended.'
          }
          confirmLabel={decisionState.decision === 'approve' ? 'Approve' : 'Reject'}
          confirmVariant={decisionState.decision === 'approve' ? 'primary' : 'danger'}
          loading={decideMutation.isPending}
          onConfirm={() => decideMutation.mutate()}
          onCancel={() => setDecisionState(null)}
        >
          {decisionState.decision === 'approve' && (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">Refund method</label>
              <div className="flex gap-3">
                <label className={`flex-1 cursor-pointer rounded-lg border p-3 ${
                  decisionState.method === 'wallet' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}>
                  <input
                    type="radio"
                    name="method"
                    className="sr-only"
                    checked={decisionState.method === 'wallet'}
                    onChange={() => setDecisionState({ ...decisionState, method: 'wallet' })}
                  />
                  <div className="text-sm font-semibold text-gray-900">Wallet credit</div>
                  <div className="text-xs text-gray-500">Instant. Customer can spend on next order.</div>
                </label>
                <label className={`flex-1 cursor-pointer rounded-lg border p-3 ${
                  decisionState.method === 'original' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}>
                  <input
                    type="radio"
                    name="method"
                    className="sr-only"
                    checked={decisionState.method === 'original'}
                    onChange={() => setDecisionState({ ...decisionState, method: 'original' })}
                  />
                  <div className="text-sm font-semibold text-gray-900">Original card</div>
                  <div className="text-xs text-gray-500">5–10 days via Paystack reversal.</div>
                </label>
              </div>
            </div>
          )}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
            <textarea
              className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-orange-500"
              rows={2}
              placeholder={decisionState.decision === 'approve'
                ? 'e.g. Approved after speaking to customer'
                : 'e.g. Order was delivered correctly per restaurant logs'}
              value={decisionState.note}
              onChange={(e) => setDecisionState({ ...decisionState, note: e.target.value })}
            />
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}
