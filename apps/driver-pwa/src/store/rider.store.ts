import { create } from 'zustand'
import type { Rider, Order } from '@grandxl/types'

interface RiderState {
  rider: Rider | null
  isOnline: boolean
  activeOrder: Order | null
  // Queued broadcast jobs the rider hasn't responded to yet
  pendingJobs: Order[]
}

interface RiderActions {
  setRider: (rider: Rider | null) => void
  setOnline: (online: boolean) => void
  setActiveOrder: (order: Order | null) => void
  addPendingJob: (order: Order) => void
  removePendingJob: (orderId: string) => void
  clearPendingJobs: () => void
}

export const useRiderStore = create<RiderState & RiderActions>((set, get) => ({
  rider: null,
  isOnline: false,
  activeOrder: null,
  pendingJobs: [],

  setRider: (rider) => set({ rider, isOnline: rider?.isOnline ?? false }),

  setOnline: (online) => {
    set({ isOnline: online })
    const r = get().rider
    if (r) set({ rider: { ...r, isOnline: online } })
  },

  setActiveOrder: (order) => set({ activeOrder: order }),

  addPendingJob: (order) =>
    set((s) => ({ pendingJobs: [order, ...s.pendingJobs] })),

  removePendingJob: (orderId) =>
    set((s) => ({ pendingJobs: s.pendingJobs.filter((o) => o._id !== orderId) })),

  clearPendingJobs: () => set({ pendingJobs: [] }),
}))
