'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminUsersApi, adminSupportApi, type AdminCreateUserDto } from '@grandxl/api-client'
import { formatMoney, parseApiError } from '@grandxl/utils'
import { UserRole } from '@grandxl/types'
import type { User } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog'
import '../../../src/lib/axios'

// ── Role config ─────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; text: string; ring: string }> = {
  [UserRole.CUSTOMER]: {
    label: 'Customer',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
  },
  [UserRole.RESTAURANT_OWNER]: {
    label: 'Restaurant Owner',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    ring: 'ring-violet-200',
  },
  [UserRole.RIDER]: {
    label: 'Rider',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
  },
  [UserRole.SUPER_ADMIN]: {
    label: 'Admin',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
  },
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function timeAgo(date: Date | string | null): string {
  if (!date) return 'Never'
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── User detail slide-over ───────────────────────────────────────────────────

function UserDetailPanel({
  user,
  onClose,
  onBan,
  onUnban,
  onDelete,
  onCredit,
}: {
  user: User | null
  onClose: () => void
  onBan: (u: User) => void
  onUnban: (u: User) => void
  onCredit: (u: User) => void
  onDelete: (u: User) => void
}) {
  if (!user) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl ring-1 ring-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">User Details</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 border-b border-gray-100 px-6 py-8">
            <div className={`flex h-20 w-20 items-center justify-center rounded-full ${avatarColor(user._id)} text-2xl font-bold text-white shadow-lg`}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">{user.firstName} {user.lastName}</h3>
              <p className="mt-0.5 text-sm text-gray-500">{user.email ?? '—'}</p>
            </div>
            {/* Role badges */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {user.roles.map((role) => {
                const cfg = ROLE_CONFIG[role]
                return (
                  <span key={role} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                    {cfg.label}
                  </span>
                )
              })}
            </div>
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                user.isActive ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                {user.isActive ? 'Active' : 'Banned'}
              </span>
              {user.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
            </div>
          </div>

          {/* Info fields */}
          <div className="px-6 py-5">
            <dl className="divide-y divide-gray-100">
              <InfoRow label="Phone" value={user.phone ?? '—'} mono />
              <InfoRow label="Country" value={user.country} />
              <InfoRow label="Currency" value={user.currency} />
              <InfoRow label="Locale" value={user.locale} />
              <InfoRow label="Last Login" value={timeAgo(user.lastLoginAt)} />
              <InfoRow
                label="Joined"
                value={new Date(user.createdAt).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              />
              <InfoRow label="Push Notifications" value={user.expoPushToken ? 'Enabled' : 'Disabled'} />
              <InfoRow label="Consent" value={user.consentGiven ? `Given ${user.consentDate ? timeAgo(user.consentDate) : ''}` : 'Not given'} />
            </dl>
          </div>

          {/* Risk flags — surfaced here (in addition to /fraud) so admins reviewing
              a user for any reason see the fraud signal immediately. Only rendered
              when there's something to show. */}
          {(user.riskFlags?.length ?? 0) > 0 && (
            <div className="border-t border-gray-100 px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                  Risk flags ({user.riskFlags!.length})
                </h4>
                <a
                  href="/fraud"
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-900"
                >
                  Open in fraud →
                </a>
              </div>
              <div className="space-y-2">
                {user.riskFlags!.map((flag) => (
                  <div
                    key={flag.code}
                    className="rounded-xl border border-amber-100 bg-amber-50/50 p-3"
                  >
                    <p className="text-xs font-semibold text-amber-800">{flag.reason}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-amber-600">{flag.code}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Addresses */}
          {user.addresses.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Saved Addresses ({user.addresses.length})
              </h4>
              <div className="space-y-2">
                {user.addresses.map((addr) => (
                  <div
                    key={addr._id}
                    className={`rounded-xl border p-3 text-sm ${
                      user.defaultAddressId === addr._id
                        ? 'border-orange-200 bg-orange-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800">{addr.label}</span>
                      {user.defaultAddressId === addr._id && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-600">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {addr.street}, {addr.city}, {addr.state}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 space-y-2">
          {user.isActive ? (
            <button
              onClick={() => onBan(user)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Ban User
            </button>
          ) : (
            <button
              onClick={() => onUnban(user)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Restore Access
            </button>
          )}
          {/* Sprint 13 (S13-5): emergency service credit — goodwill wallet grant */}
          <button
            onClick={() => onCredit(user)}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
            </svg>
            Emergency wallet credit
          </button>
          <button
            onClick={() => onDelete(user)}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete Account
          </button>
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className={`text-xs text-right text-gray-900 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</dd>
    </div>
  )
}

// ── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
      {cfg.label}
    </span>
  )
}

// ── Filter pill button ───────────────────────────────────────────────────────

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

// ── Main page ────────────────────────────────────────────────────────────────

type RoleFilter = 'all' | UserRole
type StatusFilter = 'all' | 'active' | 'banned'

export default function UsersPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [confirm, setConfirm] = useState<{ user: User; action: 'ban' | 'unban' | 'delete' } | null>(null)
  // Sprint 13 (S13-5): emergency credit modal state
  const [creditFor, setCreditFor] = useState<User | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<AdminCreateUserDto>({
    firstName: '', lastName: '', phone: '', email: '', password: '', roles: [UserRole.CUSTOMER], country: 'NG',
  })
  const [createError, setCreateError] = useState('')

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

  // Stats query — high limit, page 1, to get meta.total and compute breakdowns
  const { data: statsData } = useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: () => adminUsersApi.list({ page: 1, limit: 200 }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  // Main paginated query
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, debouncedSearch],
    queryFn: () => adminUsersApi.list({ page, limit: 20, search: debouncedSearch || undefined }),
    enabled: isAuthenticated,
  })

  const allUsers: User[] = (statsData?.data?.data?.data ?? []) as User[]
  const totalUsers = statsData?.data?.data?.meta?.total ?? 0
  const activeCount = allUsers.filter((u) => u.isActive).length
  const bannedCount = allUsers.filter((u) => !u.isActive).length
  const verifiedCount = allUsers.filter((u) => u.isVerified).length

  const rawUsers: User[] = (data?.data?.data?.data ?? []) as User[]

  // Client-side filter on current page results
  const users = useMemo(() => {
    return rawUsers.filter((u) => {
      if (roleFilter !== 'all' && !u.roles.includes(roleFilter as UserRole)) return false
      if (statusFilter === 'active' && !u.isActive) return false
      if (statusFilter === 'banned' && u.isActive) return false
      return true
    })
  }, [rawUsers, roleFilter, statusFilter])

  const total = data?.data?.data?.meta?.total ?? 0

  const actionMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'ban' | 'unban' | 'delete' }): Promise<unknown> => {
      if (action === 'ban') return adminUsersApi.ban(userId)
      if (action === 'unban') return adminUsersApi.unban(userId)
      return adminUsersApi.delete(userId)
    },
    onSuccess: (_data, variables) => {
      const msg =
        variables.action === 'ban' ? 'User banned' :
        variables.action === 'unban' ? 'User access restored' :
        'User deleted'
      toast.success(msg)
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setConfirm(null)
      setSelectedUser(null)
    },
    onError: (err: unknown) => toast.error(parseApiError(err, 'Action failed. Please try again.')),
  })

  const createMutation = useMutation({
    mutationFn: (dto: AdminCreateUserDto) => adminUsersApi.create(dto),
    onSuccess: () => {
      toast.success('User created successfully')
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setShowCreate(false)
      setCreateForm({ firstName: '', lastName: '', phone: '', email: '', password: '', roles: [UserRole.CUSTOMER], country: 'NG' })
      setCreateError('')
    },
    onError: (err: unknown) => setCreateError(parseApiError(err, 'Failed to create user.')),
  })

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    if (!createForm.firstName.trim() || !createForm.lastName.trim()) {
      setCreateError('First and last name are required.')
      return
    }
    if (!createForm.phone?.trim() && !createForm.email?.trim()) {
      setCreateError('Phone or email is required.')
      return
    }
    if (!createForm.password || createForm.password.length < 8) {
      setCreateError('Password must be at least 8 characters.')
      return
    }
    if (!createForm.roles.length) {
      setCreateError('Select at least one role.')
      return
    }
    createMutation.mutate({
      ...createForm,
      phone: createForm.phone?.trim() || undefined,
      email: createForm.email?.trim() || undefined,
    })
  }

  function toggleRole(role: UserRole) {
    setCreateForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }))
  }

  function handleBan(u: User) {
    setSelectedUser(null)
    setConfirm({ user: u, action: 'ban' })
  }

  function handleUnban(u: User) {
    setSelectedUser(null)
    setConfirm({ user: u, action: 'unban' })
  }

  function handleDelete(u: User) {
    setSelectedUser(null)
    setConfirm({ user: u, action: 'delete' })
  }

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Manage all customer, rider, and restaurant accounts"
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {totalUsers > 0 ? `${totalUsers.toLocaleString()} total` : ''}
            </span>
            <button
              onClick={() => { setShowCreate(true); setCreateError('') }}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create User
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Total Users" value={totalUsers} icon="users" />
        <StatsCard title="Active" value={activeCount} icon="active" sub="of first 200" />
        <StatsCard title="Banned" value={bannedCount} icon="pending" sub="of first 200" />
        <StatsCard title="Verified" value={verifiedCount} icon="analytics" sub="of first 200" />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm ring-1 ring-gray-950/[0.03]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
              </svg>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or phone…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-3 flex cursor-pointer items-center text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="hidden h-6 w-px bg-gray-200 sm:block" />

          {/* Role filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill active={roleFilter === 'all'} onClick={() => setRoleFilter('all')}>All roles</FilterPill>
            <FilterPill active={roleFilter === UserRole.CUSTOMER} onClick={() => setRoleFilter(UserRole.CUSTOMER)}>Customers</FilterPill>
            <FilterPill active={roleFilter === UserRole.RESTAURANT_OWNER} onClick={() => setRoleFilter(UserRole.RESTAURANT_OWNER)}>Restaurant Owners</FilterPill>
            <FilterPill active={roleFilter === UserRole.RIDER} onClick={() => setRoleFilter(UserRole.RIDER)}>Riders</FilterPill>
            <FilterPill active={roleFilter === UserRole.SUPER_ADMIN} onClick={() => setRoleFilter(UserRole.SUPER_ADMIN)}>Admins</FilterPill>
          </div>

          {/* Divider */}
          <div className="hidden h-6 w-px bg-gray-200 sm:block" />

          {/* Status filters */}
          <div className="flex items-center gap-1.5">
            <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterPill>
            <FilterPill active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>Active</FilterPill>
            <FilterPill active={statusFilter === 'banned'} onClick={() => setStatusFilter('banned')}>Banned</FilterPill>
          </div>
        </div>
      </div>

      {/* Table */}
      <UsersTable
        users={users}
        loading={isLoading}
        total={total}
        page={page}
        search={debouncedSearch}
        onPageChange={(p) => setPage(p)}
        onRowClick={setSelectedUser}
        onBan={handleBan}
        onUnban={handleUnban}
      />

      {/* Slide-over */}
      <UserDetailPanel
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onBan={handleBan}
        onUnban={handleUnban}
        onDelete={handleDelete}
        onCredit={(u) => setCreditFor(u)}
      />

      {/* Sprint 13 (S13-5): emergency credit modal */}
      {creditFor && (
        <EmergencyCreditModal
          user={creditFor}
          onClose={() => setCreditFor(null)}
          onDone={() => {
            setCreditFor(null)
            void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
          }}
        />
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.action === 'ban' ? `Ban ${confirm?.user.firstName} ${confirm?.user.lastName}?` :
          confirm?.action === 'unban' ? `Restore ${confirm?.user.firstName} ${confirm?.user.lastName}?` :
          `Delete ${confirm?.user.firstName} ${confirm?.user.lastName}?`
        }
        description={
          confirm?.action === 'ban'
            ? `${confirm?.user.firstName} will be immediately logged out and unable to access GrandXL. You can reverse this at any time.`
            : confirm?.action === 'unban'
            ? `This will restore ${confirm?.user.firstName}'s full access to the platform.`
            : `This will permanently anonymise ${confirm?.user.firstName}'s personal data (name, email, phone, addresses) in compliance with NDPR. Order history is preserved. This cannot be undone.`
        }
        confirmLabel={
          confirm?.action === 'ban' ? 'Ban User' :
          confirm?.action === 'unban' ? 'Restore Access' :
          'Delete Account'
        }
        confirmVariant="danger"
        loading={actionMutation.isPending}
        onConfirm={() => confirm && actionMutation.mutate({ userId: confirm.user._id, action: confirm.action })}
        onCancel={() => setConfirm(null)}
      />

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Create User</h2>
              <button
                onClick={() => { setShowCreate(false); setCreateError('') }}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First name *</label>
                  <input
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="John"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last name *</label>
                  <input
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Doe"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={createForm.phone ?? ''}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+2348012345678"
                  type="tel"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  value={createForm.email ?? ''}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="john@example.com"
                  type="email"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
                <input
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  type="password"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Roles *</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.values(UserRole) as UserRole[]).map((role) => {
                    const cfg = ROLE_CONFIG[role]
                    const active = createForm.roles.includes(role)
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-all ${
                          active ? `${cfg.bg} ${cfg.text} ${cfg.ring}` : 'bg-gray-50 text-gray-400 ring-gray-200 hover:ring-gray-300'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {createError && (
                <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">{createError}</p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError('') }}
                  className="flex-1 cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 cursor-pointer rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Users table ──────────────────────────────────────────────────────────────

function UsersTable({
  users,
  loading,
  total,
  page,
  search,
  onPageChange,
  onRowClick,
  onBan,
  onUnban,
}: {
  users: User[]
  loading: boolean
  total: number
  page: number
  search: string
  onPageChange: (p: number) => void
  onRowClick: (u: User) => void
  onBan: (u: User) => void
  onUnban: (u: User) => void
}) {
  const limit = 20
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-gray-950/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-[260px]">User</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">Phone</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">Roles</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">Status</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">Last Login</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">Joined</th>
              <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-widest text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  {[260, 120, 160, 80, 90, 100, 80].map((w, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-3.5 animate-pulse rounded-md bg-gray-100" style={{ width: w / 3 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.3} stroke="currentColor" className="h-7 w-7 text-gray-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-500">
                      {search ? 'No users match your search' : 'No users yet'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {search ? 'Try a different name, email or phone number' : 'Users will appear here once they register'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((u, i) => (
                <tr
                  key={u._id}
                  onClick={() => onRowClick(u)}
                  className={`cursor-pointer border-t border-gray-50 transition-colors duration-100 hover:bg-orange-50/30 ${
                    i % 2 !== 0 ? 'bg-gray-50/40' : 'bg-white'
                  }`}
                >
                  {/* Name */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(u._id)}`}>
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {u.firstName} {u.lastName}
                          </p>
                          {u.isVerified && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0 text-sky-500">
                              <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <p className="truncate text-xs text-gray-400">{u.email ?? '—'}</p>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-gray-700">{u.phone ?? '—'}</span>
                  </td>

                  {/* Roles */}
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((role) => <RoleBadge key={role} role={role} />)}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      u.isActive
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      {u.isActive ? 'Active' : 'Banned'}
                    </span>
                  </td>

                  {/* Last Login */}
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-gray-400">{timeAgo(u.lastLoginAt)}</span>
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right">
                    {u.isActive ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onBan(u) }}
                        className="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all hover:border-red-300 hover:bg-red-100 hover:text-red-800"
                      >
                        Ban
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); onUnban(u) }}
                        className="cursor-pointer rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-600 transition-all hover:border-green-300 hover:bg-green-100 hover:text-green-800"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 bg-white px-5 py-3.5">
          <p className="text-xs text-gray-400">
            Showing{' '}
            <span className="font-semibold text-gray-600">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-gray-600">{total.toLocaleString()}</span>{' '}
            users
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="cursor-pointer rounded-lg border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="min-w-[52px] text-center text-xs font-medium text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="cursor-pointer rounded-lg border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sprint 13 (S13-5): Emergency wallet credit modal ─────────────────────────

function EmergencyCreditModal({ user, onClose, onDone }: {
  user:    User
  onClose: () => void
  onDone:  () => void
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const parsedKobo = Math.round((parseFloat(amount) || 0) * 100)
  const valid = parsedKobo >= 100 && reason.trim().length >= 3 // ₦1 min

  const mutation = useMutation({
    mutationFn: () => adminSupportApi.emergencyCredit({
      userId:     user._id,
      amountKobo: parsedKobo,
      reason:     reason.trim(),
    }),
    onSuccess: (res) => {
      toast.success(`Credited ${formatMoney(res.data.data.creditedKobo, 'NGN')} to ${user.firstName || 'user'}'s wallet`)
      onDone()
    },
    onError: (e: unknown) => toast.error(parseApiError(e, 'Emergency credit failed')),
  })

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-extrabold text-gray-900">Emergency wallet credit</h2>
          <p className="mt-1 text-xs text-gray-500">
            Goodwill credit to <span className="font-semibold text-gray-800">{user.firstName} {user.lastName}</span>. Not tied to any specific order. Audit-logged.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Amount (NGN)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-lg font-bold tabular-nums outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Reason (min 3 chars)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Escalation ticket #789 — 3 bad orders in a row, agreed ₦1k credit"
              maxLength={300}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {mutation.isPending ? 'Crediting…' : 'Confirm credit'}
          </button>
        </div>
      </div>
    </div>
  )
}
