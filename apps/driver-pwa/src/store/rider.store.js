import { create } from 'zustand';
export const useRiderStore = create((set, get) => ({
    rider: null,
    isOnline: false,
    activeOrder: null,
    pendingJobs: [],
    setRider: (rider) => set({ rider, isOnline: rider?.isOnline ?? false }),
    setOnline: (online) => {
        set({ isOnline: online });
        const r = get().rider;
        if (r)
            set({ rider: { ...r, isOnline: online } });
    },
    setActiveOrder: (order) => set({ activeOrder: order }),
    addPendingJob: (order) => set((s) => ({ pendingJobs: [order, ...s.pendingJobs] })),
    removePendingJob: (orderId) => set((s) => ({ pendingJobs: s.pendingJobs.filter((o) => o._id !== orderId) })),
    clearPendingJobs: () => set({ pendingJobs: [] }),
}));
//# sourceMappingURL=rider.store.js.map