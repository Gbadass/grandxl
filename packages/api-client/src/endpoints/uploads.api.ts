import { getClient } from '../client'
import type { ApiResponse } from '@grandxl/types'

function toFormData(file: File | FormData): FormData {
  if (file instanceof FormData) return file
  const fd = new FormData()
  fd.append('file', file)
  return fd
}

export const uploadsApi = {
  uploadAvatar: (file: File | FormData) =>
    getClient().post<ApiResponse<{ url: string; publicId: string }>>(
      '/uploads/avatar', toFormData(file), { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  uploadRestaurantCover: (file: File | FormData) =>
    getClient().post<ApiResponse<{ url: string; publicId: string }>>(
      '/uploads/restaurant-cover', toFormData(file), { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  uploadRestaurantLogo: (file: File | FormData) =>
    getClient().post<ApiResponse<{ url: string; publicId: string }>>(
      '/uploads/restaurant-logo', toFormData(file), { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  uploadMenuItemPhoto: (file: File | FormData) =>
    getClient().post<ApiResponse<{ url: string; publicId: string }>>(
      '/uploads/menu-item', toFormData(file), { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  uploadRiderDocument: (file: File | FormData) =>
    getClient().post<ApiResponse<{ url: string; publicId: string }>>(
      '/uploads/rider-document', toFormData(file), { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  uploadDeliveryProof: (file: File | FormData) =>
    getClient().post<ApiResponse<{ url: string; publicId: string }>>(
      '/uploads/delivery-proof', toFormData(file), { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  // Keep old name as alias so existing callers don't break
  uploadImage: (file: File | FormData) =>
    getClient().post<ApiResponse<{ url: string; publicId: string }>>(
      '/uploads/avatar', toFormData(file), { headers: { 'Content-Type': 'multipart/form-data' } },
    ),
}
