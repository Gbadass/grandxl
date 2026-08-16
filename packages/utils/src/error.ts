interface AxiosLike {
  response?: {
    data?: {
      message?: string | string[]
      errors?: string[]
    }
  }
  code?: string
  message?: string
}

export function parseApiError(error: unknown): string {
  if (error === null || error === undefined) {
    return 'Something went wrong. Please try again.'
  }

  const err = error as AxiosLike

  // Network error — no response received
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
    return 'No internet connection. Please check your network.'
  }

  // Timeout
  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return 'Request timed out. Please try again.'
  }

  // Server returned an error response
  if (err.response?.data) {
    const data = err.response.data

    if (typeof data.message === 'string') return data.message

    if (Array.isArray(data.message)) return data.message[0] ?? 'Something went wrong.'

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors[0] ?? 'Something went wrong.'
    }
  }

  return 'Something went wrong. Please try again.'
}
