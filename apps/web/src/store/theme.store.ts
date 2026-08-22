import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeStore {
  isDark: boolean
  toggle: () => void
  setDark: (v: boolean) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () => set((s) => ({ isDark: !s.isDark })),
      setDark: (v) => set({ isDark: v }),
    }),
    { name: 'gxl-theme' },
  ),
)
