import { getClient } from '../client'
import type { ApiResponse, PaginatedResponse, Dispute } from '@grandxl/types'

export type DisputeType =
  | 'wrong_order'
  | 'missing_items'
  | 'late_delivery'
  | 'food_quality'
  | 'rider_conduct'
  | 'payment_issue'
  | 'other'

export interface CreateDisputePayload {
  orderId: string
  type: DisputeType
  description: string
}

export const disputesApi = {
  // Customer
  create: (payload: CreateDisputePayload) =>
    getClient().post<ApiResponse<Dispute>>('/disputes', payload),

  listMine: (params?: { page?: number; limit?: number }) =>
    getClient().get<PaginatedResponse<Dispute>>('/disputes/my', { params }),

  // Admin
  listAll: (params?: { status?: string; page?: number; limit?: number }) =>
    getClient().get<PaginatedResponse<Dispute>>('/disputes', { params }),

  resolve: (id: string, resolution: string) =>
    getClient().patch<ApiResponse<Dispute>>(`/disputes/${id}/resolve`, { resolution }),
}
