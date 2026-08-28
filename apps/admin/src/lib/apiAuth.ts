// Server-side auth + rate-limit helpers for the admin app's Next.js API routes
// (currently the Google Maps proxies).
//
// Why this exists: the /api/geocode/reverse and /api/places routes proxy to
// Google Maps using our billed API key. Before this file, they were world-open
// — anyone could hit admin.grandxl.ng/api/geocode/reverse?lat=... on repeat and
// burn our monthly Google budget. Auth-guard + IP rate-limit closes that.
//
// Session validation strategy: the admin domain can't read the API's httpOnly
// refresh cookie (different origin), so middleware.ts intentionally punts auth
// to per-page hooks. For server-side route handlers we do it manually here:
// forward the client's Bearer access token to the API's /users/me endpoint. If
// it validates there, it's valid here. Results cached 10s so a busy MapPicker
// doesn't call /users/me every 500ms — short enough that a logged-out session
// is denied access within 10s at the outside.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL

// ── Session validation ──────────────────────────────────────────────
// Cache: token → { expiresAt } for successful validations. Failure isn't
// cached — a refreshed token needs to pass through on the next attempt.
// TTL kept short (10s) so a revoked token can't buy long-lived access; we
// still coalesce the reverse-geocode burst that happens as the user drags
// the map (fires every 500ms), which was the reason for caching at all.
const sessionCache = new Map<string, { expiresAt: number }>()
const SESSION_CACHE_TTL_MS = 10_000
const SESSION_CACHE_MAX = 200

function extractBearer(request: NextRequest): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

// Returns the token if valid, or a NextResponse(401) to short-circuit the route.
export async function requireAdminSession(
  request: NextRequest,
): Promise<{ ok: true; token: string } | { ok: false; response: NextResponse }> {
  const token = extractBearer(request)
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const cached = sessionCache.get(token)
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, token }
  }

  if (!API_URL) {
    // No API configured — fail closed rather than allowing unverified requests.
    return {
      ok: false,
      response: NextResponse.json({ error: 'Auth service not configured' }, { status: 503 }),
    }
  }

  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.status !== 200) {
      return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }
    sessionCache.set(token, { expiresAt: Date.now() + SESSION_CACHE_TTL_MS })
    // Hard cap the cache so a rotating-token flood can't balloon it. Prune
    // expired entries first; if still over cap, evict the soonest-to-expire
    // entries until we're back under the ceiling. Approx-LRU by expiry —
    // exact LRU isn't worth the bookkeeping at this scale.
    if (sessionCache.size > SESSION_CACHE_MAX) {
      const now = Date.now()
      for (const [k, v] of sessionCache) if (v.expiresAt <= now) sessionCache.delete(k)
      if (sessionCache.size > SESSION_CACHE_MAX) {
        const sorted = [...sessionCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)
        const overflow = sessionCache.size - SESSION_CACHE_MAX
        for (let i = 0; i < overflow; i++) sessionCache.delete(sorted[i]![0])
      }
    }
    return { ok: true, token }
  } catch {
    // API unreachable — fail closed. A hiccup here is preferable to leaking the
    // Google key to whoever's poking the endpoint during an outage.
    return { ok: false, response: NextResponse.json({ error: 'Auth check failed' }, { status: 503 }) }
  }
}

// ── IP rate limit ───────────────────────────────────────────────────
// Simple in-memory sliding window. Keyed by IP + bucket-name so different
// endpoints get independent budgets. In-process only — for a single-VPS deploy
// this is fine; if we ever scale horizontally, swap for Redis.

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function clientIp(request: NextRequest): string {
  // x-forwarded-for is a chain: `<client>, <hop1>, <hop2>, <our-nginx-added>`.
  // The LEFTMOST value is client-supplied and spoofable (attacker sets
  // `X-Forwarded-For: 1.2.3.4` in their request; our nginx appends the real
  // IP on the right). Take the rightmost value — the one our reverse proxy
  // put there — so an attacker can't fabricate per-request IPs to bypass the
  // rate limit by simply varying that header.
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',')
    return parts[parts.length - 1]!.trim()
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

// Returns null on allow, or a NextResponse(429) on block.
export function rateLimitByIp(
  request: NextRequest,
  bucketName: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const ip  = clientIp(request)
  const key = `${bucketName}:${ip}`
  const now = Date.now()

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  if (existing.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  existing.count += 1

  // Cheap pruning — evict expired buckets when the map grows large.
  if (buckets.size > 1000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }

  return null
}
