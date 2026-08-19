'use client'

import { create } from 'zustand'
import type { Order } from '@grandxl/types'

interface AlertState {
  pendingOrders: Order[]
  addOrder: (order: Order) => void
  removeOrder: (orderId: string) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  pendingOrders: [],
  addOrder: (order) =>
    set((s) => ({
      pendingOrders: s.pendingOrders.some((o) => o._id === order._id)
        ? s.pendingOrders
        : [order, ...s.pendingOrders],
    })),
  removeOrder: (orderId) =>
    set((s) => ({ pendingOrders: s.pendingOrders.filter((o) => o._id !== orderId) })),
}))
