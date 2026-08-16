import { AxiosError } from 'axios'

/**
 * Extracts a user-visible message from an API error.
 * 4xx errors from NestJS carry a `message` field the user should see.
 * 5xx / network errors fall back to the provided fallback string.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status
    const message = err.response?.data?.message
    if (status && status < 500 && typeof message === 'string' && message.length > 0) {
      return message
    }
  }
  return fallback
}
