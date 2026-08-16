import { z } from 'zod'
import { e164Phone, coordinatesSchema, koboAmount } from './common'

const openingHoursDaySchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  close: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  isOpen: z.boolean().default(true),
})

export const openingHoursSchema = z.object({
  monday: openingHoursDaySchema,
  tuesday: openingHoursDaySchema,
  wednesday: openingHoursDaySchema,
  thursday: openingHoursDaySchema,
  friday: openingHoursDaySchema,
  saturday: openingHoursDaySchema,
  sunday: openingHoursDaySchema,
})

export const createRestaurantSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
  phone: e164Phone,
  email: z.string().email().toLowerCase().trim().optional(),
  cuisine: z.array(z.string().trim()).min(1, 'At least one cuisine type is required'),
  address: z.object({
    street: z.string().trim().min(1, 'Street is required').max(200),
    city: z.string().trim().min(1, 'City is required').max(100),
    state: z.string().trim().min(1, 'State is required').max(100),
    country: z.string().length(2).default('NG'),
    coordinates: coordinatesSchema,
  }),
  openingHours: openingHoursSchema.optional(),
  minOrderAmount: koboAmount.optional(),
  deliveryFeeFixed: z.number().int().min(0, 'Delivery fee cannot be negative').optional(),
  estimatedDeliveryTime: z.number().int().min(1).max(180).optional(),
})

export const updateRestaurantSchema = createRestaurantSchema.partial()

export const menuCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(50),
  description: z.string().trim().max(200).optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export const menuItemExtraSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number().int().min(0),
  isRequired: z.boolean().default(false),
})

export const createMenuItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(100),
  description: z.string().trim().max(300).optional(),
  price: koboAmount,
  categoryId: z.string().min(1, 'Category is required'),
  isAvailable: z.boolean().default(true),
  preparationTime: z.number().int().min(1).max(120).optional(),
  allergens: z.array(z.string().trim()).default([]),
  extras: z.array(menuItemExtraSchema).default([]),
})

export const updateMenuItemSchema = createMenuItemSchema.partial()

export type CreateRestaurantValues = z.infer<typeof createRestaurantSchema>
export type UpdateRestaurantValues = z.infer<typeof updateRestaurantSchema>
export type MenuCategoryValues = z.infer<typeof menuCategorySchema>
export type CreateMenuItemValues = z.infer<typeof createMenuItemSchema>
export type UpdateMenuItemValues = z.infer<typeof updateMenuItemSchema>
