import { getClient } from '../client'
import type { ApiResponse, User, Address } from '@grandxl/types'

export interface UpdateProfileDto {
  firstName?: string
  lastName?: string
  email?: string
  avatar?: string
}

export interface AddAddressDto {
  label: string
  street: string
  city: string
  state: string
  country?: string
  coordinates?: { lat: number; lng: number }
  instructions?: string
}

export interface UpdatePushTokenDto {
  expoPushToken: string
}

export const usersApi = {
  getProfile: () =>
    getClient().get<ApiResponse<User>>('/users/me'),

  updateProfile: (dto: UpdateProfileDto) =>
    getClient().patch<ApiResponse<User>>('/users/me', dto),

  addAddress: (dto: AddAddressDto) =>
    getClient().post<ApiResponse<Address>>('/users/me/addresses', dto),

  updateAddress: (addressId: string, dto: Partial<AddAddressDto>) =>
    getClient().patch<ApiResponse<Address>>(`/users/me/addresses/${addressId}`, dto),

  deleteAddress: (addressId: string) =>
    getClient().delete<ApiResponse<null>>(`/users/me/addresses/${addressId}`),

  setDefaultAddress: (addressId: string) =>
    getClient().patch<ApiResponse<User>>(`/users/me/addresses/${addressId}/default`),

  updatePushToken: (dto: UpdatePushTokenDto) =>
    getClient().patch<ApiResponse<null>>('/users/me/push-token', dto),

  saveWebPushSubscription: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    getClient().post<ApiResponse<null>>('/users/me/web-push-subscription', sub),

  removeWebPushSubscription: (endpoint: string) =>
    getClient().delete<ApiResponse<null>>('/users/me/web-push-subscription', { data: { endpoint } }),

  // ── Favorites ───────────────────────────────────────────────────
  listFavorites: () =>
    getClient().get<ApiResponse<string[]>>('/users/me/favorites'),

  addFavorite: (restaurantId: string) =>
    getClient().post<ApiResponse<null>>(`/users/me/favorites/${restaurantId}`),

  removeFavorite: (restaurantId: string) =>
    getClient().delete<ApiResponse<null>>(`/users/me/favorites/${restaurantId}`),

  // S14-10: menu-item favorites (mirrors restaurant favorites)
  listFavoriteItems: () =>
    getClient().get<ApiResponse<string[]>>('/users/me/favorite-items'),

  addFavoriteItem: (menuItemId: string) =>
    getClient().post<ApiResponse<null>>(`/users/me/favorite-items/${menuItemId}`),

  removeFavoriteItem: (menuItemId: string) =>
    getClient().delete<ApiResponse<null>>(`/users/me/favorite-items/${menuItemId}`),

  exportData: () =>
    getClient().get<ApiResponse<User>>('/users/me/data-export'),

  deleteAccount: () =>
    getClient().delete<ApiResponse<null>>('/users/me/account'),
}
