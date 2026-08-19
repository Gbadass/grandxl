export const DEFAULT_COUNTRY = 'NG'
export const DEFAULT_CURRENCY = 'NGN'
export const DEFAULT_LOCALE = 'en-NG'

export const OTP_TTL_SECONDS = 600          // 10 minutes
export const OTP_MAX_ATTEMPTS = 3

export const REFRESH_TOKEN_TTL_SECONDS = 604800   // 7 days
export const PWD_RESET_TOKEN_TTL_SECONDS = 3600   // 1 hour

export const MIN_RIDER_EARNING_KOBO = 30000       // ₦300 minimum per delivery

export const PAGINATION_DEFAULT_LIMIT = 20
export const PAGINATION_MAX_LIMIT = 100

export const IS_PUBLIC_KEY = 'isPublic'
export const ROLES_KEY = 'roles'

export const REDIS_REFRESH_TOKEN_PREFIX = 'rt:'
export const REDIS_OTP_PREFIX = 'otp:'
export const REDIS_OTP_ATTEMPTS_PREFIX = 'otp:attempts:'
export const REDIS_PWD_RESET_PREFIX = 'pwd_reset:'
export const REDIS_ADMIN_LOGIN_ATTEMPTS_PREFIX = 'admin_login_attempts:'
export const REDIS_ADMIN_LOGIN_LOCKED_PREFIX = 'admin_login_locked:'
export const REDIS_RIDER_ASSIGNMENT_PREFIX = 'rider_assignment:'
export const REDIS_LOGIN_ATTEMPTS_PREFIX = 'login_attempts:'
export const REDIS_LOGIN_LOCKED_PREFIX = 'login_locked:'

export const LOGIN_MAX_ATTEMPTS = 10             // 10 wrong passwords before lockout
export const LOGIN_LOCKOUT_SECONDS = 15 * 60     // 15 minute lockout

export const REDIS_OTP_SEND_RATE_PREFIX = 'otp_send_rate:'
export const OTP_SEND_COOLDOWN_SECONDS = 60      // 1 new OTP request per phone per minute

export const MAX_ORDER_VALUE_KOBO = 500_000_00   // ₦500,000 per order sanity cap
