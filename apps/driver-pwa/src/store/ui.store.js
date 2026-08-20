import { create } from 'zustand';
export const useUiStore = create((set) => ({
    isOnline: navigator.onLine,
    jobModalOpen: false,
    setNetworkOnline: (online) => set({ isOnline: online }),
    setJobModalOpen: (open) => set({ jobModalOpen: open }),
}));
//# sourceMappingURL=ui.store.js.map