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

  // Timeout — axios also uses ECONNABORTED for timeouts (caught by the
  // network check above); ETIMEDOUT is the Node-level equivalent. We used
  // to also match any error whose message contained "timeout", but that
  // false-positived on caller-thrown messages like `throw new Error('Payment
  // timeout — please retry')` — those should surface via the plain-Error
  // branch further down, not get replaced with our generic timeout string.
  if (err.code === 'ETIMEDOUT') {
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

  // Plain JS Error thrown from a `mutationFn` (client-side validation like
  // `throw new Error('Please verify your account first')`). The message IS
  // the intended user-facing text — surface it directly.
  //
  // Guarded by `!err.response`: we only trust `.message` when the error is
  // NOT an axios failure. Axios errors carry noisy default messages like
  // "Request failed with status code 500" that we don't want reaching users.
  if (error instanceof Error && error.message && !err.response) {
    return error.message
  }

  return generic
}
