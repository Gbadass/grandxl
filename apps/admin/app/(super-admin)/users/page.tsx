'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminUsersApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { User } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog'
import '../../../src/lib/axios'

export default function UsersPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [confirm, setConfirm] = useState<{ user: User; action: 'ban' | 'unban' } | null>(null)

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
    queryKey: ['admin', 'users', page, debouncedSearch],
    queryFn: () => adminUsersApi.list({ page, limit: 20, search: debouncedSearch || undefined }),
    enabled: isAuthenticated,
  })

  const users = (data?.data?.data?.data ?? []) as User[]

  const banMutation = useMutation({
    mutationFn: () => {
      if (!confirm) throw new Error()
      return confirm.action === 'ban'
        ? adminUsersApi.ban(confirm.user._id)
        : adminUsersApi.unban(confirm.user._id)
    },
    onSuccess: () => {
      toast.success(confirm?.action === 'ban' ? 'User banned' : 'User unbanned')
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setConfirm(null)
    },
    onError: () => toast.error('Action failed'),
  })

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
            {u.firstName[0]}{u.lastName[0]}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p>
            <p className="text-xs text-gray-400">{u.email ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (u) => <span className="text-sm font-mono text-gray-700">{u.phone ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          u.isActive
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        }`}>
          {u.isActive ? 'Active' : 'Banned'}
        </span>
      ),
    },
    {
      key: 'verified',
      header: 'Verified',
      render: (u) => (
        <span className={`text-xs ${u.isVerified ? 'text-green-600' : 'text-gray-400'}`}>
          {u.isVerified ? '✓ Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (u) => (
        <span className="text-xs text-gray-400">
          {new Date(u.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (u) => (
        u.isActive ? (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirm({ user: u, action: 'ban' }) }}
            className="text-xs font-medium text-red-600 hover:text-red-800"
          >
            Ban
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirm({ user: u, action: 'unban' }) }}
            className="text-xs font-medium text-green-600 hover:text-green-800"
          >
            Unban
          </button>
        )
      ),
    },
  ]

  if (isInitializing) return null

  return (
    <div>
      <PageHeader title="Users" subtitle="Customer accounts" />

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or phone…"
          className="w-full max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
        />
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        total={data?.data?.data?.meta?.total}
        page={page}
        limit={20}
        onPageChange={setPage}
        emptyMessage={debouncedSearch ? 'No users match your search' : 'No customers yet'}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === 'ban' ? `Ban ${confirm?.user.firstName}?` : `Unban ${confirm?.user.firstName}?`}
        description={
          confirm?.action === 'ban'
            ? 'This will prevent the user from logging in. You can reverse this at any time.'
            : 'This will restore the user\'s access to the platform.'
        }
        confirmLabel={confirm?.action === 'ban' ? 'Ban User' : 'Unban User'}
        confirmVariant={confirm?.action === 'ban' ? 'danger' : 'primary'}
        loading={banMutation.isPending}
        onConfirm={() => banMutation.mutate()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
