import { getClient } from '../client'
import type { ApiResponse, PaginatedResponse, Wallet, WalletTransaction } from '@grandxl/types'

export interface TopUpDto {
  amountKobo: number
}

export const walletApi = {
  getBalance: () =>
    getClient().get<ApiResponse<Wallet>>('/wallet'),

  // Idempotent: pass an Idempotency-Key header to dedupe network retries.
  topUp: (dto: TopUpDto, idempotencyKey?: string) =>
    getClient().post<ApiResponse<{ authorizationUrl: string; reference: string }>>(
      '/wallet/topup',
      dto,
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
    ),

  getTransactions: (params?: { page?: number; limit?: number }) =>
    getClient().get<PaginatedResponse<WalletTransaction>>('/wallet/transactions', { params }),
}
