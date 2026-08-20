import type { Rider, Order } from '@grandxl/types';
interface RiderState {
    rider: Rider | null;
    isOnline: boolean;
    activeOrder: Order | null;
    pendingJobs: Order[];
}
interface RiderActions {
    setRider: (rider: Rider | null) => void;
    setOnline: (online: boolean) => void;
    setActiveOrder: (order: Order | null) => void;
    addPendingJob: (order: Order) => void;
    removePendingJob: (orderId: string) => void;
    clearPendingJobs: () => void;
}
export declare const useRiderStore: import("zustand").UseBoundStore<import("zustand").StoreApi<RiderState & RiderActions>>;
export {};
//# sourceMappingURL=rider.store.d.ts.map