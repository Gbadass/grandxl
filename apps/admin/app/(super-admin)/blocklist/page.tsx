'use client'

// S13-13: unified blocklist. Shows every account currently blocked from the
// platform — banned customers and suspended/terminated riders — in a single
// triage-friendly page. Unblock/reinstate actions inline.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { adminBlocklistApi, adminUsersApi, adminRidersApi } from '@grandxl/api-client'
import type { User, Rider } from '@grandxl/types'
import { UserRole } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import '../../../src/lib/axios'

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function actorName(bannedBy: User['bannedBy']): string {
  if (!bannedBy) return '—'
  if (typeof bannedBy === 'string') return '—'
  const first = bannedBy.firstName ?? ''
  const last  = bannedBy.lastName ?? ''
  return `${first} ${last}`.trim() || '—'
}

// Rider-side status derivation: terminated wins over suspended.
type RiderBlockKind = 'terminated' | 'suspended'
function riderBlockKind(rider: Rider): RiderBlockKind {
  return rider.terminatedAt ? 'terminated' : 'suspended'
}

// ── Filter pill ──────────────────────────────────────────────────────────────
function FilterPill({
  active, onClick, children, count,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
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
      {count != null && (
        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
        }`}>{count}</span>
      )}
    </button>
  )
}

// ── Detail slide-over ────────────────────────────────────────────────────────
function BlockDetailPanel({
  subject, onClose, onUnblock, unblocking,
}: {
  subject: { kind: 'customer'; user: User } | { kind: 'rider'; rider: Rider } | null
  onClose: () => void
  onUnblock: () => void
  unblocking: boolean
}) {
  if (!subject) return null
  const isCustomer = subject.kind === 'customer'
  const user       = isCustomer ? subject.user : (subject.rider.userId as unknown as User)
  const reason     = isCustomer
    ? subject.user.banReason
    : subject.rider.terminatedAt
      ? subject.rider.terminationReason
      : subject.rider.suspensionReason
  const when = isCustomer
    ? subject.user.bannedAt
    : subject.rider.terminatedAt || subject.rider.updatedAt
  const kindLabel = isCustomer
    ? 'Banned customer'
    : subject.rider.terminatedAt ? 'Terminated rider' : 'Suspended rider'
  const unblockLabel = isCustomer
    ? 'Restore access'
    : subject.rider.terminatedAt ? 'Reactivate rider' : 'Reinstate rider'

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl ring-1 ring-gray-200"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Blocklist entry</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-gray-100 px-6 py-6">
            <div className="mb-3 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                isCustomer
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                  : subject.rider.terminatedAt
                    ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
              }`}>
                {kindLabel}
              </span>
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {user?.firstName} {user?.lastName}
            </h3>
            <p className="mt-0.5 text-sm text-gray-500">{user?.email ?? '—'}</p>
            <p className="mt-0.5 font-mono text-xs text-gray-500">{user?.phone ?? '—'}</p>
          </div>

          <div className="px-6 py-5">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">Reason</h4>
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
              <p className="text-sm text-gray-800">{reason || <em className="text-gray-500">No reason recorded</em>}</p>
              <p className="mt-2 text-[11px] text-gray-500">
                Blocked {timeAgo(when)}
                {isCustomer && subject.user.bannedBy && (
                  <> · by {actorName(subject.user.bannedBy)}</>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
          <motion.button
            type="button"
            onClick={onUnblock}
            disabled={unblocking}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {unblocking ? 'Restoring…' : unblockLabel}
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
type Tab = 'all' | 'customers' | 'riders'

export default function BlocklistPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [customersPage, setCustomersPage] = useState(1)
  const [ridersPage, setRidersPage]       = useState(1)
  const [selected, setSelected] = useState<
    | { kind: 'customer'; user: User }
    | { kind: 'rider'; rider: Rider }
    | null
  >(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, isInitializing, user, router])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setCustomersPage(1)
      setRidersPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const customersQuery = useQuery({
    queryKey: ['admin-blocklist', 'customers', customersPage, debouncedSearch],
    queryFn: async () => {
      const res = await adminBlocklistApi.listCustomers({
        page:   customersPage,
        limit:  20,
        search: debouncedSearch || undefined,
      })
      return res.data.data
    },
    enabled: isAuthenticated && !isInitializing && (tab === 'all' || tab === 'customers'),
  })

  const ridersQuery = useQuery({
    queryKey: ['admin-blocklist', 'riders', ridersPage, debouncedSearch],
    queryFn: async () => {
      const res = await adminBlocklistApi.listRiders({
        page:   ridersPage,
        limit:  20,
        search: debouncedSearch || undefined,
      })
      return res.data.data
    },
    enabled: isAuthenticated && !isInitializing && (tab === 'all' || tab === 'riders'),
  })

  const customers = customersQuery.data?.data ?? []
  const riders    = ridersQuery.data?.data ?? []
  const customersTotal = customersQuery.data?.meta?.total ?? 0
  const ridersTotal    = ridersQuery.data?.meta?.total ?? 0

  const terminatedCount = useMemo(
    () => riders.filter((r) => r.terminatedAt).length,
    [riders],
  )
  const suspendedCount = ridersTotal - terminatedCount

  // Sync selected panel after a mutation refetches the list
  useEffect(() => {
    if (!selected) return
    if (selected.kind === 'customer') {
      const fresh = customers.find((u) => u._id === selected.user._id)
      if (!fresh) setSelected(null)  // was unblocked from elsewhere
    } else {
      const fresh = riders.find((r) => r._id === selected.rider._id)
      if (!fresh) setSelected(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, riders])

  // Mutations
  const unbanCustomer = useMutation({
    mutationFn: (id: string) => adminUsersApi.unban(id),
    onSuccess: () => {
      toast.success('Access restored')
      void qc.invalidateQueries({ queryKey: ['admin-blocklist'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setSelected(null)
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not restore access')),
  })

  const reinstateRider = useMutation({
    mutationFn: (id: string) => adminRidersApi.reinstate(id),
    onSuccess: () => {
      toast.success('Rider reinstated')
      void qc.invalidateQueries({ queryKey: ['admin-blocklist'] })
      setSelected(null)
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not reinstate rider')),
  })

  function handleUnblock() {
    if (!selected) return
    if (selected.kind === 'customer') {
      unbanCustomer.mutate(selected.user._id)
    } else if (selected.rider.terminatedAt) {
      // Terminated riders don't have a straightforward "reactivate"; surface
      // that via toast rather than pretend.
      toast.error('Terminated riders can\'t be reactivated from here — contact platform support.')
    } else {
      reinstateRider.mutate(selected.rider._id)
    }
  }

  const unblocking = unbanCustomer.isPending || reinstateRider.isPending

  // ── Columns for customers ─────────────────────────────────────────────────
  const customerCols: Column<User>[] = [
    {
      key: 'user',
      header: 'Customer',
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
      key: 'reason',
      header: 'Reason',
      render: (u) => (
        <span className="line-clamp-2 max-w-xs text-xs text-gray-700">
          {u.banReason || <em className="text-gray-400">No reason recorded</em>}
        </span>
      ),
    },
    {
      key: 'when',
      header: 'Blocked',
      render: (u) => <span className="text-xs text-gray-500">{timeAgo(u.bannedAt)}</span>,
    },
    {
      key: 'by',
      header: 'By',
      render: (u) => <span className="text-xs text-gray-700">{actorName(u.bannedBy)}</span>,
    },
  ]

  // ── Columns for riders ────────────────────────────────────────────────────
  const riderCols: Column<Rider>[] = [
    {
      key: 'rider',
      header: 'Rider',
      render: (r) => {
        const u = r.userId as unknown as User | undefined
        return (
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">
              {u?.firstName} {u?.lastName}
            </p>
            <p className="truncate text-xs text-gray-500">{u?.email ?? '—'}</p>
          </div>
        )
      },
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (r) => {
        const u = r.userId as unknown as User | undefined
        return <span className="font-mono text-xs text-gray-700">{u?.phone ?? '—'}</span>
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const kind = riderBlockKind(r)
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
            kind === 'terminated'
              ? 'bg-red-50 text-red-700 ring-red-200'
              : 'bg-amber-50 text-amber-700 ring-amber-200'
          }`}>
            {kind === 'terminated' ? 'Terminated' : 'Suspended'}
          </span>
        )
      },
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => (
        <span className="line-clamp-2 max-w-xs text-xs text-gray-700">
          {(r.terminatedAt ? r.terminationReason : r.suspensionReason) || <em className="text-gray-400">No reason recorded</em>}
        </span>
      ),
    },
    {
      key: 'when',
      header: 'Blocked',
      render: (r) => (
        <span className="text-xs text-gray-500">{timeAgo(r.terminatedAt ?? r.updatedAt)}</span>
      ),
    },
  ]

  if (isInitializing || !isAuthenticated) return null

  const totalBlocked = customersTotal + ridersTotal
  const showCustomers = tab === 'all' || tab === 'customers'
  const showRiders    = tab === 'all' || tab === 'riders'

  return (
    <div>
      <PageHeader
        title="Blocklist"
        subtitle="Every account currently excluded from the platform. Review reasons, unblock or reinstate here."
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatsCard title="Total blocked"        value={String(totalBlocked)}     sub="accounts on the list" />
        <StatsCard title="Banned customers"     value={String(customersTotal)}   sub="prevented from ordering" />
        <StatsCard title="Suspended riders"     value={String(suspendedCount)}   sub="temporarily off-platform" />
        <StatsCard title="Terminated riders"    value={String(terminatedCount)}  sub="permanent removal" />
      </div>

      {/* Filter + search */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterPill active={tab === 'all'}       onClick={() => setTab('all')}       count={totalBlocked}>All</FilterPill>
          <FilterPill active={tab === 'customers'} onClick={() => setTab('customers')} count={customersTotal}>Customers</FilterPill>
          <FilterPill active={tab === 'riders'}    onClick={() => setTab('riders')}    count={ridersTotal}>Riders</FilterPill>
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

      {/* Tables */}
      <div className="space-y-6">
        {showCustomers && (
          <div>
            {tab === 'all' && (
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Banned customers ({customersTotal})
              </h3>
            )}
            <DataTable
              columns={customerCols}
              data={customers}
              loading={customersQuery.isLoading}
              emptyMessage={debouncedSearch
                ? `No banned customers match "${debouncedSearch}"`
                : 'No banned customers — clean slate.'}
              page={customersPage}
              total={customersTotal}
              limit={20}
              onPageChange={setCustomersPage}
              onRowClick={(u) => setSelected({ kind: 'customer', user: u })}
            />
          </div>
        )}

        {showRiders && (
          <div>
            {tab === 'all' && (
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Blocked riders ({ridersTotal})
              </h3>
            )}
            <DataTable
              columns={riderCols}
              data={riders}
              loading={ridersQuery.isLoading}
              emptyMessage={debouncedSearch
                ? `No blocked riders match "${debouncedSearch}"`
                : 'No blocked riders — everyone\'s active.'}
              page={ridersPage}
              total={ridersTotal}
              limit={20}
              onPageChange={setRidersPage}
              onRowClick={(r) => setSelected({ kind: 'rider', rider: r })}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <BlockDetailPanel
            subject={selected}
            onClose={() => setSelected(null)}
            onUnblock={handleUnblock}
            unblocking={unblocking}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
