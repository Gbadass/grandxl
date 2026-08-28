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

export type PayoutEntityType = 'rider' | 'restaurant'

export interface PayoutRequest {
  _id:               string
  // Sprint 12 (S12-6): payouts are entity-agnostic. `entityType`/`entityId` are
  // authoritative; `riderId`/`userId` are kept for back-compat with rider-only
  // legacy documents and continue to be populated for rider requests.
  entityType?:       PayoutEntityType
  entityId?:         string
  riderId?:          string
  userId?:           string
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

// Admin listing enrichment — server-computed display name for the counterparty
// so the admin queue doesn't need per-row lookups.
export interface PayoutRequestForAdmin extends PayoutRequest {
  entityName: string | null
}

export interface RestaurantEarningsSummary {
  availableKobo:   number
  pendingHoldKobo: number
  hasBankAccount:  boolean
  inFlightRequest: { amountKobo: number; status: PayoutRequest['status'] } | null
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

// ── Restaurant-facing (S12-6) ──────────────────────────────────────

export const restaurantPayoutsApi = {
  getBankAccount: () =>
    getClient().get<ApiResponse<BankAccount | null>>('/restaurant/payouts/bank-account'),

  updateBankAccount: (dto: UpdateBankAccountDto) =>
    getClient().put<ApiResponse<BankAccount>>('/restaurant/payouts/bank-account', dto),

  getBanks: () =>
    getClient().get<ApiResponse<NigerianBank[]>>('/restaurant/payouts/banks'),

  verifyAccount: (accountNumber: string, bankCode: string) =>
    getClient().post<ApiResponse<ResolvedAccount>>('/restaurant/payouts/verify-account', {
      accountNumber,
      bankCode,
    }),

  getSummary: () =>
    getClient().get<ApiResponse<RestaurantEarningsSummary>>('/restaurant/payouts/summary'),

  request: (amountKobo: number, idempotencyKey?: string) =>
    getClient().post<ApiResponse<PayoutRequest>>('/restaurant/payouts', { amountKobo }, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),

  list: (params?: { page?: number; limit?: number }) =>
    getClient().get<ApiResponse<{
      items: PayoutRequest[]
      total: number
      page:  number
      limit: number
      pages: number
    }>>('/restaurant/payouts', { params }),
}

// ── Admin-facing ────────────────────────────────────────────────────

export const adminPayoutsApi = {
  list: (params?: { status?: PayoutRequest['status']; entityType?: PayoutEntityType; page?: number; limit?: number }) =>
    getClient().get<ApiResponse<{
      items: PayoutRequestForAdmin[]
      total: number
      page:  number
      limit: number
      pages: number
    }>>('/admin/payouts', { params }),

  decide: (id: string, dto: DecidePayoutDto) =>
    getClient().patch<ApiResponse<PayoutRequest>>(`/admin/payouts/${id}/decide`, dto),

  // Sprint 13 (S13-9): batch-approve. Server iterates via the single-approve
  // logic; failures on individual payouts are returned per-id so the client
  // can toast partial results and highlight which rows still need attention.
  batchApprove: (payoutIds: string[], note?: string) =>
    getClient().post<ApiResponse<BatchApproveResult>>('/admin/payouts/batch-approve', {
      payoutIds,
      note,
    }),
}

export interface BatchApproveResult {
  succeeded: number
  failed:    number
  failures:  Array<{ payoutId: string; message: string }>
}
