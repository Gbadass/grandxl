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

// Extract a human-readable error message from an Axios / fetch failure.
//
// Priority (best → worst):
//   1. Network error — no response ever came back → helpful diagnostic
//   2. Timeout — request never completed → helpful diagnostic
//   3. Server responded with a message (string or class-validator array)
//   4. Server responded with an `errors` array (custom shape)
//   5. Caller-supplied `fallback` — context-specific ("Failed to assign rider")
//   6. Generic "Something went wrong" if the caller passed nothing
//
// The `fallback` ONLY replaces step 6 — network/timeout/server-message
// diagnostics are ALWAYS surfaced to the user because they carry more info
// than any static string a caller could invent.
export function parseApiError(error: unknown, fallback?: string): string {
  const generic = fallback ?? 'Something went wrong. Please try again.'

  if (error === null || error === undefined) {
    return generic
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

    if (Array.isArray(data.message)) return data.message[0] ?? generic

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors[0] ?? generic
    }
  }

  return generic
}
