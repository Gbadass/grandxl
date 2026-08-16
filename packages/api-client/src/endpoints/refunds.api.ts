import { getClient } from '../client'
import type { ApiResponse } from '@grandxl/types'

export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'
export type RefundMethod = 'original' | 'wallet'

export interface RefundRequest {
  _id:                    string
  orderId:                string
  customerId:             string
  amountKobo:             number
  reason:                 string
  status:                 RefundStatus
  method?:                RefundMethod
  decidedBy?:             string
  decidedAt?:             Date
  decisionNote?:          string
  paystackRefundReference?: string
  walletTransactionId?:   string
  createdAt:              Date
  updatedAt:              Date
}

export interface CreateRefundRequestDto {
  orderId:    string
  amountKobo: number
  reason:     string
}

export interface DecideRefundDto {
  decision:      'approve' | 'reject'
  method?:       'original' | 'wallet'
  decisionNote?: string
}

// ── Customer ────────────────────────────────────────────────────────

export const refundsApi = {
  create: (dto: CreateRefundRequestDto) =>
    getClient().post<ApiResponse<RefundRequest>>('/refunds', dto),

  list: (params?: { page?: number; limit?: number }) =>
    getClient().get<ApiResponse<{
      items: RefundRequest[]
      total: number
      page:  number
      limit: number
      pages: number
    }>>('/refunds/my', { params }),
}

// ── Admin ───────────────────────────────────────────────────────────

export const adminRefundsApi = {
  list: (params?: { status?: RefundStatus; page?: number; limit?: number }) =>
    getClient().get<ApiResponse<{
      items: RefundRequest[]
      total: number
      page:  number
      limit: number
      pages: number
    }>>('/admin/refunds', { params }),

  decide: (id: string, dto: DecideRefundDto) =>
    getClient().patch<ApiResponse<RefundRequest>>(`/admin/refunds/${id}/decide`, dto),
}
