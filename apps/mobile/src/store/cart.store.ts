import { create } from 'zustand'
import type { CartItem } from '@grandxl/types'

interface CartState {
  items: CartItem[]
  restaurantId: string | null
}

interface CartActions {
  addItem: (item: CartItem) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  clearCart: () => void
}

export const useCartStore = create<CartState & CartActions>((set, get) => ({
  items: [],
  restaurantId: null,

  addItem: (item) => {
    const current = get()
    // Single restaurant rule — clear cart if switching restaurants
    if (current.restaurantId && current.restaurantId !== item.restaurantId) {
      set({ items: [item], restaurantId: item.restaurantId })
      return
    }
    const existing = current.items.find((i) => i.menuItemId === item.menuItemId)
    if (existing) {
      set({
        items: current.items.map((i) =>
          i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + item.quantity } : i,
        ),
      })
    } else {
      set({ items: [...current.items, item], restaurantId: item.restaurantId })
    }
  },

  removeItem: (menuItemId) =>
    set((state) => ({
      items: state.items.filter((i) => i.menuItemId !== menuItemId),
      restaurantId: state.items.length === 1 ? null : state.restaurantId,
    })),

  updateQuantity: (menuItemId, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => i.menuItemId !== menuItemId)
          : state.items.map((i) =>
              i.menuItemId === menuItemId
                ? { ...i, quantity, itemTotal: (i.itemTotal / i.quantity) * quantity }
                : i,
            ),
    })),

  clearCart: () => set({ items: [], restaurantId: null }),
}))
