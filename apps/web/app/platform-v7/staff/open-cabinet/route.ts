import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, SESSION_COOKIE, sessionMarkerCookie } from '@/lib/auth-cookies';
import { CABINET_SESSION_COOKIE } from '@/lib/server/auth-session-response';
import { assertCsrf } from '@/lib/server-request-security';
import { signCabinetSession, verifyHs256Jwt } from '@/lib/platform-v7/verified-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TTL_SECONDS = 8 * 60 * 60;

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

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function enabled(): boolean {
  if (readEnv('PC_CABINET_TEST_ACCESS').toLowerCase() !== 'true') return false;
  const expiresAt = readEnv('PC_CABINET_TEST_ACCESS_EXPIRES_AT');
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function secret(): string {
  return readEnv('JWT_SECRET') || readEnv('PC_CABINET_SESSION_SECRET');
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

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();

  if (!enabled()) {
    return json({ ok: false, code: 'OWNER_DIRECT_ACCESS_DISABLED', correlationId }, 404);
  }

  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    return json({ ok: false, code: 'CSRF_REJECTED', message: 'Сессия формы устарела. Обнови страницу.', correlationId }, 403);
  }

  const signingSecret = secret();
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
  const claims = signingSecret && accessToken ? await verifyHs256Jwt(accessToken, signingSecret) : null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenExpiry = typeof claims?.exp === 'number' ? claims.exp : 0;

  if (
    !claims
    || claims.owner !== true
    || claims.testAccess !== true
    || claims.tokenType !== 'access'
    || typeof claims.sub !== 'string'
    || typeof claims.email !== 'string'
    || tokenExpiry <= nowSeconds
  ) {
    return json({ ok: false, code: 'PLATFORM_OWNER_REQUIRED', message: 'Требуется активный вход владельца платформы.', correlationId }, 403);
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const role = body.role;
  if (!isOwnerCabinetRole(role)) {
    return json({ ok: false, code: 'INVALID_CABINET_ROLE', message: 'Неизвестный кабинет.', correlationId }, 400);
  }

  const ttlSeconds = Math.min(MAX_TTL_SECONDS, tokenExpiry - nowSeconds);
  if (ttlSeconds < 60) {
    return json({ ok: false, code: 'OWNER_SESSION_EXPIRED', message: 'Сессия владельца истекла. Войди снова.', correlationId }, 401);
  }

  const cabinetToken = await signCabinetSession(role, signingSecret, { nowSeconds, ttlSeconds });
  if (!cabinetToken) {
    return json({ ok: false, code: 'CABINET_SESSION_UNAVAILABLE', message: 'Не удалось открыть кабинет.', correlationId }, 503);
  }

  const expiresAt = nowSeconds + ttlSeconds;
  const response = json({
    ok: true,
    role,
    redirectTo: OWNER_CABINETS[role],
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    correlationId,
  });

  response.cookies.set(CABINET_SESSION_COOKIE, cabinetToken, {
    path: '/',
    maxAge: ttlSeconds,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    priority: 'high',
  });
  response.cookies.set(
    SESSION_COOKIE,
    encodeURIComponent(JSON.stringify({ role, exp: expiresAt, email: claims.email })),
    { ...sessionMarkerCookie(), maxAge: ttlSeconds, priority: 'high' },
  );
  response.cookies.set('pc-role', role, {
    path: '/',
    maxAge: ttlSeconds,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  console.info('owner_direct_cabinet_open', JSON.stringify({
    actor: claims.sub,
    role,
    correlationId,
  }));

  return response;
}
