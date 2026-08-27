import { format, formatDistanceToNow, isToday as fnsIsToday, isYesterday } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

const DEFAULT_TIMEZONE = 'Africa/Lagos'

export function formatDate(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(d, timezone, 'dd MMM yyyy, h:mm a')
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (fnsIsToday(d)) {
    return `Today at ${format(d, 'h:mm a')}`
  }
  if (isYesterday(d)) {
    return `Yesterday at ${format(d, 'h:mm a')}`
  }

  return formatDistanceToNow(d, { addSuffix: true })
}

export function isToday(date: Date): boolean {
  return fnsIsToday(date)
}

export interface RestaurantHoursDay {
  open: string // 'HH:mm' format
  close: string // 'HH:mm' format
  isOpen: boolean
}

export interface RestaurantHours {
  monday: RestaurantHoursDay
  tuesday: RestaurantHoursDay
  wednesday: RestaurantHoursDay
  thursday: RestaurantHoursDay
  friday: RestaurantHoursDay
  saturday: RestaurantHoursDay
  sunday: RestaurantHoursDay
}

// Sprint 12 (S12-10): date-specific override on top of the weekly schedule.
// `date` is a local calendar day in `YYYY-MM-DD` format (interpreted in the
// restaurant's timezone). If `isClosed` is true, `open`/`close` are ignored
// and the day is treated as closed. Otherwise `open`/`close` in HH:mm replace
// that weekday's normal hours entirely — no merging, no unioning.
export interface SpecialHoursDay {
  date:      string  // 'YYYY-MM-DD'
  isClosed:  boolean
  // null is accepted because Mongo stores unset optional fields as null; the
  // helper coerces null/undefined identically.
  open?:     string | null   // 'HH:mm' (only used when !isClosed)
  close?:    string | null   // 'HH:mm' (only used when !isClosed)
  note?:     string | null   // Free-text shown to customer, e.g. "Independence Day"
}

export type RestaurantSpecialHours = SpecialHoursDay[]

// Look up the SpecialHoursDay matching `at` in the given timezone. Returns null
// when there's no override for today. Callers can reuse the result to display a
// banner on the customer restaurant page.
export function findSpecialHoursForDay(
  specialHours: RestaurantSpecialHours | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  at: Date = new Date(),
): SpecialHoursDay | null {
  if (!specialHours || specialHours.length === 0) return null
  const todayLocal = formatInTimeZone(at, timezone, 'yyyy-MM-dd')
  return specialHours.find((s) => s.date === todayLocal) ?? null
}

export function isRestaurantOpen(
  openingHours: RestaurantHours,
  timezone: string = DEFAULT_TIMEZONE,
  at: Date = new Date(),
  specialHours?: RestaurantSpecialHours,
): boolean {
  const currentTime = formatInTimeZone(at, timezone, 'HH:mm')

  // Sprint 12 (S12-10): date override wins over the weekly schedule. If today
  // has a special-hours entry we evaluate against that and ignore the weekday.
  const override = findSpecialHoursForDay(specialHours, timezone, at)
  if (override) {
    if (override.isClosed) return false
    if (!override.open || !override.close) return false
    return currentTime >= override.open && currentTime <= override.close
  }

  // Use formatInTimeZone for both day and time to handle UTC-midnight boundary correctly.
  const dayName = formatInTimeZone(at, timezone, 'EEEE').toLowerCase() as keyof RestaurantHours
  const todayHours = openingHours[dayName]

  if (!todayHours?.isOpen) return false

  return currentTime >= todayHours.open && currentTime <= todayHours.close
}
