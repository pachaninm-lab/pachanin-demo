import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'pc_session_present';

// Routes accessible without authentication
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/vitrina',
  '/market-news',
  '/demo',
]);

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/runtime-',   // runtime demo endpoints
  '/_next/',
  '/favicon',
  '/sw.js',
  '/manifest',
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function parseSession(raw: string | undefined): { role: string; exp: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed.role !== 'string' || typeof parsed.exp !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public routes and static assets
  if (isPublic(pathname)) return NextResponse.next();

  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = parseSession(raw);

  // Not authenticated
  if (!session) {
    // API routes → 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, message: 'unauthenticated' }, { status: 401 });
    }
    // Page routes → redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

  // Session expired
  const nowUnix = Math.floor(Date.now() / 1000);
  if (session.exp < nowUnix) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, message: 'session_expired' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnTo', pathname);
    url.searchParams.set('reason', 'session_expired');
    return NextResponse.redirect(url);
  }

  // Authenticated — add role header for server components
  const response = NextResponse.next();
  response.headers.set('x-pc-role', session.role);
  response.headers.set('x-pc-authenticated', 'true');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static files.
     * See: https://nextjs.org/docs/app/building-your-application/routing/middleware
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
