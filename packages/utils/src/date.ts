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

export function isRestaurantOpen(
  openingHours: RestaurantHours,
  timezone: string = DEFAULT_TIMEZONE,
): boolean {
  const now = new Date()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = dayNames[now.getDay()] as keyof RestaurantHours
  const todayHours = openingHours[dayName]

  if (!todayHours.isOpen) return false

  const currentTime = formatInTimeZone(now, timezone, 'HH:mm')
  return currentTime >= todayHours.open && currentTime <= todayHours.close
}
