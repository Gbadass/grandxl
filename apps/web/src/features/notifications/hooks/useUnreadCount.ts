import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '@grandxl/api-client'
import { useAuthStore } from '../../../store/auth.store'

export function useUnreadNotificationCount(): number {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      notificationsApi.getMine({ page: 1, limit: 1 }).then((r) => r.data.data.unreadCount),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  return data ?? 0
}
