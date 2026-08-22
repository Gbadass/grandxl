import { getClient } from '../client'
import type { ApiResponse } from '@grandxl/types'

export interface ReferralInfo {
  referralCode: string | null
  referralCount: number
  totalEarnedKobo: number
}

export const referralsApi = {
  getMyInfo: () =>
    getClient().get<ApiResponse<ReferralInfo>>('/referrals/me'),

  applyCode: (code: string) =>
    getClient().post<ApiResponse<{ applied: boolean }>>('/referrals/apply', { code }),
}
