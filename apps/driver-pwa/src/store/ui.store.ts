import { create } from 'zustand'

interface UiState {
  isOnline: boolean // network connectivity
  jobModalOpen: boolean
}

interface UiActions {
  setNetworkOnline: (online: boolean) => void
  setJobModalOpen: (open: boolean) => void
}

export const useUiStore = create<UiState & UiActions>((set) => ({
  isOnline: navigator.onLine,
  jobModalOpen: false,

  setNetworkOnline: (online) => set({ isOnline: online }),
  setJobModalOpen: (open) => set({ jobModalOpen: open }),
}))
