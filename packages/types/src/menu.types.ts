export interface MenuCategory {
  _id: string
  restaurantId: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MenuItemVariantOption {
  name: string
  priceAdjustment: number // kobo
}

export interface MenuItemVariant {
  name: string
  isRequired: boolean
  options: MenuItemVariantOption[]
}

export interface MenuItemAddOn {
  name: string
  price: number // kobo
  isAvailable: boolean
}

export interface MenuItem {
  _id: string
  restaurantId: string
  categoryId: string
  name: string
  description: string
  image: string | null
  basePrice: number // kobo
  isAvailable: boolean
  isPopular: boolean
  sortOrder: number
  variants: MenuItemVariant[]
  addOns: MenuItemAddOn[]
  allergens: string[]
  calories: number | null
  prepTimeMinutes: number | null
  stockCount: number | null
  lowStockThreshold: number | null
  createdAt: Date
  updatedAt: Date
}
