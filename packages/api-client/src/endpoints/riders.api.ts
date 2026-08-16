import { getClient } from '../client'
import type { ApiResponse, PaginatedResponse, Rider, Order, VehicleType } from '@grandxl/types'

export interface UpdateLocationDto {
  lat: number
  lng: number
  bearing: number
}

export interface RegisterRiderDto {
  vehicleType: VehicleType
  vehiclePlate?: string
}

export interface UpdateDocumentsDto {
  idCard?: string
  driverLicense?: string
  vehiclePhoto?: string
}

export const ridersApi = {
  getProfile: () =>
    getClient().get<ApiResponse<Rider>>('/riders/me'),

  registerRider: (dto: RegisterRiderDto) =>
    getClient().post<ApiResponse<Rider>>('/riders/register', dto),

  toggleOnline: (isOnline: boolean) =>
    getClient().patch<ApiResponse<Rider>>('/riders/me/availability', { isOnline }),

  updateLocation: (dto: UpdateLocationDto) =>
    getClient().patch<ApiResponse<null>>('/riders/me/location', dto),

  updateDocuments: (dto: UpdateDocumentsDto) =>
    getClient().patch<ApiResponse<Rider>>('/riders/me/documents', dto),

  getAvailableJobs: () =>
    getClient().get<ApiResponse<Order[]>>('/riders/me/jobs/available'),

  getActiveJob: () =>
    getClient().get<ApiResponse<Order | null>>('/riders/me/jobs/active'),

  acceptJob: (orderId: string) =>
    getClient().post<ApiResponse<void>>(`/riders/me/jobs/${orderId}/accept`),

  getDeliveryHistory: (params?: { page?: number; limit?: number }) =>
    getClient().get<PaginatedResponse<Order>>('/riders/me/jobs/history', { params }),

  getMetrics: (sinceDays?: number) =>
    getClient().get<ApiResponse<{
      deliveriesCount:    number
      cancelledCount:     number
      cancellationRate:   number
      onTimeCount:        number
      onTimeRate:         number
      avgDeliveryMinutes: number
    }>>('/riders/me/metrics', { params: sinceDays ? { sinceDays } : undefined }),
}
