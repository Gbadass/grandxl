import { getClient } from '../client'
import type { Restaurant, MenuItem } from '@grandxl/types'

export interface SearchResults {
  restaurants: Restaurant[]
  menuItems: MenuItem[]
  meta: {
    query: string
    restaurantCount: number
    menuItemCount: number
    page: number
    limit: number
  }
}

export interface AutocompleteResult {
  _id: string
  name: string
  slug: string
  logo: string | null
}

export const searchApi = {
  search: (params: {
    q: string
    page?: number
    limit?: number
    country?: string
    cuisine?: string
    openNow?: boolean
    minRating?: number
    sortBy?: 'relevance' | 'rating' | 'newest'
  }) =>
    getClient().get<{ data: SearchResults }>('/search', { params }),

  autocomplete: (q: string, country?: string) =>
    getClient().get<{ data: AutocompleteResult[] }>('/search/autocomplete', {
      params: { q, ...(country ? { country } : {}) },
    }),
}
