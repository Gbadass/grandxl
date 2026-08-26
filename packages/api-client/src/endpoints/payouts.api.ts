import { getClient } from '../client'
import type { ApiResponse } from '@grandxl/types'

export interface BankAccount {
  bankName:      string | null
  accountNumber: string | null
  accountName:   string | null
  bankCode:      string | null
}

export interface UpdateBankAccountDto {
  bankName:      string
  accountNumber: string
  accountName:   string
  bankCode?:     string
}

export interface PayoutRequest {
  _id:               string
  riderId:           string
  userId:            string
  amountKobo:        number
  bankName:          string
  accountNumber:     string
  accountName:       string
  status:            'pending' | 'approved' | 'paid' | 'rejected'
  decidedBy?:        string
  decidedAt?:        Date
  decisionNote?:     string
  transferReference?:     string
  paystackTransferCode?:  string
  paidAt?:                Date
  createdAt:         Date
  updatedAt:         Date
}

export interface DecidePayoutDto {
  decision:           'approve' | 'reject' | 'mark-paid'
  transferReference?: string
  decisionNote?:      string
}

export interface NigerianBank {
  id:   number
  name: string
  code: string
}

export interface ResolvedAccount {
  accountName:   string
  accountNumber: string
}

// ── Rider-facing ────────────────────────────────────────────────────

export const riderPayoutsApi = {
  getBankAccount: () =>
    getClient().get<ApiResponse<BankAccount | null>>('/rider/payouts/bank-account'),

  updateBankAccount: (dto: UpdateBankAccountDto) =>
    getClient().put<ApiResponse<BankAccount>>('/rider/payouts/bank-account', dto),

  getBanks: () =>
    getClient().get<ApiResponse<NigerianBank[]>>('/rider/payouts/banks'),

  verifyAccount: (accountNumber: string, bankCode: string) =>
    getClient().post<ApiResponse<ResolvedAccount>>('/rider/payouts/verify-account', {
      accountNumber,
      bankCode,
    }),

  request: (amountKobo: number, idempotencyKey?: string) =>
    getClient().post<ApiResponse<PayoutRequest>>('/rider/payouts', { amountKobo }, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),

  list: (params?: { page?: number; limit?: number }) =>
    getClient().get<ApiResponse<{
      items: PayoutRequest[]
      total: number
      page:  number
      limit: number
      pages: number
    }>>('/rider/payouts', { params }),
}

// ── Admin-facing ────────────────────────────────────────────────────

export const adminPayoutsApi = {
  list: (params?: { status?: PayoutRequest['status']; page?: number; limit?: number }) =>
    getClient().get<ApiResponse<{
      items: PayoutRequest[]
      total: number
      page:  number
      limit: number
      pages: number
    }>>('/admin/payouts', { params }),

  decide: (id: string, dto: DecidePayoutDto) =>
    getClient().patch<ApiResponse<PayoutRequest>>(`/admin/payouts/${id}/decide`, dto),
}
