import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '../../../../../lib/auth-cookies';
import {
  MFA_STEP_UP_COOKIE,
  clearMfaStepUpCookieOptions,
  mfaStepUpCookieOptions,
} from '../../../../../lib/server/mfa-step-up-cookie';
import { assertCsrf } from '../../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const UNIVERSAL_ERROR = 'Не удалось начать дополнительную проверку MFA.';

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function forwarded(request: Request, correlationId: string, token: string) {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const userAgent = request.headers.get('user-agent');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId,
    ...(ip ? { 'x-forwarded-for': ip } : {}),
    ...(userAgent ? { 'user-agent': userAgent } : {}),
  };
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', message: UNIVERSAL_ERROR, correlationId }, 403);

  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value || '';
  if (!accessToken) return json({ ok: false, code: 'AUTH_REQUIRED', message: UNIVERSAL_ERROR, correlationId }, 401);
  if (!API_URL) return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);

  try {
    const apiResponse = await fetch(`${API_URL}/auth/mfa/step-up/start`, {
      method: 'POST',
      headers: forwarded(request, correlationId, accessToken),
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
    const challengeToken = String(payload.challengeToken || '');
    if (!apiResponse.ok || challengeToken.length < 40 || challengeToken.length > 512) {
      const response = json({
        ok: false,
        code: apiResponse.status === 429 ? 'RATE_LIMITED' : 'MFA_STEP_UP_UNAVAILABLE',
        message: UNIVERSAL_ERROR,
        correlationId,
      }, apiResponse.status === 429 ? 429 : apiResponse.status === 401 ? 401 : 403);
      response.cookies.set(MFA_STEP_UP_COOKIE, '', clearMfaStepUpCookieOptions());
      return response;
    }

    const response = json({
      ok: true,
      methods: ['totp', 'backup_code'],
      expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : null,
      correlationId,
    });
    response.cookies.set(MFA_STEP_UP_COOKIE, challengeToken, mfaStepUpCookieOptions());
    return response;
  } catch (error) {
    console.error('auth_mfa_step_up_start_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
}
