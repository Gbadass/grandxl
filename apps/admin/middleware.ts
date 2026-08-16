import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Access tokens live in Zustand (memory) and refresh tokens are httpOnly cookies
// on the API domain (localhost:3001 in dev). Middleware can't read cross-origin
// cookies, so auth protection is handled entirely by per-page useEffect hooks.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
