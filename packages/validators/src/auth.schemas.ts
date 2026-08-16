import { z } from 'zod'
import { e164Phone } from './common'

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  phone: e164Phone,
  email: z.string().email().toLowerCase().trim().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  country: z.string().length(2).default('NG'),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Privacy Policy and Terms of Service' }),
  }),
})

export const loginSchema = z.object({
  phone: e164Phone.optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  password: z.string().min(1, 'Password is required'),
})

export const sendOtpSchema = z.object({
  phone: e164Phone,
})

export const verifyOtpSchema = z.object({
  phone: e164Phone,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

export const mobileRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export type RegisterFormValues = z.infer<typeof registerSchema>
export type LoginFormValues = z.infer<typeof loginSchema>
export type SendOtpFormValues = z.infer<typeof sendOtpSchema>
export type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
