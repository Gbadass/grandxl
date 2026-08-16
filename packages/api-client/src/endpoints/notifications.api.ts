import { getClient } from '../client'
import type { ApiResponse, NotificationType } from '@grandxl/types'

export interface Notification {
  _id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, unknown> | null
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export interface NotificationsResult {
  notifications: Notification[]
  unreadCount: number
  total: number
}

export const notificationsApi = {
  getMine: (params?: { page?: number; limit?: number }) =>
    getClient().get<ApiResponse<NotificationsResult>>('/notifications/my', { params }),

  markAsRead: (id: string) =>
    getClient().patch<ApiResponse<null>>(`/notifications/${id}/read`),

  markAllRead: () =>
    getClient().patch<ApiResponse<null>>('/notifications/read-all'),

  getVapidPublicKey: () =>
    getClient().get<ApiResponse<{ publicKey: string }>>('/notifications/vapid-public-key'),
}
