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
const PLATFORM_V7_ENTRY_COOKIE = 'pc_v7_entry_seen';
const PRIVATE_REALM = 'Prozrachnaya Cena Private';

const PLATFORM_V7_PUBLIC_EXACT = new Set([
  '/platform-v7',
  '/platform-v7/roles',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
]);

const PLATFORM_V7_PUBLIC_PREFIX = ['/platform-v7/role-preview'];

const ROLE_HOME: Record<string, string> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
};

function isPrivateMode(): boolean {
  return process.env.PC_PRIVATE_MODE === 'on';
}

function isPublicAsset(p: string): boolean {
  return PUBLIC_PREFIX.some((x) => p.startsWith(x));
}

function isPublic(p: string): boolean {
  return PUBLIC_EXACT.has(p) || isPublicAsset(p);
}

function isPlatformV7PublicPath(p: string): boolean {
  return PLATFORM_V7_PUBLIC_EXACT.has(p) || PLATFORM_V7_PUBLIC_PREFIX.some((x) => p.startsWith(x));
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
  if (sessionRole && VALID_ROLES.has(sessionRole)) return sessionRole;
  const cookieRole = req.cookies.get('pc-role')?.value;
  if (cookieRole && VALID_ROLES.has(cookieRole)) return cookieRole;
  return 'operator';
}

function withRoleHeaders(req: NextRequest, role: string, protectedResponse = false) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pc-role', role);
  requestHeaders.set('x-pc-pathname', req.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-pc-role', role);
  response.headers.set('x-pc-pathname', req.nextUrl.pathname);
  return applySecurityHeaders(response, protectedResponse);
}

function persistRoleCookie(req: NextRequest, response: NextResponse, role: string) {
  if (req.cookies.get('pc-role')?.value !== role) {
    response.cookies.set('pc-role', role, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      secure: true,
    });
  }
}

function markPlatformV7Entry(response: NextResponse) {
  response.cookies.set(PLATFORM_V7_ENTRY_COOKIE, 'true', {
    path: '/',
    maxAge: 60 * 60 * 4,
    sameSite: 'lax',
    secure: true,
  });
}

function redirectToPlatformV7Entry(req: NextRequest) {
  const u = req.nextUrl.clone();
  u.pathname = '/platform-v7';
  u.search = '';
  return applySecurityHeaders(NextResponse.redirect(u), true);
}

function redirectToOwnPlatformV7Cabinet(req: NextRequest, role: string) {
  const u = req.nextUrl.clone();
  u.pathname = ROLE_HOME[role] || ROLE_HOME.operator;
  u.search = '';
  return applySecurityHeaders(NextResponse.redirect(u), true);
}

function routeStarts(p: string, prefix: string) {
  return p === prefix || p.startsWith(prefix + '/');
}

function canAccessPlatformV7Path(p: string, role: string): boolean {
  if (role === 'operator') return true;
  if (role === 'executive' && (routeStarts(p, '/platform-v7/executive') || routeStarts(p, '/platform-v7/control-tower') || routeStarts(p, '/platform-v7/bank'))) return true;
  if (role === 'bank' && (routeStarts(p, '/platform-v7/bank') || routeStarts(p, '/platform-v7/deals') || routeStarts(p, '/platform-v7/disputes'))) return true;
  if (role === 'buyer' && (routeStarts(p, '/platform-v7/buyer') || routeStarts(p, '/platform-v7/procurement') || routeStarts(p, '/platform-v7/deals') || routeStarts(p, '/platform-v7/lots'))) return true;
  if (role === 'seller' && (routeStarts(p, '/platform-v7/seller') || routeStarts(p, '/platform-v7/lots') || routeStarts(p, '/platform-v7/deals'))) return true;
  if (role === 'logistics' && (routeStarts(p, '/platform-v7/logistics') || routeStarts(p, '/platform-v7/deals'))) return true;
  if (role === 'driver' && (routeStarts(p, '/platform-v7/driver') || routeStarts(p, '/platform-v7/deals/DL-9103'))) return true;
  if (role === 'surveyor' && (routeStarts(p, '/platform-v7/surveyor') || routeStarts(p, '/platform-v7/disputes'))) return true;
  if (role === 'elevator' && (routeStarts(p, '/platform-v7/elevator') || routeStarts(p, '/platform-v7/deals'))) return true;
  if (role === 'lab' && (routeStarts(p, '/platform-v7/lab') || routeStarts(p, '/platform-v7/deals'))) return true;
  if (role === 'arbitrator' && (routeStarts(p, '/platform-v7/arbitrator') || routeStarts(p, '/platform-v7/disputes'))) return true;
  if (role === 'compliance' && (routeStarts(p, '/platform-v7/compliance') || routeStarts(p, '/platform-v7/connectors') || routeStarts(p, '/platform-v7/deals'))) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

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

  if (p.startsWith('/platform-v7')) {
    const isEntry = p === '/platform-v7';
    const seenEntry = req.cookies.get(PLATFORM_V7_ENTRY_COOKIE)?.value === 'true';

    if (p === '/platform-v7/ai' || p.startsWith('/platform-v7/ai/')) {
      return redirectToOwnPlatformV7Cabinet(req, resolvedRole);
    }

    if (!isEntry && !isPlatformV7PublicPath(p) && !seenEntry) {
      return redirectToPlatformV7Entry(req);
    }

    if (!isEntry && !isPlatformV7PublicPath(p) && !canAccessPlatformV7Path(p, resolvedRole)) {
      return redirectToOwnPlatformV7Cabinet(req, resolvedRole);
    }

    const response = withRoleHeaders(req, resolvedRole, privateModeEnabled && protectedPath);
    persistRoleCookie(req, response, resolvedRole);
    if (isEntry) markPlatformV7Entry(response);
    return response;
  }

  if (isPublic(p) || p.startsWith('/api/auth/') || p.startsWith('/api/runtime-')) {
    const response = withRoleHeaders(req, resolvedRole, privateModeEnabled && protectedPath);
    persistRoleCookie(req, response, resolvedRole);
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

export const config = { matcher: ['/((?!_next/static|_next/image|favicon\.ico).*)'] };
