import { create } from 'zustand'

interface UiState {
  globalLoading: boolean
  activeModal: string | null
}

interface UiActions {
  setGlobalLoading: (loading: boolean) => void
  openModal: (modalId: string) => void
  closeModal: () => void
}

export const useUiStore = create<UiState & UiActions>((set) => ({
  globalLoading: false,
  activeModal: null,

  setGlobalLoading: (globalLoading) => set({ globalLoading }),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
}))
