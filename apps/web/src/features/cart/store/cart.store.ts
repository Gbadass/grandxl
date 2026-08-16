import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  // Returns true if adding this item would clear the current cart (different restaurant)
  wouldClearCart: (restaurantId: string) => boolean
}

// Cart is persisted to localStorage — the ONE place localStorage is used.
// Safe because cart data is not sensitive (no tokens, no payment data).
// Survives page refresh and accidental tab close.
export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,

      addItem: (item) => {
        const { items, restaurantId } = get()

        // Single restaurant rule — clear cart if from a different restaurant
        if (restaurantId && restaurantId !== item.restaurantId) {
          set({ items: [item], restaurantId: item.restaurantId })
          return
        }

        const existing = items.find(
          (i) => i.menuItemId === item.menuItemId,
        )

        if (existing) {
          set({
            items: items.map((i) =>
              i.menuItemId === item.menuItemId
                ? { ...i, quantity: i.quantity + item.quantity, itemTotal: i.itemTotal + item.itemTotal }
                : i,
            ),
          })
        } else {
          set({
            items: [...items, item],
            restaurantId: item.restaurantId,
          })
        }
      },

      removeItem: (menuItemId) => {
        const remaining = get().items.filter((i) => i.menuItemId !== menuItemId)
        set({
          items: remaining,
          restaurantId: remaining.length === 0 ? null : get().restaurantId,
        })
      },

      updateQuantity: (menuItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId)
          return
        }
        set({
          items: get().items.map((i) => {
            if (i.menuItemId !== menuItemId) return i
            const unitPrice = i.itemTotal / i.quantity
            return { ...i, quantity, itemTotal: Math.round(unitPrice * quantity) }
          }),
        })
      },

      clearCart: () => set({ items: [], restaurantId: null }),

      wouldClearCart: (restaurantId) => {
        const { items, restaurantId: currentId } = get()
        return items.length > 0 && currentId !== null && currentId !== restaurantId
      },
    }),
    { name: 'grandxl-cart' },
  ),
)
