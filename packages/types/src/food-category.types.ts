export interface FoodCategory {
  _id: string
  name: string
  slug: string        // lowercase, used as the cuisine filter tag
  image: string | null
  sortOrder: number
  isActive: boolean
  createdBy: string | null  // restaurantId of creator; null = platform seeded
  createdAt: Date
  updatedAt: Date
}

export interface CreateFoodCategoryDto {
  name: string
  image?: string
  sortOrder?: number
}

export interface UpdateFoodCategoryDto {
  name?: string
  image?: string
  sortOrder?: number
  isActive?: boolean
}
