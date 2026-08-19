import { getClient } from '../client'
import type { ChatMessage } from '@grandxl/types'

export type { ChatMessage }

export interface ChatHistoryResponse {
  messages: ChatMessage[]
  total: number
  unreadCount: number
}

export const chatApi = {
  getMessages: (
    orderId: string,
    params?: { page?: number; limit?: number; before?: string },
  ) =>
    getClient().get<{ data: ChatHistoryResponse }>(`/chat/${orderId}/messages`, { params }),

  markRead: (orderId: string) =>
    getClient().post<{ data: { marked: number } }>(`/chat/${orderId}/read`),

  deleteMessage: (orderId: string, messageId: string) =>
    getClient().delete<{ data: { deleted: boolean } }>(`/chat/${orderId}/messages/${messageId}`),
}
