import { NextRequest, NextResponse } from 'next/server';
import { observeServerCabinetAccess, serverCabinetRbacMode } from '@/lib/platform-v7/server-cabinet-access';
import { readVerifiedCabinetRole, readVerifiedCabinetSessionRole } from '@/lib/platform-v7/verified-session';

const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';
const ACCESS_TOKEN_COOKIE = 'pc_access_token';
const SESSION_COOKIE = 'pc_session_present';
const OWNER_COOKIE = 'pc_owner_access';
const ENTRY_COOKIE = 'pc_v7_entry_seen';
const CABINET_LOGIN_API = '/api/platform-v7/cabinet-lock-login';
const CABINET_SESSION_API = '/api/platform-v7/cabinet-session';
const INQUIRIES_API = '/api/platform-v7/inquiries';
const LEADS_API = '/api/platform-v7/leads';

const PUBLIC_ASSET_PREFIX = [
  '/_next/',
  '/favicon',
  '/apple-icon',
  '/icon',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest',
  '/sw.js',
  '/mockServiceWorker.js',
  '/indexnow.txt',
];

const SEARCH_INDEXABLE = new Set([
  '/',
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/docs',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/about',
  '/platform-v7/security',
  '/platform-v7/status',
  '/platform-v7/secure-grain-deal',
  '/platform-v7/grain-logistics',
  '/platform-v7/grain-quality',
  '/platform-v7/grain-documents',
  '/platform-v7/grain-payment',
  '/platform-v7/fgis-zerno',
  '/platform-v7/terms',
  '/platform-v7/privacy',
  '/platform-v7/oferta',
]);

const V7_PUBLIC = new Set([
  ...SEARCH_INDEXABLE,
  '/platform-v7/login',
  '/platform-v7/register',
]);

const PUBLIC_EXACT = new Set(['/', '/login', '/register']);
const V7_PUBLIC_PREFIX = ['/platform-v7/role-preview'];
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

function normalize(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/';
}

function env(name: string): string {
  return String(process.env[name] || '').trim();
}

function isAsset(pathname: string): boolean {
  return PUBLIC_ASSET_PREFIX.some((prefix) => pathname.startsWith(prefix));
}

function isV7Public(pathname: string): boolean {
  const path = normalize(pathname);
  return V7_PUBLIC.has(path) || V7_PUBLIC_PREFIX.some((prefix) => path.startsWith(prefix));
}

function isIndexable(pathname: string): boolean {
  return SEARCH_INDEXABLE.has(normalize(pathname));
}

function isCabinetAuth(pathname: string): boolean {
  const path = normalize(pathname);
  return path === CABINET_LOGIN_API || path === CABINET_SESSION_API || path === INQUIRIES_API || path === LEADS_API;
}

function isPublic(pathname: string): boolean {
  return PUBLIC_EXACT.has(normalize(pathname)) || isAsset(pathname);
}

function isProtected(pathname: string): boolean {
  if (isAsset(pathname) || isCabinetAuth(pathname) || isV7Public(pathname)) return false;
  return true;
}

function isCabinetLocked(pathname: string): boolean {
  if (isAsset(pathname) || isCabinetAuth(pathname)) return false;
  if (pathname.startsWith('/api/runtime-')) return true;
  if (pathname.startsWith('/api/platform-v7') || pathname.startsWith('/api/cabinet')) return true;
  if (!pathname.startsWith('/platform-v7')) return false;
  return !isV7Public(pathname);
}

function same(a: string, b: string): boolean {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) diff |= a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length);
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

function ownerAllowed(req: NextRequest): boolean {
  const ownerKey = env('PC_OWNER_KEY');
  const requestKey = req.headers.get('x-pc-owner-key') || req.cookies.get(OWNER_COOKIE)?.value || '';
  if (ownerKey && same(requestKey, ownerKey)) return true;

  const password = env('PC_PRIVATE_PASSWORD');
  if (!password) return false;
  const user = env('PC_PRIVATE_USER') || 'owner';
  const basic = parseBasicAuth(req.headers.get('authorization'));
  return Boolean(basic && same(basic.user, user) && same(basic.password, password));
}

function cabinetSecret(): string {
  return env('JWT_SECRET') || env('PC_CABINET_LOCK_PASSWORD');
}

async function cabinetAllowed(req: NextRequest): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const role = await readVerifiedCabinetSessionRole(req.cookies.get(CABINET_SESSION_COOKIE)?.value ?? null, cabinetSecret(), now);
  return Boolean(role);
}

function secure(response: NextResponse, noStore = false, indexable = false) {
  response.headers.set('x-robots-tag', indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'no-referrer');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=()');
  response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (noStore) {
    response.headers.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('pragma', 'no-cache');
    response.headers.set('expires', '0');
  }
  return response;
}

function textResponse(message: string, status: number) {
  return secure(new NextResponse(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } }), true);
}

function cabinetRequired(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith('/api/')) return secure(NextResponse.json({ ok: false, message: 'cabinet_access_required' }, { status: 401 }), true);
  const url = req.nextUrl.clone();
  url.pathname = '/platform-v7/login';
  url.search = '';
  const role = pathRole(pathname);
  if (role) url.searchParams.set('role', role);
  url.searchParams.set('next', `${pathname}${req.nextUrl.search || ''}`);
  return secure(NextResponse.redirect(url), true);
}

function parseSession(raw: string | undefined): { role: string; exp: number } | null {
  if (!raw) return null;
  for (const value of [raw, safeDecode(raw)]) {
    try {
      const parsed = JSON.parse(value) as { role?: string; exp?: number };
      if (typeof parsed.role === 'string' && typeof parsed.exp === 'number') return { role: parsed.role, exp: parsed.exp };
    } catch {}
  }
  return null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pathRole(pathname: string): string | null {
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
  const resolvedPathRole = pathRole(req.nextUrl.pathname);
  if (resolvedPathRole && VALID_ROLES.has(resolvedPathRole)) return resolvedPathRole;
  if (sessionRole && VALID_ROLES.has(sessionRole)) return sessionRole;
  const cookieRole = req.cookies.get('pc-role')?.value;
  if (cookieRole && VALID_ROLES.has(cookieRole)) return cookieRole;
  const queryRole = req.nextUrl.searchParams.get('as');
  if (queryRole && VALID_ROLES.has(queryRole)) return queryRole;
  return 'operator';
}

function withRole(req: NextRequest, role: string, noStore = false, indexable = false) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pc-role', role);
  requestHeaders.set('x-pc-pathname', req.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-pc-role', role);
  response.headers.set('x-pc-pathname', req.nextUrl.pathname);
  return secure(response, noStore, indexable);
}

function saveRole(req: NextRequest, response: NextResponse, role: string) {
  if (req.cookies.get('pc-role')?.value === role) return;
  response.cookies.set('pc-role', role, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', secure: true });
}

function markEntry(response: NextResponse) {
  response.cookies.set(ENTRY_COOKIE, 'true', { path: '/', maxAge: 60 * 60 * 4, sameSite: 'lax', secure: true });
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const canonRedirect = CANON_REDIRECTS[pathname];
  if (canonRedirect) {
    const url = req.nextUrl.clone();
    url.pathname = canonRedirect;
    return secure(NextResponse.redirect(url, 308), true);
  }

  if (pathname === '/platform-v7r' || pathname.startsWith('/platform-v7r/')) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace('/platform-v7r', '/platform-v7');
    return secure(NextResponse.redirect(url, 308), true);
  }

  const protectedPath = isProtected(pathname);
  const privateMode = env('PC_PRIVATE_MODE') === 'on';
  if (privateMode && protectedPath) {
    if (!(env('PC_PRIVATE_PASSWORD') || env('PC_OWNER_KEY'))) return textResponse('Access configuration error.', 503);
    if (!ownerAllowed(req)) return textResponse('Access required.', 401);
  }

  const cabinetMode = env('PC_CABINET_LOCK_MODE') === 'on';
  const cabinetPath = isCabinetLocked(pathname);
  const locked = (privateMode && protectedPath) || (cabinetMode && cabinetPath);
  if (cabinetMode && cabinetPath) {
    if (!env('PC_CABINET_LOCK_PASSWORD')) return textResponse('Access configuration error.', 503);
    if (!(await cabinetAllowed(req))) return cabinetRequired(req);
  }

  const session = parseSession(req.cookies.get(SESSION_COOKIE)?.value);
  const role = resolveRole(req, session?.role ?? null);

  if (pathname.startsWith('/platform-v7')) {
    const path = normalize(pathname);
    const isEntry = path === '/platform-v7';
    const seenEntry = req.cookies.get(ENTRY_COOKIE)?.value === 'true';
    if (!isEntry && !isV7Public(path) && !seenEntry) {
      const url = req.nextUrl.clone();
      url.pathname = '/platform-v7';
      url.search = '';
      return secure(NextResponse.redirect(url), true);
    }

    const response = withRole(req, role, locked, isIndexable(path) && !locked);
    saveRole(req, response, role);
    if (isEntry) markEntry(response);
    try {
      if (serverCabinetRbacMode() === 'report') {
        const now = Math.floor(Date.now() / 1000);
        const verifiedRole =
          (await readVerifiedCabinetSessionRole(req.cookies.get(CABINET_SESSION_COOKIE)?.value ?? null, cabinetSecret(), now))
          ?? (await readVerifiedCabinetRole(req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null, cabinetSecret(), now));
        observeServerCabinetAccess({ pathname, verifiedRole });
      }
    } catch {}
    return response;
  }

  if (!isPublic(pathname) && !req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return secure(NextResponse.redirect(url), true);
  }

  const response = secure(NextResponse.next(), locked, isIndexable(pathname) && !locked);
  saveRole(req, response, role);
  return response;
}

export const config = {
  matcher: ['/((?!api/health|_next/static|_next/image|favicon.ico).*)'],
};
