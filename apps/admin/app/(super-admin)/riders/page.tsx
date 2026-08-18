'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { adminRidersApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { Rider, RiderUser } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatusBadge } from '../../../src/components/ui/StatusBadge'
import { OnboardRiderSlideOver } from '../../../src/components/riders/OnboardRiderSlideOver'
import '../../../src/lib/axios'

function riderUser(r: Rider): RiderUser | null {
  return r.userId && typeof r.userId === 'object' ? (r.userId as RiderUser) : null
}

type FilterTab = 'all' | 'verified' | 'unverified' | 'online' | 'offline'

const TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Verified', value: 'verified' },
  { label: 'Unverified', value: 'unverified' },
  { label: 'Online', value: 'online' },
  { label: 'Offline', value: 'offline' },
]

function VehicleIcon({ type }: { type: string }) {
  if (type === 'bicycle') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M15 6a1 1 0 100-2 1 1 0 000 2zm-3 11.5L5.5 17.5l3.75-6.75L12 13l3-5.5h3" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M5 17H3a2 2 0 01-2-2v-4a7 7 0 017-7h6l3 4h2a2 2 0 012 2v2a2 2 0 01-2 2h-1" />
      <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="17.5" r="2.5" />
      <path d="M13 10h-3V6" />
    </svg>
  )
}

export default function RidersPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')
  const [onboardOpen, setOnboardOpen] = useState(false)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'riders'],
    queryFn: () => adminRidersApi.list({ page: 1, limit: 200 }),
    enabled: isAuthenticated,
  })

  const allRiders = (data?.data?.data?.data ?? []) as Rider[]

  const stats = useMemo(() => ({
    total:       allRiders.length,
    online:      allRiders.filter((r) => r.isOnline).length,
    verified:    allRiders.filter((r) => r.isVerified && !r.terminatedAt && !r.isSuspended).length,
    unverified:  allRiders.filter((r) => !r.isVerified && !r.terminatedAt && !r.isSuspended).length,
  }), [allRiders])

  const filtered = useMemo(() => {
    let list = allRiders
    if (tab === 'verified')   list = list.filter((r) => r.isVerified)
    if (tab === 'unverified') list = list.filter((r) => !r.isVerified)
    if (tab === 'online')     list = list.filter((r) => r.isOnline)
    if (tab === 'offline')    list = list.filter((r) => !r.isOnline)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) => {
        const u = riderUser(r)
        return (
          u?.firstName?.toLowerCase().includes(q) ||
          u?.lastName?.toLowerCase().includes(q) ||
          u?.phone?.includes(q) ||
          r.vehiclePlate?.toLowerCase().includes(q)
        )
      })
    }
    return list
  }, [allRiders, tab, search])

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      <OnboardRiderSlideOver open={onboardOpen} onClose={() => setOnboardOpen(false)} />

      <PageHeader
        title="Riders"
        subtitle="Manage rider applications and accounts"
        action={
          <button
            onClick={() => setOnboardOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Onboard Rider
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Riders"
          value={isLoading ? '—' : stats.total}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
            </svg>
          }
          color="blue"
        />
        <StatCard
          label="Online Now"
          value={isLoading ? '—' : stats.online}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
          }
          color="green"
        />
        <StatCard
          label="Verified"
          value={isLoading ? '—' : stats.verified}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
          }
          color="orange"
        />
        <StatCard
          label="Awaiting KYC"
          value={isLoading ? '—' : stats.unverified}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
          }
          color="yellow"
        />
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative max-w-xs flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or plate…"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <p className="text-sm text-gray-400">
            {isLoading ? 'Loading…' : `${filtered.length} rider${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 pt-3 pb-0">
          {TABS.map((t) => {
            const count =
              t.value === 'all'        ? stats.total :
              t.value === 'verified'   ? stats.verified :
              t.value === 'unverified' ? stats.unverified :
              t.value === 'online'     ? stats.online :
              allRiders.length - stats.online
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-medium transition-colors ${
                  tab === t.value
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                {!isLoading && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    tab === t.value ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-0 divide-y divide-gray-100 p-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
                  </div>
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <p className="text-sm font-medium text-gray-500">No riders found</p>
              {search && <p className="mt-1 text-xs text-gray-400">Try a different name, phone or plate number</p>}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-gray-100 bg-gray-50/60 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3 text-left">Rider</th>
                  <th className="px-4 py-3 text-left">Vehicle</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Online</th>
                  <th className="px-4 py-3 text-right">Deliveries</th>
                  <th className="px-4 py-3 text-right">Earnings</th>
                  <th className="px-4 py-3 text-right">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const u = riderUser(r)
                  const name     = u ? `${u.firstName} ${u.lastName}` : 'Unknown'
                  const initials = u ? `${u.firstName[0]}${u.lastName[0]}`.toUpperCase() : '?'
                  const earningsNaira = ((r.earnings?.totalKobo ?? 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

                  return (
                    <tr
                      key={r._id}
                      onClick={() => router.push(`/riders/${r._id}`)}
                      className="cursor-pointer transition-colors hover:bg-orange-50/40"
                    >
                      {/* Rider */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {u?.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar} alt={name} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-600">
                              {initials}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{name}</p>
                            <p className="text-xs text-gray-400">{u?.phone ?? '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">
                            <VehicleIcon type={r.vehicleType} />
                          </span>
                          <div>
                            <p className="font-medium capitalize text-gray-900">{r.vehicleType}</p>
                            <p className="text-xs text-gray-400">{r.vehiclePlate ?? '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {r.terminatedAt ? (
                          <StatusBadge label="Terminated" variant="red" />
                        ) : r.isSuspended ? (
                          <StatusBadge label="Suspended" variant="red" />
                        ) : r.isVerified ? (
                          <StatusBadge label="Verified" variant="green" />
                        ) : (
                          <StatusBadge label="Unverified" variant="yellow" />
                        )}
                      </td>

                      {/* Online */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${r.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={`text-xs font-medium ${r.isOnline ? 'text-green-700' : 'text-gray-400'}`}>
                            {r.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </td>

                      {/* Deliveries */}
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-semibold tabular-nums ${r.totalDeliveries > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                          {r.totalDeliveries}
                        </span>
                      </td>

                      {/* Earnings */}
                      <td className="px-4 py-3.5 text-right">
                        <span className={`tabular-nums ${(r.earnings?.totalKobo ?? 0) > 0 ? 'font-medium text-gray-900' : 'text-gray-300'}`}>
                          {(r.earnings?.totalKobo ?? 0) > 0 ? `₦${earningsNaira}` : '—'}
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-3.5 text-right">
                        {r.ratingCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-amber-400">
                              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium text-gray-900">{r.rating.toFixed(1)}</span>
                            <span className="text-xs text-gray-400">({r.ratingCount})</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">No ratings</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon, color,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'orange' | 'yellow'
}) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   value: 'text-blue-700' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  value: 'text-green-700' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', value: 'text-orange-700' },
    yellow: { bg: 'bg-amber-50',  icon: 'text-amber-600',  value: 'text-amber-700' },
  }
  const c = colors[color]
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.icon}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className={`text-xl font-bold tabular-nums ${c.value}`}>{value}</p>
      </div>
    </div>
  )
}
