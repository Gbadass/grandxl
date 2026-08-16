// Driver PWA stores the refresh token in localStorage rather than relying on
// httpOnly cookies. Cookies on `localhost` are shared across all ports, so
// logging into the customer web app (localhost:5173) would overwrite the rider
// cookie and break the rider session on refresh. localStorage is port-isolated.
const KEY = 'gxl_rider_rt'

export function saveRiderToken(token: string): void {
  localStorage.setItem(KEY, token)
}

export function loadRiderToken(): string | null {
  return localStorage.getItem(KEY)
}

export function clearRiderToken(): void {
  localStorage.removeItem(KEY)
}
