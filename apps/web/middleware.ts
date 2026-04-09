import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'pc_session_present';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/vitrina',
  '/market-news',
  '/demo',
  '/enter',
  '/canon/roles',
]);

const PUBLIC_PREFIXES = [
  '/api/auth/demo',
  '/api/auth/',
  '/api/runtime-',
  '/_next/',
  '/favicon',
  '/sw.js',
  '/manifest',
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isValidSession(value: unknown): value is { role: string; exp: number } {
  if (!value || typeof value !== 'object') return false;
  const session = value as { role?: unknown; exp?: unknown };
  return typeof session.role === 'string' && typeof session.exp === 'number';
}

function parseSession(raw: string | undefined): { role: string; exp: number } | null {
  if (!raw) return null;

  const candidates = [raw];

  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) {
      candidates.push(decoded);
    }
  } catch {
    // ignore malformed percent-encoding
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isValidSession(parsed)) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = parseSession(raw);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, message: 'unauthenticated' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

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

  const response = NextResponse.next();
  response.headers.set('x-pc-role', session.role);
  response.headers.set('x-pc-authenticated', 'true');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
