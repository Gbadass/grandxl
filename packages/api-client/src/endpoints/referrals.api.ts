import { getClient } from '../client'
import type { ApiResponse } from '@grandxl/types'

export interface ReferralInfo {
  referralCode: string | null
  referralCount: number
  totalEarnedKobo: number
  hasAppliedCode: boolean
}

export interface ReferralTopReferrer {
  referrerId: string
  firstName: string | null
  lastName: string | null
  rewardedCount: number
  totalEarnedKobo: number
}

export interface ReferralOverview {
  periodDays: number
  totalReferrals: number
  pendingReferrals: number
  rewardedReferrals: number
  totalRewardedKobo: number
  topReferrers: ReferralTopReferrer[]
}

export const referralsApi = {
  getMyInfo: () =>
    getClient().get<ApiResponse<ReferralInfo>>('/referrals/me'),

  applyCode: (code: string) =>
    getClient().post<ApiResponse<{ applied: boolean }>>('/referrals/apply', { code }),

  getAdminOverview: (days = 30) =>
    getClient().get<ApiResponse<ReferralOverview>>('/admin/referrals/overview', {
      params: { days },
    }),
}
