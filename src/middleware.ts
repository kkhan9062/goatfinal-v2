import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware runs on Next.js's Edge runtime, which can't use the Prisma
// client (needs full Node APIs / DB access), so this only does a cheap
// "is there a session cookie at all" check for redirect purposes. The real
// validation (hash lookup, expiry, active-user check) happens server-side
// per request via getCurrentUser() in lib/auth.ts, which runs in the normal
// Node.js runtime where Prisma works.
const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p) || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has('session');
  if (!hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
