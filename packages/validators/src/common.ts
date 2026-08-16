import { z } from 'zod'

// E.164 phone validator — accepts local Nigerian format, transforms to E.164
// Local: 08012345678  →  E.164: +2348012345678
export const e164Phone = z
  .string()
  .trim()
  .transform((val) => {
    // Already E.164
    if (val.startsWith('+')) return val

    // Nigerian local format: 0xxxxxxxxx → +234xxxxxxxxx
    if (val.startsWith('0') && val.length === 11) {
      return `+234${val.slice(1)}`
    }

    return val
  })
  .pipe(
    z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be a valid phone number'),
  )

export const mongoObjectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid ID')

export const koboAmount = z
  .number()
  .int('Amount must be a whole number (kobo)')
  .nonnegative('Amount cannot be negative')

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})
