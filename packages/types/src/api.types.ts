// Standard API response wrapper shape — enforced by TransformInterceptor
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  success: boolean
  data: {
    data: T[]
    meta: PaginatedMeta
  }
}

// Standard error response shape — enforced by AllExceptionsFilter
export interface ApiError {
  success: false
  statusCode: number
  message: string
  errors?: string[]
  requestId?: string
}
