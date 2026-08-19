'use client'

import { create } from 'zustand'
import type { Order } from '@grandxl/types'

interface RestaurantAlertState {
  pendingOrder: Order | null
  setPendingOrder: (order: Order | null) => void
}

export const useRestaurantAlertStore = create<RestaurantAlertState>((set) => ({
  pendingOrder: null,
  setPendingOrder: (order) => set({ pendingOrder: order }),
}))
