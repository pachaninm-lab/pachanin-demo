import { NextRequest, NextResponse } from 'next/server';

// Public paths — no session required
const PUBLIC_EXACT = new Set(['/', '/login', '/register']);
const PUBLIC_PREFIX = ['/platform-v7/', '/api/auth/', '/api/runtime-', '/_next/', '/favicon', '/sw.js', '/manifest', '/mockServiceWorker.js'];

function isPublic(p: string): boolean {
  return PUBLIC_EXACT.has(p) || PUBLIC_PREFIX.some(x => p.startsWith(x));
}

const SESSION_COOKIE = 'pc_session_present';

function parseSession(raw: string | undefined): { role: string; exp: number } | null {
  if (!raw) return null;
  const candidates = [raw];
  try { const d = decodeURIComponent(raw); if (d !== raw) candidates.push(d); } catch {}
  for (const s of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = JSON.parse(s) as any;
      if (p && typeof p.role === 'string' && typeof p.exp === 'number') return p;
    } catch {}
  }
  return null;
}

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // All platform-v7 and static paths are public (MSW demo mode)
  if (isPublic(p) || p.startsWith('/platform-v7')) return NextResponse.next();

  // For protected API routes, require session
  const session = parseSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (p.startsWith('/api/')) {
      return NextResponse.json({ ok: false, message: 'unauthenticated' }, { status: 401 });
    }
    const u = req.nextUrl.clone();
    u.pathname = '/platform-v7/control-tower';
    return NextResponse.redirect(u);
  }

  const r = NextResponse.next();
  r.headers.set('x-pc-role', session.role);
  return r;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'] };
