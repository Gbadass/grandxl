import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Rider, Order } from '@grandxl/types'

// GPS transmission health. Surfaced in the UI as a banner when not 'ok' so the
// rider knows dispatch can't see them — invisible failure was causing missed jobs.
export type GpsStatus = 'ok' | 'permission_denied' | 'unavailable' | 'timeout' | 'unknown'

interface RiderState {
  rider: Rider | null
  isOnline: boolean
  activeOrder: Order | null
  // Queued broadcast jobs the rider hasn't responded to yet
  pendingJobs: Order[]
  gpsStatus: GpsStatus
  lastGpsSuccessAt: number | null // epoch ms
}

interface RiderActions {
  setRider: (rider: Rider | null) => void
  setOnline: (online: boolean) => void
  setActiveOrder: (order: Order | null) => void
  addPendingJob: (order: Order) => void
  removePendingJob: (orderId: string) => void
  clearPendingJobs: () => void
  setGpsStatus: (status: GpsStatus) => void
  markGpsSuccess: () => void
}

export const useRiderStore = create<RiderState & RiderActions>()(
  persist(
    (set, get) => ({
      rider: null,
      isOnline: false,
      activeOrder: null,
      pendingJobs: [],
      gpsStatus: 'unknown',
      lastGpsSuccessAt: null,

      setRider: (rider) => set({ rider, isOnline: rider?.isOnline ?? false }),

      setOnline: (online) => {
        set({ isOnline: online })
        const r = get().rider
        if (r) set({ rider: { ...r, isOnline: online } })
      },

      setActiveOrder: (order) => set({ activeOrder: order }),

      addPendingJob: (order) =>
        set((s) => ({
          pendingJobs: s.pendingJobs.some((o) => o._id === order._id)
            ? s.pendingJobs
            : [order, ...s.pendingJobs],
        })),

      removePendingJob: (orderId) =>
        set((s) => ({ pendingJobs: s.pendingJobs.filter((o) => o._id !== orderId) })),

      clearPendingJobs: () => set({ pendingJobs: [] }),

      setGpsStatus: (status) => set({ gpsStatus: status }),
      markGpsSuccess: () => set({ gpsStatus: 'ok', lastGpsSuccessAt: Date.now() }),
    }),
    {
      name: 'gxl-rider-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist activeOrder + isOnline. Pending jobs and GPS status are ephemeral
      // — a stale pending offer after relaunch would be misleading (its 45s window is gone),
      // and GPS status is refreshed on every tick.
      partialize: (s) => ({
        activeOrder: s.activeOrder,
        isOnline:    s.isOnline,
      }),
    },
  ),
)
