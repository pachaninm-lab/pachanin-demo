import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_EXACT = new Set(['/', '/login', '/register']);
const PUBLIC_PREFIX = [
  '/platform-v7/',
  '/api/auth/',
  '/api/runtime-',
  '/_next/',
  '/favicon',
  '/sw.js',
  '/manifest',
  '/mockServiceWorker.js',
];

const VALID_ROLES = new Set([
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
]);

function isPublic(p: string): boolean {
  return PUBLIC_EXACT.has(p) || PUBLIC_PREFIX.some((x) => p.startsWith(x));
}

const SESSION_COOKIE = 'pc_session_present';

function parseSession(raw: string | undefined): { role: string; exp: number } | null {
  if (!raw) return null;
  const candidates = [raw];
  try {
    const d = decodeURIComponent(raw);
    if (d !== raw) candidates.push(d);
  } catch {}
  for (const s of candidates) {
    try {
      const p = JSON.parse(s) as { role?: string; exp?: number };
      if (p && typeof p.role === 'string' && typeof p.exp === 'number') return { role: p.role, exp: p.exp };
    } catch {}
  }
  return null;
}

function resolveRole(req: NextRequest, sessionRole?: string | null) {
  const queryRole = req.nextUrl.searchParams.get('as');
  if (queryRole && VALID_ROLES.has(queryRole)) return queryRole;
  const cookieRole = req.cookies.get('pc-role')?.value;
  if (cookieRole && VALID_ROLES.has(cookieRole)) return cookieRole;
  if (sessionRole && VALID_ROLES.has(sessionRole)) return sessionRole;
  return 'operator';
}

function withRoleHeaders(req: NextRequest, role: string) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pc-role', role);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-pc-role', role);
  return response;
}

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  if (p === '/platform-v7r' || p.startsWith('/platform-v7r/')) {
    const u = req.nextUrl.clone();
    u.pathname = p.replace('/platform-v7r', '/platform-v7');
    return NextResponse.redirect(u, 308);
  }

  const session = parseSession(req.cookies.get(SESSION_COOKIE)?.value);
  const resolvedRole = resolveRole(req, session?.role ?? null);

  if (isPublic(p) || p.startsWith('/platform-v7')) {
    const response = withRoleHeaders(req, resolvedRole);
    if (req.cookies.get('pc-role')?.value !== resolvedRole) {
      response.cookies.set('pc-role', resolvedRole, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
    }
    return response;
  }

  if (!session) {
    if (p.startsWith('/api/')) {
      return NextResponse.json({ ok: false, message: 'unauthenticated' }, { status: 401 });
    }
    const u = req.nextUrl.clone();
    u.pathname = '/platform-v7';
    return NextResponse.redirect(u);
  }

  const r = withRoleHeaders(req, resolvedRole);
  return r;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'] };
