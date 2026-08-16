import { getClient } from '../client'
import type { ApiResponse } from '@grandxl/types'
import { PaymentMethod } from '@grandxl/types'

export interface InitiatePaymentDto {
  orderId: string
  method: PaymentMethod
  callbackUrl?: string
}

export interface PaymentInitResponse {
  authorizationUrl: string
  reference: string
}

export interface TransactionVerifyResponse {
  verified: boolean
  status: string
  orderId: string | null
  amount: number
}

export const paymentsApi = {
  // POST /payments/initiate — gets Paystack authorization URL for an order
  initiate: (dto: InitiatePaymentDto) =>
    getClient().post<ApiResponse<PaymentInitResponse>>('/payments/initiate', dto),

  // GET /payments/verify/:reference — poll payment status after redirect
  verify: (reference: string) =>
    getClient().get<ApiResponse<TransactionVerifyResponse>>(`/payments/verify/${reference}`),
}
