import { getClient } from '../client'

export interface PlatformPricing {
  serviceFeePercent: number
  serviceFeeCapKobo: number
  deliveryTiers: { maxDistanceKm: number; feeKobo: number }[]
}

export const platformApi = {
  getPricing: () =>
    getClient().get<{ data: PlatformPricing }>('/platform/pricing'),
}
