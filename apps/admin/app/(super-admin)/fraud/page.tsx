'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminFraudApi, adminUsersApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { User, RiskFlag } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import '../../../src/lib/axios'

// ── Flag catalog ─────────────────────────────────────────────────────────────
// Human-readable labels for known rule codes. Unknown codes fall back to the
// raw code — future rules light up automatically without a UI change.

const FLAG_LABELS: Record<string, { label: string; short: string; tone: 'red' | 'amber' }> = {
  payment_failures_24h: { label: 'Payment abuse',  short: 'Payment', tone: 'red'   },
  refund_velocity_7d:   { label: 'Refund abuse',   short: 'Refund',  tone: 'amber' },
}

function labelFor(code: string): string {
  return FLAG_LABELS[code]?.short ?? code
}

function toneClasses(code: string): string {
  const tone = FLAG_LABELS[code]?.tone ?? 'amber'
  return tone === 'red'
    ? 'bg-red-50 text-red-700 ring-red-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200'
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function mostRecentFlag(flags: RiskFlag[] | undefined): Date | null {
  if (!flags || flags.length === 0) return null
  const times = flags.map((f) => new Date(f.createdAt).getTime())
  return new Date(Math.max(...times))
}

// ── Filter pill (matches users page style) ───────────────────────────────────
function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-lg px-3.5 py-2 text-xs font-medium transition-all duration-150 ${
        active
          ? 'bg-gray-900 text-white shadow-sm'
          : 'border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )
}

// ── Detail slide-over ────────────────────────────────────────────────────────
function FlaggedUserPanel({
  user,
  onClose,
  onClearOne,
  onClearAll,
  clearingCode,
  clearingAll,
}: {
  user: User | null
  onClose: () => void
  onClearOne: (code: string) => void
  onClearAll: () => void
  clearingCode: string | null
  clearingAll: boolean
}) {
  if (!user) return null
  const flags = user.riskFlags ?? []

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Risk profile</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* User summary */}
          <div className="border-b border-gray-100 px-6 py-6">
            <h3 className="text-lg font-bold text-gray-900">{user.firstName} {user.lastName}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{user.email ?? '—'}</p>
            <p className="mt-0.5 font-mono text-xs text-gray-500">{user.phone ?? '—'}</p>
            {!user.isActive && (
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Banned
              </div>
            )}
          </div>

          {/* Flag list */}
          <div className="px-6 py-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Active flags ({flags.length})
              </h4>
              {flags.length > 1 && (
                <button
                  onClick={onClearAll}
                  disabled={clearingAll}
                  className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {clearingAll ? 'Clearing…' : 'Clear all'}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {flags.map((flag) => (
                <div
                  key={flag.code}
                  className={`rounded-xl border p-3 ${toneClasses(flag.code).replace('bg-', 'border-').replace('50', '100')} bg-white`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${toneClasses(flag.code)}`}>
                        {labelFor(flag.code)}
                      </span>
                      <p className="mt-2 text-sm text-gray-800">{flag.reason}</p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        Raised {timeAgo(flag.createdAt)} · <span className="font-mono">{flag.code}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => onClearOne(flag.code)}
                      disabled={clearingCode === flag.code}
                      className="flex-shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {clearingCode === flag.code ? 'Clearing…' : 'Clear'}
                    </button>
                  </div>
                </div>
              ))}
              {flags.length === 0 && (
                <p className="text-sm text-gray-500">No active flags.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
          <a
            href={`/users?search=${encodeURIComponent(user.email ?? user.phone ?? '')}`}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            View full user profile
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        </div>
      </div>
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
type CodeFilter = 'all' | 'payment_failures_24h' | 'refund_velocity_7d'

export default function FraudPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [page, setPage] = useState(1)
  const [codeFilter, setCodeFilter] = useState<CodeFilter>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState<User | null>(null)
  const [clearingCode, setClearingCode] = useState<string | null>(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-fraud', 'flagged-users', page, codeFilter, debouncedSearch],
    queryFn:  async () => {
      const res = await adminFraudApi.listFlagged({
        page,
        limit:  20,
        code:   codeFilter === 'all' ? undefined : codeFilter,
        search: debouncedSearch || undefined,
      })
      // Unwrap the { success, data: { data: User[], meta } } envelope so
      // consumers see the friendlier { data, meta } shape.
      return res.data.data
    },
    enabled: isAuthenticated && !isInitializing,
  })

  // Keep the slide-over in sync when the query refetches after a mutation.
  useEffect(() => {
    if (!selected || !data?.data) return
    const fresh = data.data.find((u: User) => u._id === selected._id)
    if (fresh) setSelected(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const clearOne = useMutation({
    mutationFn: ({ userId, code }: { userId: string; code: string }) =>
      adminUsersApi.clearRiskFlag(userId, code),
    onMutate: (vars) => setClearingCode(vars.code),
    onSuccess: () => {
      toast.success('Flag cleared')
      void qc.invalidateQueries({ queryKey: ['admin-fraud'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not clear flag')),
    onSettled: () => setClearingCode(null),
  })

  const clearAll = useMutation({
    mutationFn: (userId: string) => adminUsersApi.clearAllRiskFlags(userId),
    onSuccess: () => {
      toast.success('All flags cleared')
      setSelected(null)
      void qc.invalidateQueries({ queryKey: ['admin-fraud'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not clear flags')),
  })

  const rows = data?.data ?? []
  const meta = data?.meta

  // Simple per-tab counts — reuse the same query when possible to avoid
  // firing three extra requests. Server truth is meta.total for the active
  // tab; the other tabs show a dash until clicked.
  const totalCount = meta?.total ?? 0

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{u.firstName} {u.lastName}</p>
          <p className="truncate text-xs text-gray-500">{u.email ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (u) => <span className="font-mono text-xs text-gray-700">{u.phone ?? '—'}</span>,
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (u) => {
        const flags = u.riskFlags ?? []
        return (
          <div className="flex flex-wrap gap-1">
            {flags.map((f) => (
              <span
                key={f.code}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${toneClasses(f.code)}`}
              >
                {labelFor(f.code)}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'count',
      header: 'Count',
      render: (u) => <span className="text-sm font-semibold text-gray-900">{u.riskFlags?.length ?? 0}</span>,
    },
    {
      key: 'latest',
      header: 'Most recent',
      render: (u) => <span className="text-xs text-gray-500">{timeAgo(mostRecentFlag(u.riskFlags))}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            u.isActive
              ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
          {u.isActive ? 'Active' : 'Banned'}
        </span>
      ),
    },
  ]

  if (isInitializing || !isAuthenticated) return null

  return (
    <div>
      <PageHeader
        title="Fraud"
        subtitle="Users automatically flagged by risk rules. Review, then clear once resolved or investigate further."
      />

      {/* Stat card — shows the count for the active tab */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard
          title="Flagged users"
          value={String(totalCount)}
          sub={codeFilter === 'all' ? 'across all rules' : labelFor(codeFilter)}
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 md:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700">Active rules</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            <li>· <strong>Payment abuse</strong> — 3+ failed card charges in 24 hours</li>
            <li>· <strong>Refund abuse</strong> — 2+ refund requests in 7 days</li>
          </ul>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterPill active={codeFilter === 'all'}                    onClick={() => { setCodeFilter('all');                    setPage(1) }}>All</FilterPill>
          <FilterPill active={codeFilter === 'payment_failures_24h'}   onClick={() => { setCodeFilter('payment_failures_24h');   setPage(1) }}>Payment abuse</FilterPill>
          <FilterPill active={codeFilter === 'refund_velocity_7d'}     onClick={() => { setCodeFilter('refund_velocity_7d');     setPage(1) }}>Refund abuse</FilterPill>
        </div>
        <div className="relative md:w-72">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email"
            className="w-full rounded-lg border border-gray-200 bg-white px-9 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        emptyMessage={debouncedSearch
          ? `No flagged users match "${debouncedSearch}"`
          : 'No flagged users right now — clean slate.'}
        page={page}
        total={totalCount}
        limit={20}
        onPageChange={setPage}
        onRowClick={(row) => setSelected(row)}
      />

      <FlaggedUserPanel
        user={selected}
        onClose={() => setSelected(null)}
        onClearOne={(code) => selected && clearOne.mutate({ userId: selected._id, code })}
        onClearAll={() => selected && clearAll.mutate(selected._id)}
        clearingCode={clearingCode}
        clearingAll={clearAll.isPending}
      />
    </div>
  )
}
