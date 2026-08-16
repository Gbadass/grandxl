import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ShoppingBag, Bike, RefreshCw, CheckCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { NotificationType } from '@grandxl/types'
import { notificationsApi } from '@grandxl/api-client'
import type { Notification } from '@grandxl/api-client'

// ── Relative time helper ───────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHrs === 1) return '1 hour ago'
  if (diffHrs < 24) return `${diffHrs} hours ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return new Date(date).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: diffDays > 365 ? 'numeric' : undefined,
  })
}

// ── Notification icon ──────────────────────────────────────────────────────────

function NotificationIcon({ type }: { type: NotificationType }) {
  const base = 'flex items-center justify-center h-10 w-10 rounded-full shrink-0'

  if (type === NotificationType.ORDER_STATUS || type === NotificationType.NEW_ORDER) {
    return (
      <div className={`${base} bg-primary/10`}>
        <ShoppingBag size={18} className="text-primary" />
      </div>
    )
  }

  if (type === NotificationType.RIDER_JOB) {
    return (
      <div className={`${base} bg-indigo-50`}>
        <Bike size={18} className="text-indigo-500" />
      </div>
    )
  }

  // PROMO | SYSTEM
  return (
    <div className={`${base} bg-gray-100`}>
      <Bell size={18} className="text-gray-500" />
    </div>
  )
}

// ── Skeleton row ───────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-2xl p-4 flex gap-3 items-start">
      <div className="h-10 w-10 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3.5 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-1/4" />
      </div>
    </div>
  )
}

// ── Notification card ──────────────────────────────────────────────────────────

interface NotificationCardProps {
  notification: Notification
  index: number
  onTap: (notification: Notification) => void
}

function NotificationCard({ notification, index, onTap }: NotificationCardProps) {
  const unreadStyles = notification.isRead
    ? 'bg-white'
    : 'bg-primary/5 border-l-2 border-primary'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.2 }}
    >
      <button
        onClick={() => onTap(notification)}
        className={`w-full text-left rounded-2xl overflow-hidden p-4 flex gap-3 items-start cursor-pointer transition-colors hover:bg-primary/10 ${unreadStyles}`}
        style={{ touchAction: 'manipulation', minHeight: '44px' }}
      >
        <NotificationIcon type={notification.type} />

        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${notification.isRead ? 'font-medium text-gray-800' : 'font-semibold text-gray-900'}`}>
            {notification.title}
          </p>
          <p className="text-sm text-gray-500 mt-0.5 leading-snug line-clamp-2">
            {notification.body}
          </p>
          <p className="text-xs text-gray-400 mt-1.5">
            {timeAgo(notification.createdAt)}
          </p>
        </div>

        {!notification.isRead && (
          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
        )}
      </button>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LIMIT = 20

export default function NotificationsPage() {
  const { t } = useTranslation('notifications')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  // ── Data fetching ────────────────────────────────────────────────────────────

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['notifications', page],
    queryFn: async () => {
      const res = await notificationsApi.getMine({ page, limit: LIMIT })
      return res.data.data
    },
  })

  const notifications: Notification[] = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0
  const total = data?.total ?? 0
  const hasMore = notifications.length < total

  // ── Mutations ────────────────────────────────────────────────────────────────

  const markAsRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success(t('markAllRead'))
    },
    onError: () => {
      toast.error(t('common:error', 'Something went wrong'))
    },
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleTap(notification: Notification) {
    if (!notification.isRead) {
      markAsRead.mutate(notification._id)
    }

    if (
      notification.type === NotificationType.ORDER_STATUS &&
      notification.data !== null &&
      typeof notification.data['orderId'] === 'string'
    ) {
      void navigate(`/orders/${notification.data['orderId']}/tracking`)
    }
  }

  function handleRefresh() {
    void refetch()
  }

  function handleMarkAllRead() {
    markAllRead.mutate()
  }

  function loadMore() {
    setPage((p) => p + 1)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display font-bold text-xl text-gray-900">
          {t('title')}
        </h1>

        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold cursor-pointer hover:bg-primary/20 transition-colors disabled:opacity-50"
              style={{ touchAction: 'manipulation', minHeight: '44px' }}
            >
              <CheckCheck size={13} />
              {t('markAllRead')}
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label={t('refresh')}
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <RefreshCw
              size={16}
              className={`text-gray-500 transition-transform ${isFetching ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Unread count subtitle */}
      {unreadCount > 0 && (
        <p className="text-sm text-gray-400 mb-4">
          {t('unreadCount', { count: unreadCount })}
        </p>
      )}

      {/* List / states */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2 mt-4"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <NotificationSkeleton key={i} />
            ))}
          </motion.div>
        ) : isError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <RefreshCw size={32} className="text-red-300" />
            </div>
            <h2 className="font-semibold text-gray-900">{t('common:error', 'Something went wrong')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('common:retry', 'Check your connection and try again')}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl cursor-pointer"
              style={{ minHeight: '44px' }}
            >
              {t('common:retry', 'Retry')}
            </button>
          </motion.div>
        ) : notifications.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <Bell size={36} className="text-gray-300" />
            </div>
            <h2 className="font-semibold text-gray-900">{t('empty')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('emptySubtitle')}</p>
          </motion.div>
        ) : (
          <motion.div
            key={`list-${page}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4"
          >
            <div className="space-y-2">
              {notifications.map((notification, i) => (
                <NotificationCard
                  key={notification._id}
                  notification={notification}
                  index={i}
                  onTap={handleTap}
                />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <button
                onClick={loadMore}
                className="mt-4 w-full py-3 text-sm font-medium text-primary border border-primary/30 rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors"
                style={{ minHeight: '44px' }}
              >
                {t('loadMore')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
