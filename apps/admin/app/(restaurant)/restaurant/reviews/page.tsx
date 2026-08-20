'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { myRestaurantApi, reviewsApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { Review } from '@grandxl/types'
import { useAuthStore } from '../../../../src/store/auth.store'
import { Star, MessageSquare, TrendingUp, Award, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import '../../../../src/lib/axios'

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size === 'lg' ? 20 : size === 'md' ? 16 : 14}
          className={`${sz} ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-100 text-gray-200'}`}
        />
      ))}
    </span>
  )
}

function ratingLabel(r: number) {
  if (r >= 4.5) return { text: 'Excellent', color: 'text-emerald-600' }
  if (r >= 3.5) return { text: 'Good',      color: 'text-blue-600'    }
  if (r >= 2.5) return { text: 'Average',   color: 'text-amber-600'   }
  return                { text: 'Poor',     color: 'text-red-500'     }
}

// ── Sub-rating pill ───────────────────────────────────────────────────────────

function SubRating({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-2.5 py-1">
      <span className="text-[11px] text-gray-500">{label}</span>
      <Stars rating={value} size="sm" />
      <span className="text-[11px] font-semibold text-gray-700">{value}</span>
    </div>
  )
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false)
  const label = ratingLabel(review.restaurantRating)
  const hasLongComment = (review.comment?.length ?? 0) > 120
  const shortComment = hasLongComment ? review.comment!.slice(0, 120) + '…' : review.comment

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-white">C</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Customer</p>
            <p className="text-[11px] text-gray-400">
              {new Date(review.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Overall rating */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            <Stars rating={review.restaurantRating} size="md" />
            <span className="text-sm font-bold text-gray-900">{review.restaurantRating}</span>
          </div>
          <span className={`text-[11px] font-semibold ${label.color}`}>{label.text}</span>
        </div>
      </div>

      {/* Sub-ratings */}
      {(review.foodRating !== null || review.riderRating !== null) && (
        <div className="flex flex-wrap gap-2">
          <SubRating label="Food" value={review.foodRating} />
          <SubRating label="Rider" value={review.riderRating} />
        </div>
      )}

      {/* Comment */}
      {review.comment ? (
        <div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {expanded || !hasLongComment ? review.comment : shortComment}
          </p>
          {hasLongComment && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 cursor-pointer"
            >
              {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Read more</>}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm italic text-gray-400">No written comment</p>
      )}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-gray-900 leading-none tabular-nums">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[11px] text-gray-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type RatingFilter = 'all' | 5 | 4 | 3 | 2 | 1

export default function RestaurantReviewsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const [page, setPage] = useState(1)
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data: restaurantsData } = useQuery({
    queryKey: ['my-restaurants'],
    queryFn: () => myRestaurantApi.list(),
    enabled: isAuthenticated,
  })

  const restaurantId = restaurantsData?.data?.data?.[0]?._id

  const { data, isLoading } = useQuery({
    queryKey: ['my-reviews', restaurantId, page],
    queryFn: () => reviewsApi.getByRestaurant(restaurantId!, { page, limit: 50 }),
    enabled: !!restaurantId,
  })

  const allReviews = (data?.data?.data?.data ?? []) as Review[]
  const total = data?.data?.data?.meta?.total ?? 0

  // Derived stats
  const avgRating = allReviews.length
    ? (allReviews.reduce((s, r) => s + r.restaurantRating, 0) / allReviews.length)
    : 0

  const fiveStarCount = allReviews.filter((r) => Math.round(r.restaurantRating) === 5).length
  const lowRatingCount = allReviews.filter((r) => Math.round(r.restaurantRating) <= 2).length
  const withCommentCount = allReviews.filter((r) => r.comment).length

  const dist = [5, 4, 3, 2, 1].map((star) => {
    const count = allReviews.filter((r) => Math.round(r.restaurantRating) === star).length
    const pct = allReviews.length ? Math.round((count / allReviews.length) * 100) : 0
    return { star, count, pct }
  })

  const filtered = useMemo(() => {
    if (ratingFilter === 'all') return allReviews
    return allReviews.filter((r) => Math.round(r.restaurantRating) === ratingFilter)
  }, [allReviews, ratingFilter])

  const FILTER_TABS: { key: RatingFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All',  count: allReviews.length },
    { key: 5,     label: '5 ★',  count: dist.find((d) => d.star === 5)?.count ?? 0 },
    { key: 4,     label: '4 ★',  count: dist.find((d) => d.star === 4)?.count ?? 0 },
    { key: 3,     label: '3 ★',  count: dist.find((d) => d.star === 3)?.count ?? 0 },
    { key: 2,     label: '2 ★',  count: dist.find((d) => d.star === 2)?.count ?? 0 },
    { key: 1,     label: '1 ★',  count: dist.find((d) => d.star === 1)?.count ?? 0 },
  ]

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <p className="text-sm text-gray-500 mt-0.5">Customer feedback for your restaurant</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Star size={18} className="text-amber-500" />}
          label="Average rating"
          value={avgRating ? avgRating.toFixed(1) : '—'}
          sub={total ? `from ${total} reviews` : undefined}
          color="bg-amber-50"
        />
        <StatCard
          icon={<Award size={18} className="text-emerald-600" />}
          label="5-star reviews"
          value={fiveStarCount}
          sub={total ? `${Math.round((fiveStarCount / (total || 1)) * 100)}% of total` : undefined}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<MessageSquare size={18} className="text-blue-600" />}
          label="Written comments"
          value={withCommentCount}
          color="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-red-500" />}
          label="Need attention"
          value={lowRatingCount}
          sub="1–2 star reviews"
          color="bg-red-50"
        />
      </div>

      {/* Rating breakdown + distribution */}
      {allReviews.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Big number */}
            <div className="flex flex-col items-center justify-center sm:w-32 shrink-0">
              <p className="text-5xl font-bold text-gray-900 leading-none tabular-nums">{avgRating.toFixed(1)}</p>
              <Stars rating={avgRating} size="md" />
              <p className="text-xs text-gray-400 mt-2 text-center">{total} review{total !== 1 ? 's' : ''}</p>
            </div>

            <div className="w-px bg-gray-100 self-stretch hidden sm:block" />

            {/* Distribution bars */}
            <div className="flex-1 space-y-2">
              {dist.map(({ star, count, pct }) => (
                <button
                  key={star}
                  onClick={() => setRatingFilter(ratingFilter === star ? 'all' : star as RatingFilter)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-1 transition-colors cursor-pointer ${
                    ratingFilter === star ? 'bg-amber-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="w-8 shrink-0 text-right text-xs font-semibold text-gray-600">{star} ★</span>
                  <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-gray-400">
                    {pct}% ({count})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {allReviews.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {FILTER_TABS.map(({ key, label, count }) => (
            <button
              key={String(key)}
              onClick={() => setRatingFilter(key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                ratingFilter === key
                  ? 'bg-orange-600 text-white shadow-sm shadow-orange-200'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 ${ratingFilter === key ? 'opacity-75' : 'text-gray-400'}`}>
                  ({count})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Review list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-orange-500" />
          <p className="text-sm text-gray-400">Loading reviews…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Star size={28} className="text-gray-200" />
          </div>
          <p className="font-semibold text-gray-600 text-sm">
            {allReviews.length === 0 ? 'No reviews yet' : `No ${ratingFilter}★ reviews`}
          </p>
          <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto">
            {allReviews.length === 0
              ? 'Your first review will appear here once a customer rates their order.'
              : 'Try selecting a different star filter above.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ReviewCard key={r._id} review={r} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Page {page} · {total} total reviews
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 50 >= total}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
