import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_EXACT = new Set(['/', '/login', '/register']);
const PUBLIC_PREFIX = [
  '/_next/',
  '/favicon',
  '/apple-icon',
  '/icon',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest',
  '/sw.js',
  '/mockServiceWorker.js',
];

const CANON_REDIRECTS: Record<string, string> = {
  '/canon/roles': '/platform-v7/roles',
  '/platform-v4/roles': '/platform-v7/roles',
  '/canon/deals': '/platform-v7/deals',
  '/canon/deals/detail': '/platform-v7/deals',
  '/canon/documents': '/platform-v7/docs',
  '/canon/documents/detail': '/platform-v7/docs',
  '/canon/finance': '/platform-v7/bank',
  '/canon/finance/detail': '/platform-v7/bank',
  '/canon/control': '/platform-v7/control-tower',
  '/canon/control/detail': '/platform-v7/control-tower',
  '/canon/admin': '/platform-v7/roles',
};

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

const SESSION_COOKIE = 'pc_session_present';
const OWNER_COOKIE = 'pc_owner_access';
const PRIVATE_REALM = 'Prozrachnaya Cena Private';

function isPrivateMode(): boolean {
  return process.env.PC_PRIVATE_MODE === 'on';
}

function isPublicAsset(p: string): boolean {
  return PUBLIC_PREFIX.some((x) => p.startsWith(x));
}

function isPublic(p: string): boolean {
  return PUBLIC_EXACT.has(p) || isPublicAsset(p);
}

function isProtectedPath(p: string): boolean {
  if (isPublicAsset(p)) return false;
  return true;
}

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    diff |= a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length);
  }
  return diff === 0;
}

function parseBasicAuth(header: string | null): { user: string; password: string } | null {
  if (!header || !header.toLowerCase().startsWith('basic ')) return null;
  try {
    const raw = atob(header.slice(6).trim());
    const sep = raw.indexOf(':');
    if (sep < 0) return null;
    return { user: raw.slice(0, sep), password: raw.slice(sep + 1) };
  } catch {
    return null;
  }
}

function hasPrivateCredentials(): boolean {
  return Boolean(readEnv('PC_PRIVATE_PASSWORD') || readEnv('PC_OWNER_KEY'));
}

function isOwnerAuthorized(req: NextRequest): boolean {
  const ownerKey = readEnv('PC_OWNER_KEY');
  const requestKey = req.headers.get('x-pc-owner-key') || req.cookies.get(OWNER_COOKIE)?.value || '';
  if (ownerKey && safeEqual(requestKey, ownerKey)) return true;

  const privatePassword = readEnv('PC_PRIVATE_PASSWORD');
  if (!privatePassword) return false;
  const privateUser = readEnv('PC_PRIVATE_USER') || 'owner';
  const basic = parseBasicAuth(req.headers.get('authorization'));
  if (!basic) return false;

  return safeEqual(basic.user, privateUser) && safeEqual(basic.password, privatePassword);
}

function applySecurityHeaders(response: NextResponse, protectedResponse = false) {
  response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'no-referrer');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=()');
  response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set(
    'content-security-policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  if (protectedResponse) {
    response.headers.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('pragma', 'no-cache');
    response.headers.set('expires', '0');
  }
  return response;
}

function privateLockedResponse() {
  const response = new NextResponse('Private deployment locked.', {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
  return applySecurityHeaders(response, true);
}

function privateUnauthorizedResponse() {
  const response = new NextResponse('Private access required.', {
    status: 401,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'www-authenticate': `Basic realm="${PRIVATE_REALM}", charset="UTF-8"`,
    },
  });
  return applySecurityHeaders(response, true);
}

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

function withRoleHeaders(req: NextRequest, role: string, protectedResponse = false) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pc-role', role);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-pc-role', role);
  return applySecurityHeaders(response, protectedResponse);
}

function redirectToAssistant(req: NextRequest) {
  const u = req.nextUrl.clone();
  u.pathname = '/platform-v7/assistant';
  return applySecurityHeaders(NextResponse.redirect(u, 308), true);
}

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  if (p === '/platform-v7/ai') {
    return redirectToAssistant(req);
  }

  const canonRedirect = CANON_REDIRECTS[p];
  if (canonRedirect) {
    const u = req.nextUrl.clone();
    u.pathname = canonRedirect;
    return applySecurityHeaders(NextResponse.redirect(u, 308), true);
  }

  if (p === '/platform-v7r' || p.startsWith('/platform-v7r/')) {
    const u = req.nextUrl.clone();
    u.pathname = p.replace('/platform-v7r', '/platform-v7');
    return applySecurityHeaders(NextResponse.redirect(u, 308), true);
  }

  const protectedPath = isProtectedPath(p);
  const privateModeEnabled = isPrivateMode();
  if (privateModeEnabled && protectedPath) {
    if (!hasPrivateCredentials()) {
      return privateLockedResponse();
    }
    if (!isOwnerAuthorized(req)) {
      return privateUnauthorizedResponse();
    }
  }

  const session = parseSession(req.cookies.get(SESSION_COOKIE)?.value);
  const resolvedRole = resolveRole(req, session?.role ?? null);

  if (isPublic(p) || p.startsWith('/platform-v7') || p.startsWith('/api/auth/') || p.startsWith('/api/runtime-')) {
    const response = withRoleHeaders(req, resolvedRole, privateModeEnabled && protectedPath);
    if (req.cookies.get('pc-role')?.value !== resolvedRole) {
      response.cookies.set('pc-role', resolvedRole, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
        secure: true,
      });
    }
    return response;
  }

  if (!session) {
    if (p.startsWith('/api/')) {
      return applySecurityHeaders(NextResponse.json({ ok: false, message: 'unauthenticated' }, { status: 401 }), privateModeEnabled);
    }
    const u = req.nextUrl.clone();
    u.pathname = '/platform-v7';
    return applySecurityHeaders(NextResponse.redirect(u), privateModeEnabled);
  }

  return withRoleHeaders(req, resolvedRole, privateModeEnabled && protectedPath);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'] };
