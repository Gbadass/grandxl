'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Check, Loader2, X } from 'lucide-react'
import { UserRole } from '@grandxl/types'
import { formatMoney, parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { adminPayoutsApi } from '@grandxl/api-client'
import type { PayoutRequest, PayoutRequestForAdmin, PayoutEntityType } from '@grandxl/api-client'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog'
import '../../../src/lib/axios'

type TabStatus = 'all' | 'pending' | 'approved' | 'paid' | 'rejected'
type TabEntity = 'all' | PayoutEntityType

const TAB_LABELS: { key: TabStatus; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid',     label: 'Paid' },
  { key: 'rejected', label: 'Rejected' },
]

const ENTITY_TAB_LABELS: { key: TabEntity; label: string }[] = [
  { key: 'all',        label: 'All types' },
  { key: 'rider',      label: 'Riders' },
  { key: 'restaurant', label: 'Restaurants' },
]

const ENTITY_STYLES: Record<PayoutEntityType, string> = {
  rider:      'bg-indigo-50 text-indigo-700 ring-indigo-200',
  restaurant: 'bg-orange-50 text-orange-700 ring-orange-200',
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  paid:     'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function PayoutsPage() {
  const router      = useRouter()
  const queryClient = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [tab,       setTab]       = useState<TabStatus>('all')
  const [entityTab, setEntityTab] = useState<TabEntity>('all')
  const [page, setPage] = useState(1)
  const [rejectId,   setRejectId]   = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  // Sprint 13 (S13-9): multi-select for batch approve. Set for O(1) hit-tests.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts', tab, entityTab, page],
    queryFn: () =>
      adminPayoutsApi
        .list({
          status:     tab       === 'all' ? undefined : (tab       as PayoutRequest['status']),
          entityType: entityTab === 'all' ? undefined : (entityTab as PayoutEntityType),
          page,
          limit: 20,
        })
        .then((r) => r.data.data),
    staleTime: 30_000,
  })

  const { data: pendingData } = useQuery({
    queryKey: ['admin-payouts', 'pending', 1],
    queryFn: () => adminPayoutsApi.list({ status: 'pending', limit: 1 }).then((r) => r.data.data),
    staleTime: 30_000,
  })

  const items: PayoutRequestForAdmin[] = data?.items ?? []
  const total = data?.total ?? 0

  const totalPendingKobo = items
    .filter((p) => p.status === 'pending')
    .reduce((s, p) => s + p.amountKobo, 0)

  // Sprint 13 (S13-3): patch the affected row in-cache before invalidating so
  // the status pill updates the moment the server confirms — no waiting for a
  // full-table refetch to resolve. Then invalidate in the background so any
  // server-computed fields (transferReference, decidedAt) catch up.
  function patchRowStatus(id: string, next: PayoutRequest['status'], patch: Partial<PayoutRequestForAdmin> = {}) {
    queryClient.setQueriesData<{ items: PayoutRequestForAdmin[]; total: number; page: number; limit: number; pages: number } | undefined>(
      { queryKey: ['admin-payouts'] },
      (old) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.map((row) =>
            row._id === id ? { ...row, status: next, ...patch } : row,
          ),
        }
      },
    )
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      adminPayoutsApi.decide(id, { decision: 'approve', decisionNote: 'Approved — Paystack transfer initiated' }),
    onSuccess: (_res, id) => {
      patchRowStatus(id, 'approved', { decisionNote: 'Approved — Paystack transfer initiated' })
      // Background revalidation for server-computed fields — no `void` refetch flicker
      // because there's cached data, so `isLoading` stays false while `isFetching` goes true.
      void queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      adminPayoutsApi.decide(id, { decision: 'reject', decisionNote: note }),
    onSuccess: (_res, vars) => {
      patchRowStatus(vars.id, 'rejected', { decisionNote: vars.note })
      setRejectId(null)
      setRejectNote('')
      void queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
    },
  })

  // Sprint 13 (S13-9): batch-approve. Server iterates via the single-approve
  // logic so all invariants apply. Response returns per-id failure so we can
  // patch succeeded rows in-cache immediately and leave failed rows pending.
  const batchApproveMutation = useMutation({
    mutationFn: (ids: string[]) => adminPayoutsApi.batchApprove(ids, 'Batch approval'),
    onSuccess: (res, ids) => {
      const { succeeded, failed, failures } = res.data.data
      // Patch every ID that isn't in the failures list — we don't get the
      // list of succeeded IDs directly, but failures[].payoutId tells us
      // which ones DIDN'T flip.
      const failedIds = new Set(failures.map((f) => f.payoutId))
      for (const id of ids) {
        if (!failedIds.has(id)) {
          patchRowStatus(id, 'approved', { decisionNote: 'Approved — Paystack transfer initiated' })
        }
      }
      setSelectedIds(new Set())
      setBatchConfirmOpen(false)
      if (failed === 0) {
        toast.success(`${succeeded} payout${succeeded === 1 ? '' : 's'} approved`)
      } else {
        toast.error(`${succeeded} approved, ${failed} failed — ${failures[0]?.message ?? 'see console for details'}`)
        console.warn('[batch-approve] failures:', failures)
      }
      void queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
    },
    onError: (e: unknown) => {
      toast.error(parseApiError(e, 'Batch approve failed'))
      setBatchConfirmOpen(false)
    },
  })

  // Selectable = pending only (approved / paid / rejected rows have no
  // "approve" action, so no point selecting them).
  const selectablePending = useMemo(
    () => items.filter((p) => p.status === 'pending'),
    [items],
  )
  const allPendingSelected = selectablePending.length > 0
    && selectablePending.every((p) => selectedIds.has(p._id))
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleSelectAllPending() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPendingSelected) selectablePending.forEach((p) => next.delete(p._id))
      else                    selectablePending.forEach((p) => next.add(p._id))
      return next
    })
  }
  // Sum of selected amounts — shown in the sticky bar so admin sees the total.
  const selectedPendingKobo = useMemo(() => {
    return items
      .filter((p) => selectedIds.has(p._id) && p.status === 'pending')
      .reduce((s, p) => s + p.amountKobo, 0)
  }, [items, selectedIds])

  const columns: Column<PayoutRequestForAdmin>[] = [
    // Sprint 13 (S13-9): select-all + per-row checkboxes for batch approve.
    // Non-pending rows show a dash — approve only works on pending.
    {
      key: 'select',
      header: (
        <button
          onClick={toggleSelectAllPending}
          disabled={selectablePending.length === 0}
          aria-label={allPendingSelected ? 'Deselect all pending' : 'Select all pending'}
          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
            allPendingSelected
              ? 'bg-orange-600 border-orange-600 text-white'
              : 'border-gray-300 bg-white hover:border-orange-400'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {allPendingSelected && <Check size={11} strokeWidth={3} />}
        </button>
      ),
      render: (p) => {
        if (p.status !== 'pending') return <span className="text-xs text-gray-300">—</span>
        const on = selectedIds.has(p._id)
        return (
          <button
            onClick={(e) => { e.stopPropagation(); toggleSelect(p._id) }}
            aria-label={on ? 'Deselect' : 'Select'}
            className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
              on ? 'bg-orange-600 border-orange-600 text-white' : 'border-gray-300 bg-white hover:border-orange-400'
            }`}
          >
            {on && <Check size={11} strokeWidth={3} />}
          </button>
        )
      },
    },
    {
      key: 'entity',
      header: 'Type',
      render: (p) => {
        const type = (p.entityType ?? 'rider') as PayoutEntityType
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ring-1 ring-inset ${ENTITY_STYLES[type]}`}>
            {type}
          </span>
        )
      },
    },
    {
      key: 'counterparty',
      header: 'Counterparty / Bank',
      render: (p) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{p.entityName ?? p.accountName}</p>
          <p className="text-xs text-gray-400">{p.bankName} · {p.accountNumber}</p>
          <p className="text-xs text-gray-300 font-mono mt-0.5">{p._id.slice(-8)}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (p) => (
        <span className="font-bold tabular-nums text-gray-900 text-sm">
          {formatMoney(p.amountKobo, 'NGN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {p.status}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Requested',
      render: (p) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatDate(p.createdAt)}
        </span>
      ),
    },
    {
      key: 'ref',
      header: 'Transfer Ref',
      render: (p) => (
        p.transferReference ? (
          <span className="text-xs font-mono text-gray-500">{p.transferReference}</span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )
      ),
    },
    {
      key: 'note',
      header: 'Note',
      render: (p) => (
        p.decisionNote ? (
          <span className="text-xs text-gray-500 max-w-[160px] truncate block">{p.decisionNote}</span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p) => {
        if (p.status !== 'pending') return <span className="text-xs text-gray-300">—</span>
        // Sprint 13 (S13-3): row-scoped disabled — a mutation on any OTHER row
        // shouldn't dim every approve button on the page. Previously all N
        // buttons flickered to opacity-50 during a single approve request.
        const thisRowPending = approveMutation.isPending && approveMutation.variables === p._id
        return (
          <div className="flex items-center gap-2">
            <button
              disabled={thisRowPending}
              onClick={() => approveMutation.mutate(p._id)}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {thisRowPending ? 'Sending…' : 'Approve & Pay'}
            </button>
            <button
              onClick={() => { setRejectId(p._id); setRejectNote('') }}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
            >
              Reject
            </button>
          </div>
        )
      },
    },
  ]

  if (isInitializing) return null

  return (
    <div>
      <PageHeader
        title="Payouts"
        subtitle="Rider and restaurant payout requests — approve to send money via Paystack Transfer"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Pending Requests"
          value={String(pendingData?.total ?? 0)}
          sub="Awaiting your approval"
          icon="payouts"
          loading={isLoading}
        />
        <StatsCard
          title="Pending Amount"
          value={formatMoney(totalPendingKobo, 'NGN')}
          sub="On this page"
          icon="revenue"
          loading={isLoading}
        />
        <StatsCard
          title="Total Requests"
          value={String(total)}
          sub={`In "${tab}" view`}
          icon="riders"
          loading={isLoading}
        />
        <StatsCard
          title="Paystack Transfer"
          value="Auto"
          sub="Funds sent on approval"
          icon="active"
          loading={false}
        />
      </div>

      {/* Status tabs */}
      <div className="mb-3 flex gap-2 flex-wrap">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              tab === key
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            {label}
            {key === 'pending' && (pendingData?.total ?? 0) > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${tab === 'pending' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'}`}>
                {pendingData?.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Entity-type tabs */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {ENTITY_TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setEntityTab(key); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors cursor-pointer ${
              entityTab === key
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Approve error */}
      {approveMutation.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Approval failed: {(approveMutation.error as Error).message}. Check your Paystack balance and try again.
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        page={page}
        total={total}
        limit={20}
        onPageChange={setPage}
        emptyMessage="No payout requests found"
      />

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectId(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-gray-900">Reject payout</h3>
            <p className="mb-4 text-sm text-gray-500">The rider will see this reason.</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for rejection (optional)…"
              rows={3}
              className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20 resize-none"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejectId, note: rejectNote })}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sprint 13 (S13-9): sticky batch-approve bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed inset-x-0 bottom-6 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-white shadow-2xl"
          >
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tabular-nums">
              {selectedIds.size} selected
            </span>
            <span className="text-xs text-gray-400">
              Total: <span className="font-semibold tabular-nums text-white">{formatMoney(selectedPendingKobo, 'NGN')}</span>
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setBatchConfirmOpen(true)}
              disabled={batchApproveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 cursor-pointer"
            >
              {batchApproveMutation.isPending && <Loader2 size={12} className="animate-spin" />}
              <Check size={12} /> Approve {selectedIds.size}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sprint 13 (S13-9): confirm dialog for batch approve — high-value irreversible action */}
      <ConfirmDialog
        open={batchConfirmOpen}
        title={`Approve ${selectedIds.size} payout${selectedIds.size === 1 ? '' : 's'}?`}
        description={`Total: ${formatMoney(selectedPendingKobo, 'NGN')}. Paystack transfers will be initiated for each. Failures are reported per-payout — the batch continues on individual errors.`}
        confirmLabel={`Approve ${selectedIds.size}`}
        confirmVariant="primary"
        loading={batchApproveMutation.isPending}
        onConfirm={() => batchApproveMutation.mutate(Array.from(selectedIds))}
        onCancel={() => setBatchConfirmOpen(false)}
      />
    </div>
  )
}
