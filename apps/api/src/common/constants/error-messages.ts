export const ERROR_MESSAGES = {
  // Auth
  INVALID_CREDENTIALS: 'Invalid credentials',
  ACCOUNT_LOCKED: 'Account temporarily locked due to repeated failed attempts. Try again in 30 minutes.',
  OTP_EXPIRED: 'OTP expired or not found. Request a new code.',
  OTP_INVALID: 'Invalid OTP',
  OTP_MAX_ATTEMPTS: 'Too many OTP attempts. Request a new code.',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  UNAUTHORIZED: 'Unauthorized',

  // Users
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  PHONE_ALREADY_EXISTS: 'Phone number already registered',

  // Orders
  ORDER_NOT_FOUND: 'Order not found',
  INVALID_ORDER_STATUS: 'Invalid order status transition',
  RESTAURANT_CLOSED: 'Restaurant is currently closed',
  OUTSIDE_DELIVERY_AREA: 'Address is outside the delivery area',
  INSUFFICIENT_BALANCE: 'Insufficient wallet balance',

  // Restaurants
  RESTAURANT_NOT_FOUND: 'Restaurant not found',
  NOT_APPROVED: 'Restaurant is not approved',

  // Generic
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'Resource not found',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
  INVALID_ID: 'Invalid ID format',
} as const
