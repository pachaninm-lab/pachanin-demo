import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, SESSION_COOKIE, sessionMarkerCookie } from '@/lib/auth-cookies';
import { CABINET_SESSION_COOKIE } from '@/lib/server/auth-session-response';
import { assertCsrf } from '@/lib/server-request-security';
import { signCabinetSession, verifyHs256Jwt } from '@/lib/platform-v7/verified-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

type StaffIdentity = {
  id?: string;
  email?: string;
};

type StaffAssignment = {
  role?: string;
  status?: string;
};

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
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return '';
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

function isOwnerCabinetRole(value: unknown): value is OwnerCabinetRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(OWNER_CABINETS, value);
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
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'x-correlation-id': correlationId,
    };
    const [identityResponse, assignmentsResponse] = await Promise.all([
      fetch(`${origin}/auth/me`, {
        headers,
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(6_000),
      }),
      fetch(`${origin}/staff/assignments/me`, {
        headers,
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(6_000),
      }),
    ]);

    if (
      identityResponse.status === 401
      || identityResponse.status === 403
      || assignmentsResponse.status === 401
      || assignmentsResponse.status === 403
    ) {
      return { status: 'denied' };
    }
    if (
      !identityResponse.ok
      || !assignmentsResponse.ok
      || (identityResponse.status >= 300 && identityResponse.status < 400)
      || (assignmentsResponse.status >= 300 && assignmentsResponse.status < 400)
    ) {
      return { status: 'unavailable' };
    }

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

async function resolveOwnerAuthority(
  accessToken: string,
  secret: string,
  correlationId: string,
): Promise<AuthorityResult> {
  const controlled = await controlledOwnerAuthority(accessToken, secret);
  return controlled || apiOwnerAuthority(accessToken, correlationId);
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    return json({ ok: false, code: 'CSRF_REJECTED', message: 'Сессия формы устарела. Обнови страницу.', correlationId }, 403);
  }

  const secret = signingSecret();
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
  if (!secret || !accessToken) {
    return json({ ok: false, code: 'OWNER_ACCESS_UNAVAILABLE', message: 'Требуется активный вход владельца платформы.', correlationId }, 401);
  }

  const authorityResult = await resolveOwnerAuthority(accessToken, secret, correlationId);
  if (authorityResult.status === 'unavailable') {
    return json({ ok: false, code: 'OWNER_AUTHORITY_UNAVAILABLE', message: 'Не удалось проверить полномочия владельца.', correlationId }, 503);
  }
  if (authorityResult.status === 'denied') {
    return json({ ok: false, code: 'PLATFORM_OWNER_REQUIRED', message: 'Требуется активное назначение владельца платформы.', correlationId }, 403);
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const role = body.role;
  if (!isOwnerCabinetRole(role)) {
    return json({ ok: false, code: 'INVALID_CABINET_ROLE', message: 'Неизвестный кабинет.', correlationId }, 400);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const { authority } = authorityResult;
  const cabinetToken = await signCabinetSession(role, secret, {
    nowSeconds,
    ttlSeconds: authority.ttlSeconds,
  });
  if (!cabinetToken) {
    return json({ ok: false, code: 'CABINET_SESSION_UNAVAILABLE', message: 'Не удалось открыть кабинет.', correlationId }, 503);
  }

  const expiresAt = nowSeconds + authority.ttlSeconds;
  const response = json({
    ok: true,
    role,
    redirectTo: OWNER_CABINETS[role],
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    correlationId,
  });

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
    encodeURIComponent(JSON.stringify({ role, exp: expiresAt, email: authority.email })),
    { ...sessionMarkerCookie(), maxAge: authority.ttlSeconds, priority: 'high' },
  );
  response.cookies.set('pc-role', role, {
    path: '/',
    maxAge: authority.ttlSeconds,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  console.info('owner_direct_cabinet_open', JSON.stringify({
    actor: authority.actorId,
    authoritySource: authority.source,
    role,
    correlationId,
  }));

  return response;
}
