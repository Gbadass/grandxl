export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id)
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***'
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***'
  const [local, domain] = email.split('@')
  const first = local.charAt(0)
  const masked = `${first}${'*'.repeat(Math.min(local.length - 1, 4))}`
  return `${masked}@${domain}`
}
