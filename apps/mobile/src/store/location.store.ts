import { create } from 'zustand'

interface LocationState {
  coordinates: { lat: number; lng: number } | null
  city: string | null
  displayAddress: string | null
  source: 'gps' | 'manual' | null
}

interface LocationActions {
  setLocation: (
    coords: { lat: number; lng: number },
    city: string,
    display: string,
    source: 'gps' | 'manual',
  ) => void
  clearLocation: () => void
}

export const useLocationStore = create<LocationState & LocationActions>((set) => ({
  coordinates: null,
  city: null,
  displayAddress: null,
  source: null,

  setLocation: (coordinates, city, displayAddress, source) =>
    set({ coordinates, city, displayAddress, source }),

  clearLocation: () =>
    set({ coordinates: null, city: null, displayAddress: null, source: null }),
}))
