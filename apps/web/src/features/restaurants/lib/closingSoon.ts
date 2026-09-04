import type { OpeningHours, SpecialHoursEntry } from '@grandxl/types'

// S14-8: Compute minutes until a restaurant closes today, given its weekly
// openingHours + optional specialHours overrides. Returns null when:
//   - restaurant has no hours for today
//   - restaurant is closed today (per weekly OR override)
//   - current time is BEFORE opening (kitchen isn't open yet — not "closing soon")
//   - current time is AFTER close (already closed)
//
// Otherwise returns a positive integer number of minutes until close. Consumers
// then decide their own threshold ("< 30 → show warning"). Purely functional
// so it's easy to test and re-use from server-side callers too.

const DAY_KEYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const

function hhmmToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function todaysDateIso(now: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function minutesUntilClose(
  openingHours: OpeningHours | undefined,
  specialHours: SpecialHoursEntry[] | undefined,
  now: Date = new Date(),
): number | null {
  if (!openingHours) return null

  // Special-hours override wins for the current date.
  const iso = todaysDateIso(now)
  const special = specialHours?.find((s) => s.date === iso)
  if (special?.isClosed) return null

  const dayKey = DAY_KEYS[now.getDay()]!
  const dayHours = openingHours[dayKey]

  const openMin  = special?.open  ? hhmmToMinutes(special.open)  : (dayHours?.isOpen ? hhmmToMinutes(dayHours.open)  : null)
  const closeMin = special?.close ? hhmmToMinutes(special.close) : (dayHours?.isOpen ? hhmmToMinutes(dayHours.close) : null)

  if (openMin == null || closeMin == null) return null

  const nowMin = now.getHours() * 60 + now.getMinutes()

  // Overnight windows (e.g. 18:00–02:00): close is technically tomorrow.
  if (closeMin < openMin) {
    // If we're in the pre-midnight leg (>= open), close is at close + 24h
    if (nowMin >= openMin) {
      const minutesLeft = (closeMin + 24 * 60) - nowMin
      return minutesLeft > 0 ? minutesLeft : null
    }
    // If we're in the post-midnight leg (< close), close is later today
    if (nowMin <= closeMin) {
      return closeMin - nowMin
    }
    return null // between close and open — restaurant is closed
  }

  // Normal same-day window
  if (nowMin < openMin) return null       // not open yet
  if (nowMin >= closeMin) return null     // already closed
  return closeMin - nowMin
}
