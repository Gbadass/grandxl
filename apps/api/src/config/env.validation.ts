import * as Joi from 'joi'

export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').required(),
  PORT: Joi.number().default(3001),
  CLIENT_URL: Joi.string().uri().required(),
  ADMIN_URL: Joi.string().uri().required(),
  RIDER_URL: Joi.string().uri().default('http://localhost:5174'),

  // Database
  MONGODB_URI: Joi.string().required(),

  // Auth — minimum 64 chars to prevent weak secrets
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').default(''),
  CLOUDINARY_API_KEY: Joi.string().allow('').default(''),
  CLOUDINARY_API_SECRET: Joi.string().allow('').default(''),

  // Paystack
  PAYSTACK_SECRET_KEY: Joi.string().allow('').default(''),
  PAYSTACK_PUBLIC_KEY: Joi.string().allow('').default(''), // frontend-only key, not used by API

  // Google Maps — used for distance-based delivery fees (not yet active)
  GOOGLE_MAPS_API_KEY: Joi.string().allow('').default(''),

  // Termii SMS
  TERMII_API_KEY: Joi.string().allow('').default(''),
  TERMII_SENDER_ID: Joi.string().default('GrandXL'),
  TERMII_BASE_URL: Joi.string().uri().default('https://v3.api.termii.com'),

  // Sentry
  SENTRY_DSN_API: Joi.string().allow('').default(''),

  // Resend
  RESEND_API_KEY: Joi.string().allow('').default(''),
  RESEND_FROM_EMAIL: Joi.string().email().default('noreply@grandxl.com'),
  RESEND_FROM_NAME: Joi.string().default('GrandXL'),

  // Business
  PLATFORM_COMMISSION_PERCENT: Joi.number().default(15),

  // Web Push (VAPID) — generate with: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY:  Joi.string().allow('').default(''),
  VAPID_PRIVATE_KEY: Joi.string().allow('').default(''),
  VAPID_SUBJECT:     Joi.string().default('mailto:admin@grandxl.com'),

  // Dev helpers
  SKIP_OTP_IN_DEV: Joi.string().valid('true', 'false').default('false'),

  // Defaults
  DEFAULT_COUNTRY: Joi.string().length(2).default('NG'),
  DEFAULT_CURRENCY: Joi.string().length(3).default('NGN'),
  DEFAULT_LOCALE: Joi.string().default('en-NG'),
})
