import { create } from 'zustand'
import type { User } from '@grandxl/types'

interface AuthState {
  user: User | null
  accessToken: string | null // memory only — never persisted
  isAuthenticated: boolean
  isInitializing: boolean
}

interface AuthActions {
  setAuth: (user: User, accessToken: string) => void
  clearAuth: () => void
  setInitializing: (value: boolean) => void
  updateUser: (partial: Partial<User>) => void
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitializing: true,

  setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),

  clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),

  setInitializing: (value) => set({ isInitializing: value }),

  updateUser: (partial) => {
    const current = get().user
    if (current) set({ user: { ...current, ...partial } })
  },
}))
