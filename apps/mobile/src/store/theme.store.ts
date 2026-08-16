import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeState {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
}

// Persisted so the choice survives app restarts. Default is `system` so we follow
// the device until the user overrides explicitly.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference:    'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name:    'grandxl-theme',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
