import { getClient } from '../client'
import type { ApiResponse, User, UserRole } from '@grandxl/types'

export interface AuthTokens {
  accessToken: string
  // refreshToken present in body so mobile clients can store in SecureStore (web ignores it)
  refreshToken?: string
}

export interface AuthResponse extends AuthTokens {
  user: User
}

export interface RegisterDto {
  firstName: string
  lastName: string
  phone: string
  email?: string
  password: string
  country?: string
  consentGiven: true
  role?: UserRole
}

export interface LoginDto {
  phone?: string
  email?: string
  password: string
}

export interface AdminLoginDto {
  email: string
  password: string
}

export interface SendOtpDto {
  phone: string
}

export interface VerifyOtpDto {
  phone: string
  otp: string
}

export interface ForgotPasswordDto {
  email: string
}

export interface ResetPasswordDto {
  token: string
  newPassword: string
}

export interface MobileRefreshDto {
  refreshToken: string
}

export const authApi = {
  register: (dto: RegisterDto) =>
    getClient().post<ApiResponse<AuthResponse>>('/auth/register', dto),

  login: (dto: LoginDto) =>
    getClient().post<ApiResponse<AuthResponse>>('/auth/login', dto),

  adminLogin: (dto: AdminLoginDto) =>
    getClient().post<ApiResponse<AuthResponse>>('/auth/admin/login', dto),

  portalLogin: (dto: AdminLoginDto) =>
    getClient().post<ApiResponse<AuthResponse>>('/auth/portal/login', dto),

  logout: () =>
    getClient().post<ApiResponse<null>>('/auth/logout'),

  // Web: uses httpOnly cookie (no body needed)
  refresh: () =>
    getClient().post<ApiResponse<AuthResponse>>('/auth/refresh'),

  // Mobile: sends refresh token in body (no httpOnly cookie on native apps)
  refreshMobile: (dto: MobileRefreshDto) =>
    getClient().post<ApiResponse<AuthResponse>>('/auth/refresh/mobile', dto),

  sendOtp: (dto: SendOtpDto) =>
    getClient().post<ApiResponse<null>>('/auth/send-otp', dto),

  verifyOtp: (dto: VerifyOtpDto) =>
    getClient().post<ApiResponse<AuthResponse>>('/auth/verify-otp', dto),

  forgotPassword: (dto: ForgotPasswordDto) =>
    getClient().post<ApiResponse<null>>('/auth/forgot-password', dto),

  resetPassword: (dto: ResetPasswordDto) =>
    getClient().post<ApiResponse<null>>('/auth/reset-password', dto),

  getMe: () =>
    getClient().get<ApiResponse<User>>('/auth/me'),

  addRole: (role: UserRole) =>
    getClient().post<ApiResponse<AuthResponse>>('/auth/add-role', { role }),

  verifyAndAddRole: (dto: { email?: string; phone?: string; password: string; role: UserRole }) =>
    getClient().post<ApiResponse<AuthResponse>>('/auth/verify-and-add-role', dto),
}
