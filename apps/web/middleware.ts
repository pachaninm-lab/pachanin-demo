import { NextRequest, NextResponse } from 'next/server';
import { LOCALE_COOKIE } from '@/i18n/locale';
import { observeServerCabinetAccess, serverCabinetRbacMode } from '@/lib/platform-v7/server-cabinet-access';
import { readVerifiedCabinetRole, readVerifiedCabinetSessionRole } from '@/lib/platform-v7/verified-session';

// The verified-JWT role is the ONLY server-trusted identity for cabinet RBAC observation.
// Prefer the dedicated platform-v7 cabinet session (pc_v7_cabinet, `cab` claim); fall back
// to a real API JWT in pc_access_token (real-backend logins). Never path/pc-role/query.
const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';
const ACCESS_TOKEN_COOKIE = 'pc_access_token';

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

const VALID_LOCALES = new Set(['ru', 'en', 'zh']);
const SESSION_COOKIE = 'pc_session_present';
const OWNER_COOKIE = 'pc_owner_access';
const PLATFORM_V7_ENTRY_COOKIE = 'pc_v7_entry_seen';
const PRIVATE_REALM = 'Prozrachnaya Cena Private';

const PLATFORM_V7_PUBLIC_EXACT = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
]);

const PLATFORM_V7_PUBLIC_PREFIX = ['/platform-v7/role-preview'];

const PUBLIC_API_EXACT = new Set([
  '/api/platform-v7/inquiries',
  '/api/platform-v7/leads',
]);

function isPrivateMode(): boolean {
  return process.env.PC_PRIVATE_MODE === 'on';
}

function isPublicAsset(p: string): boolean {
  return PUBLIC_PREFIX.some((x) => p.startsWith(x));
}

function isPublic(p: string): boolean {
  return PUBLIC_EXACT.has(p) || isPublicAsset(p);
}

// These handlers authenticate their own Bearer token and fail closed. Middleware must
// not redirect server-to-server requests before the handler can verify that token.
function isTokenAuthenticatedInternalPath(p: string): boolean {
  return p === '/auth/me' || p.startsWith('/staff/');
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

function applySecurityHeaders(response: NextResponse, protectedResponse = false, indexable = false) {
  response.headers.set(
    'x-robots-tag',
    indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive, nosnippet, noimageindex'
  );
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'no-referrer');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()');
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

function resolvePlatformV7PathRole(pathname: string): string | null {
  if (pathname.startsWith('/platform-v7/driver')) return 'driver';
  if (pathname.startsWith('/platform-v7/surveyor')) return 'surveyor';
  if (pathname.startsWith('/platform-v7/elevator')) return 'elevator';
  if (pathname.startsWith('/platform-v7/lab')) return 'lab';
  if (pathname.startsWith('/platform-v7/bank')) return 'bank';
  if (pathname.startsWith('/platform-v7/arbitrator') || pathname.startsWith('/platform-v7/disputes')) return 'arbitrator';
  if (pathname.startsWith('/platform-v7/compliance') || pathname.startsWith('/platform-v7/connectors')) return 'compliance';
  if (pathname.startsWith('/platform-v7/buyer') || pathname.startsWith('/platform-v7/procurement')) return 'buyer';
  if (pathname.startsWith('/platform-v7/seller') || pathname.startsWith('/platform-v7/lots')) return 'seller';
  if (pathname.startsWith('/platform-v7/logistics')) return 'logistics';
  if (pathname.startsWith('/platform-v7/executive') || pathname.startsWith('/platform-v7/analytics')) return 'executive';
  if (pathname.startsWith('/platform-v7/control-tower') || pathname.startsWith('/platform-v7/operator')) return 'operator';
  return null;
}

function resolveRole(req: NextRequest, sessionRole?: string | null) {
  const pathRole = resolvePlatformV7PathRole(req.nextUrl.pathname);
  if (pathRole && VALID_ROLES.has(pathRole)) return pathRole;
  if (sessionRole && VALID_ROLES.has(sessionRole)) return sessionRole;
  const cookieRole = req.cookies.get('pc-role')?.value;
  if (cookieRole && VALID_ROLES.has(cookieRole)) return cookieRole;
  const queryRole = req.nextUrl.searchParams.get('as');
  if (queryRole && VALID_ROLES.has(queryRole)) return queryRole;
  return 'operator';
}

function resolveLocaleFromQuery(req: NextRequest): string | null {
  const queryLocale = req.nextUrl.searchParams.get('lang');
  return queryLocale && VALID_LOCALES.has(queryLocale) ? queryLocale : null;
}

function withRoleHeaders(req: NextRequest, role: string, protectedResponse = false, indexable = false) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pc-role', role);
  requestHeaders.set('x-pc-pathname', req.nextUrl.pathname);
  const queryLocale = resolveLocaleFromQuery(req);
  if (queryLocale) requestHeaders.set('x-pc-locale', queryLocale);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-pc-role', role);
  response.headers.set('x-pc-pathname', req.nextUrl.pathname);
  if (queryLocale) persistLocaleCookie(req, response, queryLocale);
  return applySecurityHeaders(response, protectedResponse || Boolean(queryLocale), indexable);
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

function persistLocaleCookie(req: NextRequest, response: NextResponse, locale: string) {
  if (!VALID_LOCALES.has(locale)) return;
  if (req.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: true,
    });
  }
  response.headers.set('x-pc-locale', locale);
  response.headers.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('pragma', 'no-cache');
  response.headers.set('expires', '0');
}

function markPlatformV7Entry(response: NextResponse) {
  response.cookies.set(PLATFORM_V7_ENTRY_COOKIE, 'true', {
    path: '/',
    maxAge: 60 * 60 * 4,
    sameSite: 'lax',
    secure: true,
  });
}

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  const canonRedirect = CANON_REDIRECTS[p];
  if (canonRedirect) {
    const u = req.nextUrl.clone();
    u.pathname = canonRedirect;
    return applySecurityHeaders(NextResponse.redirect(u, 308), true);
  }

  if (p === '/platform-v7/ai') {
    const u = req.nextUrl.clone();
    u.pathname = '/platform-v7/assistant';
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
    const response = withRoleHeaders(req, resolvedRole, privateModeEnabled && protectedPath, isEntry && !privateModeEnabled);
    persistRoleCookie(req, response, resolvedRole);
    if (isEntry) markPlatformV7Entry(response);
    try {
      if (serverCabinetRbacMode() === 'report') {
        const secret = process.env.JWT_SECRET ?? '';
        const nowSeconds = Math.floor(Date.now() / 1000);
        const verifiedRole =
          (await readVerifiedCabinetSessionRole(req.cookies.get(CABINET_SESSION_COOKIE)?.value ?? null, secret, nowSeconds))
          ?? (await readVerifiedCabinetRole(req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null, secret, nowSeconds));
        observeServerCabinetAccess({ pathname: p, verifiedRole });
      }
    } catch {
    }
    return response;
  }

  if (
    isPublic(p)
    || PUBLIC_API_EXACT.has(p)
    || p.startsWith('/api/auth/')
    || p.startsWith('/api/runtime-')
    || isTokenAuthenticatedInternalPath(p)
  ) {
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
