import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, CSRF_COOKIE, SESSION_COOKIE, sessionMarkerCookie } from '@/lib/auth-cookies';
import { CABINET_SESSION_COOKIE } from '@/lib/server/auth-session-response';
import {
  controlledCabinetContext,
  type ControlledCabinetContext,
} from '@/lib/platform-v7/controlled-test-organizations';
import { signCabinetSession, verifyHs256Jwt } from '@/lib/platform-v7/verified-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const MAX_CONTROLLED_TTL_SECONDS = 8 * 60 * 60;
const MAX_API_OWNER_TTL_SECONDS = 60 * 60;

const OWNER_CABINETS = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver/field',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
} as const;

type OwnerCabinetRole = keyof typeof OWNER_CABINETS;
type OwnerAuthority = {
  actorId: string;
  email: string;
  ttlSeconds: number;
  source: 'controlled' | 'staff-api';
};
type AuthorityResult =
  | { status: 'authorized'; authority: OwnerAuthority }
  | { status: 'denied' }
  | { status: 'unavailable' };
type ParsedRequest = {
  role: unknown;
  organizationId: unknown;
  formSubmission: boolean;
  csrfOk: boolean;
};
type StaffIdentity = { id?: string; email?: string };
type StaffAssignment = { role?: string; status?: string };

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function controlledFixtureEnabled(): boolean {
  if (readEnv('PC_STAFF_TEST_FIXTURE').toLowerCase() !== 'true') return false;
  if (readEnv('PC_CABINET_TEST_ACCESS').toLowerCase() !== 'true') return false;
  const expiresAt = readEnv('PC_CABINET_TEST_ACCESS_EXPIRES_AT');
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function signingSecret(): string {
  return readEnv('JWT_SECRET') || readEnv('PC_CABINET_SESSION_SECRET');
}

function apiOrigin(): string {
  const configured = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (!configured) return '';
  try {
    const url = new URL(configured);
    if (
      process.env.NODE_ENV === 'production'
      && url.protocol !== 'https:'
      && process.env.PC_INTERNAL_API_ALLOW_HTTP !== 'true'
    ) return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function redirectBack(request: NextRequest, code: string) {
  const url = new URL('/platform-v7/staff', request.url);
  url.searchParams.set('cabinetError', code);
  return NextResponse.redirect(url, 303);
}

function isOwnerCabinetRole(value: unknown): value is OwnerCabinetRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(OWNER_CABINETS, value);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function firstForwardedValue(value: string | null): string {
  return String(value || '').split(',')[0]?.trim() || '';
}

function originFromHost(protocol: string, host: string): string | null {
  if (!host) return null;
  const normalizedProtocol = protocol === 'http:' || protocol === 'https:' ? protocol : 'https:';
  try {
    return new URL(`${normalizedProtocol}//${host}`).origin;
  } catch {
    return null;
  }
}

function requestOriginAllowed(request: NextRequest): boolean {
  const browserOrigin = request.headers.get('origin');
  if (!browserOrigin) return true;

  let normalizedBrowserOrigin = '';
  let requestUrl: URL | null = null;
  try {
    normalizedBrowserOrigin = new URL(browserOrigin).origin;
    requestUrl = new URL(request.url);
  } catch {
    return false;
  }

  const allowed = new Set<string>([requestUrl.origin]);
  const forwardedProtoRaw = firstForwardedValue(request.headers.get('x-forwarded-proto')).toLowerCase();
  const forwardedProtocol = forwardedProtoRaw === 'http' || forwardedProtoRaw === 'https'
    ? `${forwardedProtoRaw}:`
    : requestUrl.protocol;

  for (const host of [
    firstForwardedValue(request.headers.get('x-forwarded-host')),
    firstForwardedValue(request.headers.get('host')),
  ]) {
    const candidate = originFromHost(forwardedProtocol, host);
    if (candidate) allowed.add(candidate);
  }

  return allowed.has(normalizedBrowserOrigin);
}

function csrfTokenValid(request: NextRequest, token: unknown): boolean {
  if (!requestOriginAllowed(request) || typeof token !== 'string' || !token) return false;
  const cookieTokens = request.cookies.getAll(CSRF_COOKIE).map((cookie) => cookie.value).filter(Boolean);
  return cookieTokens.some((cookieToken) => constantTimeEqual(cookieToken, token));
}

async function parseRequest(request: NextRequest): Promise<ParsedRequest> {
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  const formSubmission = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
  if (formSubmission) {
    const form = await request.formData().catch(() => null);
    return {
      role: form?.get('role'),
      organizationId: form?.get('organizationId'),
      formSubmission: true,
      csrfOk: csrfTokenValid(request, form?.get('_csrf')),
    };
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  return {
    role: body.role,
    organizationId: body.organizationId,
    formSubmission: false,
    csrfOk: csrfTokenValid(request, request.headers.get('x-csrf-token')),
  };
}

async function controlledOwnerAuthority(accessToken: string, secret: string): Promise<AuthorityResult | null> {
  if (!controlledFixtureEnabled()) return null;
  const claims = await verifyHs256Jwt(accessToken, secret);
  if (!claims || claims.testAccess !== true) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenExpiry = typeof claims.exp === 'number' ? claims.exp : 0;
  if (
    claims.owner !== true
    || claims.tokenType !== 'access'
    || typeof claims.sub !== 'string'
    || typeof claims.email !== 'string'
    || tokenExpiry <= nowSeconds
  ) {
    return { status: 'denied' };
  }

  const ttlSeconds = Math.min(MAX_CONTROLLED_TTL_SECONDS, tokenExpiry - nowSeconds);
  if (ttlSeconds < 60) return { status: 'denied' };
  return {
    status: 'authorized',
    authority: {
      actorId: claims.sub,
      email: claims.email,
      ttlSeconds,
      source: 'controlled',
    },
  };
}

async function apiOwnerAuthority(accessToken: string, correlationId: string): Promise<AuthorityResult> {
  const origin = apiOrigin();
  if (!origin) return { status: 'unavailable' };

  try {
    const commonHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'x-correlation-id': correlationId,
    };
    const [identityResponse, assignmentsResponse] = await Promise.all([
      fetch(`${origin}/auth/me`, {
        headers: commonHeaders,
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
      }),
      fetch(`${origin}/staff/assignments/me`, {
        headers: commonHeaders,
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
      }),
    ]);

    if ([identityResponse.status, assignmentsResponse.status].some((status) => status === 401 || status === 403)) {
      return { status: 'denied' };
    }
    if (!identityResponse.ok || !assignmentsResponse.ok) return { status: 'unavailable' };

    const identity = await identityResponse.json().catch(() => null) as StaffIdentity | null;
    const assignments = await assignmentsResponse.json().catch(() => null) as StaffAssignment[] | null;
    const activeOwner = Array.isArray(assignments)
      && assignments.some((item) => item.role === 'PLATFORM_OWNER' && item.status === 'ACTIVE');

    if (!identity || typeof identity.id !== 'string' || typeof identity.email !== 'string' || !activeOwner) {
      return { status: 'denied' };
    }

    return {
      status: 'authorized',
      authority: {
        actorId: identity.id,
        email: identity.email,
        ttlSeconds: MAX_API_OWNER_TTL_SECONDS,
        source: 'staff-api',
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

async function resolveOwnerAuthority(accessToken: string, secret: string, correlationId: string): Promise<AuthorityResult> {
  const controlled = await controlledOwnerAuthority(accessToken, secret);
  return controlled || apiOwnerAuthority(accessToken, correlationId);
}

function resolveControlledOrganization(
  role: OwnerCabinetRole,
  submittedOrganizationId: unknown,
  authority: OwnerAuthority,
): ControlledCabinetContext | null | 'invalid' {
  if (authority.source !== 'controlled') return null;
  const context = controlledCabinetContext(role);
  if (!context) return 'invalid';
  if (typeof submittedOrganizationId !== 'string' || submittedOrganizationId !== context.organizationId) {
    return 'invalid';
  }
  return context;
}

function setCabinetCookies(
  response: NextResponse,
  cabinetToken: string,
  role: OwnerCabinetRole,
  authority: OwnerAuthority,
  expiresAt: number,
  organization: ControlledCabinetContext | null,
) {
  response.cookies.set(CABINET_SESSION_COOKIE, cabinetToken, {
    path: '/',
    maxAge: authority.ttlSeconds,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    priority: 'high',
  });
  response.cookies.set(
    SESSION_COOKIE,
    encodeURIComponent(JSON.stringify({
      role,
      exp: expiresAt,
      email: authority.email,
      organizationId: organization?.organizationId || null,
      tenantId: organization?.tenantId || null,
      ownerAccess: true,
    })),
    { ...sessionMarkerCookie(), maxAge: authority.ttlSeconds, priority: 'high' },
  );
  response.cookies.set('pc-role', role, {
    path: '/',
    maxAge: authority.ttlSeconds,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();
  const parsed = await parseRequest(request);
  const fail = (code: string, message: string, status: number) => parsed.formSubmission
    ? redirectBack(request, code)
    : json({ ok: false, code, message, correlationId }, status);

  if (!parsed.csrfOk) return fail('CSRF_REJECTED', 'Сессия формы устарела. Обнови страницу.', 403);
  if (!isOwnerCabinetRole(parsed.role)) return fail('INVALID_CABINET_ROLE', 'Неизвестный кабинет.', 400);

  const secret = signingSecret();
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
  if (!secret || !accessToken) {
    return fail('OWNER_ACCESS_UNAVAILABLE', 'Требуется активный вход владельца платформы.', 401);
  }

  const authorityResult = await resolveOwnerAuthority(accessToken, secret, correlationId);
  if (authorityResult.status === 'unavailable') {
    return fail('OWNER_AUTHORITY_UNAVAILABLE', 'Не удалось проверить полномочия владельца.', 503);
  }
  if (authorityResult.status === 'denied') {
    return fail('PLATFORM_OWNER_REQUIRED', 'Требуется активное назначение владельца платформы.', 403);
  }

  const { authority } = authorityResult;
  const organization = resolveControlledOrganization(parsed.role, parsed.organizationId, authority);
  if (organization === 'invalid') {
    return fail('INVALID_TEST_ORGANIZATION', 'Тестовая организация не соответствует выбранному кабинету.', 400);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const cabinetToken = await signCabinetSession(parsed.role, secret, {
    nowSeconds,
    ttlSeconds: authority.ttlSeconds,
    organizationId: organization?.organizationId || null,
    tenantId: organization?.tenantId || null,
    ownerAccess: true,
  });
  if (!cabinetToken) return fail('CABINET_SESSION_UNAVAILABLE', 'Не удалось открыть кабинет.', 503);

  const expiresAt = nowSeconds + authority.ttlSeconds;
  const response = parsed.formSubmission
    ? NextResponse.redirect(new URL(OWNER_CABINETS[parsed.role], request.url), 303)
    : json({
      ok: true,
      role: parsed.role,
      redirectTo: OWNER_CABINETS[parsed.role],
      organization: organization ? {
        id: organization.organizationId,
        name: organization.organizationName,
        tenantId: organization.tenantId,
        testData: true,
      } : null,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      correlationId,
    });

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  setCabinetCookies(response, cabinetToken, parsed.role, authority, expiresAt, organization);

  console.info('owner_direct_cabinet_open', JSON.stringify({
    actor: authority.actorId,
    authoritySource: authority.source,
    role: parsed.role,
    organizationId: organization?.organizationId || null,
    correlationId,
    transport: parsed.formSubmission ? 'native-form' : 'json-fetch',
  }));

  return response;
}
