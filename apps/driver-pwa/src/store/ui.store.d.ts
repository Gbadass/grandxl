interface UiState {
    isOnline: boolean;
    jobModalOpen: boolean;
}
interface UiActions {
    setNetworkOnline: (online: boolean) => void;
    setJobModalOpen: (open: boolean) => void;
}
export declare const useUiStore: import("zustand").UseBoundStore<import("zustand").StoreApi<UiState & UiActions>>;
export {};
//# sourceMappingURL=ui.store.d.ts.map