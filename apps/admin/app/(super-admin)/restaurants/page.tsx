'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { adminRestaurantsApi } from '@grandxl/api-client'
import { RestaurantApprovalStatus, UserRole } from '@grandxl/types'
import type { Restaurant } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import { StatusBadge } from '../../../src/components/ui/StatusBadge'
import { OnboardSlideOver } from '../../../src/components/restaurants/OnboardSlideOver'
import '../../../src/lib/axios'

const STATUS_TABS: { label: string; value: RestaurantApprovalStatus | undefined; color: string }[] = [
  { label: 'All', value: undefined, color: 'text-gray-600 border-gray-600' },
  { label: 'Pending', value: RestaurantApprovalStatus.PENDING_REVIEW, color: 'text-amber-600 border-amber-600' },
  { label: 'Approved', value: RestaurantApprovalStatus.APPROVED, color: 'text-green-600 border-green-600' },
  { label: 'Rejected', value: RestaurantApprovalStatus.REJECTED, color: 'text-red-600 border-red-600' },
  { label: 'Suspended', value: RestaurantApprovalStatus.SUSPENDED, color: 'text-gray-500 border-gray-500' },
]

export default function RestaurantsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [status, setStatus] = useState<RestaurantApprovalStatus | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showOnboard, setShowOnboard] = useState(false)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'restaurants', status, page],
    queryFn: () => adminRestaurantsApi.list({ status, page, limit: 20 }),
    enabled: isAuthenticated,
  })

  // Counts per status for badges
  const { data: allData } = useQuery({
    queryKey: ['admin', 'restaurants', 'all-counts'],
    queryFn: () => adminRestaurantsApi.list({ limit: 1000 }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const allRestaurants: Restaurant[] = (allData?.data?.data?.data ?? []) as Restaurant[]
  const counts = {
    all: allRestaurants.length,
    pending: allRestaurants.filter(r => r.approvalStatus === RestaurantApprovalStatus.PENDING_REVIEW).length,
    approved: allRestaurants.filter(r => r.approvalStatus === RestaurantApprovalStatus.APPROVED).length,
    rejected: allRestaurants.filter(r => r.approvalStatus === RestaurantApprovalStatus.REJECTED).length,
    suspended: allRestaurants.filter(r => r.approvalStatus === RestaurantApprovalStatus.SUSPENDED).length,
  }

  const tabCounts = [counts.all, counts.pending, counts.approved, counts.rejected, counts.suspended]

  const restaurants: Restaurant[] = (data?.data?.data?.data ?? []) as Restaurant[]
  const meta = data?.data?.data?.meta
  const total = meta?.total ?? 0
  const totalPages = meta?.totalPages ?? 1

  const filtered = search.trim()
    ? restaurants.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.address.city.toLowerCase().includes(search.toLowerCase()) ||
        r.cuisine?.some(c => c.toLowerCase().includes(search.toLowerCase()))
      )
    : restaurants

  if (isInitializing) return null

  return (
    <>
      <OnboardSlideOver open={showOnboard} onClose={() => setShowOnboard(false)} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Restaurants</h1>
            <p className="mt-1 text-sm text-gray-500">Manage applications, approve partners, and onboard new restaurants</p>
          </div>
          <button
            onClick={() => setShowOnboard(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Onboard Restaurant
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="Total" value={counts.all} color="blue" />
          <StatPill label="Pending Review" value={counts.pending} color="amber" urgent={counts.pending > 0} />
          <StatPill label="Approved" value={counts.approved} color="green" />
          <StatPill label="Suspended" value={counts.suspended} color="red" />
        </div>

        {/* Search + Tabs */}
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          {/* Search bar */}
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search restaurants, cities, cuisines…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <span className="text-sm text-gray-400">{total} total</span>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-0 border-b border-gray-100 px-4">
            {STATUS_TABS.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => { setStatus(tab.value); setPage(1) }}
                className={`relative flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  status === tab.value
                    ? `${tab.color} border-current`
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tabCounts[i] > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    status === tab.value
                      ? i === 1 ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tabCounts[i]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="py-3 pl-5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Restaurant</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Cuisine</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Rating</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Location</th>
                  <th className="py-3 pl-3 pr-5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-4 pl-5 pr-3"><div className="flex items-center gap-3"><div className="h-9 w-9 animate-pulse rounded-xl bg-gray-200" /><div className="space-y-1.5"><div className="h-3.5 w-32 animate-pulse rounded bg-gray-200" /><div className="h-3 w-20 animate-pulse rounded bg-gray-100" /></div></div></td>
                      <td className="px-3 py-4"><div className="h-3 w-24 animate-pulse rounded bg-gray-200" /></td>
                      <td className="px-3 py-4"><div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" /></td>
                      <td className="px-3 py-4"><div className="h-3 w-16 animate-pulse rounded bg-gray-200" /></td>
                      <td className="px-3 py-4"><div className="h-3 w-20 animate-pulse rounded bg-gray-200" /></td>
                      <td className="py-4 pl-3 pr-5"><div className="h-3 w-20 animate-pulse rounded bg-gray-200" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="h-10 w-10 text-gray-200">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                        </svg>
                        <p className="text-sm font-medium text-gray-400">
                          {search ? `No restaurants match "${search}"` : 'No restaurants found'}
                        </p>
                        {!search && (
                          <button
                            onClick={() => setShowOnboard(true)}
                            className="mt-1 cursor-pointer text-sm font-medium text-orange-600 hover:text-orange-700"
                          >
                            Onboard the first one →
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r._id}
                      onClick={() => router.push(`/restaurants/${r._id}`)}
                      className="cursor-pointer transition-colors hover:bg-orange-50/50"
                    >
                      {/* Restaurant */}
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 text-sm font-bold text-orange-600">
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 leading-tight">{r.name}</p>
                            <p className="text-xs text-gray-400 leading-tight mt-0.5">{r.phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Cuisine */}
                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {r.cuisine?.slice(0, 2).map(c => (
                            <span key={c} className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                              {c}
                            </span>
                          ))}
                          {(r.cuisine?.length ?? 0) > 2 && (
                            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                              +{r.cuisine.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5">
                        <StatusBadge
                          label={r.approvalStatus.replace(/_/g, ' ')}
                          restaurantStatus={r.approvalStatus}
                        />
                      </td>

                      {/* Rating */}
                      <td className="px-3 py-3.5">
                        {r.ratingCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-amber-400">
                              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{r.rating.toFixed(1)}</span>
                            <span className="text-xs text-gray-400">({r.ratingCount})</span>
                          </span>
                        ) : (
                          <span className="text-sm text-gray-300">No ratings</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-3 py-3.5">
                        <span className="text-sm text-gray-600">{r.address.city}, {r.address.state}</span>
                      </td>

                      {/* Joined */}
                      <td className="py-3.5 pl-3 pr-5">
                        <span className="text-xs text-gray-400">
                          {new Date(r.createdAt).toLocaleDateString('en-NG', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400">
                Page {page} of {totalPages} · {total} restaurants
              </p>
              <div className="flex gap-1">
                <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} label="← Prev" />
                <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} label="Next →" />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function StatPill({ label, value, color, urgent }: { label: string; value: number; color: string; urgent?: boolean }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100',
    amber: 'bg-amber-50 border-amber-100',
    green: 'bg-green-50 border-green-100',
    red: 'bg-red-50 border-red-100',
  } as Record<string, string>

  const textColors = {
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    green: 'text-green-700',
    red: 'text-red-700',
  } as Record<string, string>

  return (
    <div className={`relative rounded-xl border p-4 ${colors[color]}`}>
      {urgent && value > 0 && (
        <span className="absolute right-3 top-3 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
      )}
      <p className={`text-2xl font-bold tabular-nums ${textColors[color]}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
    </div>
  )
}

function PagBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  )
}
