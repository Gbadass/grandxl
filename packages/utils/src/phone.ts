const COUNTRY_FORMATS: Record<string, { prefix: string; localLength: number }> = {
  NG: { prefix: '+234', localLength: 11 },
  GH: { prefix: '+233', localLength: 10 },
  KE: { prefix: '+254', localLength: 10 },
}

export function formatPhone(e164: string): string {
  if (!e164) return e164

  // Nigeria: +2348012345678 → 0801 234 5678
  if (e164.startsWith('+234')) {
    const local = '0' + e164.slice(4)
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
  }

  // Ghana: +233201234567 → 020 123 4567
  if (e164.startsWith('+233')) {
    const local = '0' + e164.slice(4)
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  return e164
}

export function toE164(localPhone: string, countryCode: string): string {
  const format = COUNTRY_FORMATS[countryCode]
  if (!format) throw new Error(`Unsupported country code: ${countryCode}`)

  const cleaned = localPhone.replace(/\s/g, '')

  if (cleaned.startsWith('+')) return cleaned

  if (cleaned.startsWith('0') && cleaned.length === format.localLength) {
    return `${format.prefix}${cleaned.slice(1)}`
  }

  throw new Error(`Invalid phone number format for country ${countryCode}: ${localPhone}`)
}

export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone)
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '***'
  const countryPart = phone.startsWith('+234') ? '+234' : phone.slice(0, 4)
  const last4 = phone.slice(-4)
  return `${countryPart}***${last4}`
}
