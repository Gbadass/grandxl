import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LocationState {
  coordinates: { lat: number; lng: number } | null
  city: string | null
  state: string | null
  displayAddress: string | null
  source: 'gps' | 'manual' | null
}

interface LocationActions {
  setLocation: (
    coords: { lat: number; lng: number },
    city: string,
    display: string,
    source: 'gps' | 'manual',
    state?: string,
  ) => void
  clearLocation: () => void
}

// Location is persisted to localStorage — not sensitive, improves UX on return visits
export const useLocationStore = create<LocationState & LocationActions>()(
  persist(
    (set) => ({
      coordinates: null,
      city: null,
      state: null,
      displayAddress: null,
      source: null,

      setLocation: (coordinates, city, displayAddress, source, state) =>
        set({ coordinates, city, displayAddress, source, state: state ?? null }),

      clearLocation: () =>
        set({ coordinates: null, city: null, state: null, displayAddress: null, source: null }),
    }),
    { name: 'grandxl-location' },
  ),
)
