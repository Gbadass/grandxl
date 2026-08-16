import { z } from 'zod'
import { coordinatesSchema } from './common'

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  avatar: z.string().url().optional(),
})

export const addAddressSchema = z.object({
  label: z.string().trim().min(1).max(20),
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  country: z.string().length(2).default('NG'),
  coordinates: coordinatesSchema,
  instructions: z.string().trim().max(200).optional(),
})

export const updatePushTokenSchema = z.object({
  expoPushToken: z
    .string()
    .regex(/^ExponentPushToken\[.+\]$/, 'Must be a valid Expo push token'),
})

export const queryRestaurantsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.1).max(50).default(10),
  cuisine: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>
export type AddAddressFormValues = z.infer<typeof addAddressSchema>
export type UpdatePushTokenValues = z.infer<typeof updatePushTokenSchema>
