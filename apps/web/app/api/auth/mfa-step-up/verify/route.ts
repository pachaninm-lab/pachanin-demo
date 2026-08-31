import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '../../../../../lib/auth-cookies';
import {
  MFA_STEP_UP_COOKIE,
  clearMfaStepUpCookieOptions,
} from '../../../../../lib/server/mfa-step-up-cookie';
import { assertCsrf } from '../../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const UNIVERSAL_ERROR = 'Не удалось подтвердить дополнительную проверку MFA.';

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function clear(response: NextResponse) {
  response.cookies.set(MFA_STEP_UP_COOKIE, '', clearMfaStepUpCookieOptions());
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', message: UNIVERSAL_ERROR, correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const code = String(body.code || '').trim();
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value || '';
  const challengeToken = jar.get(MFA_STEP_UP_COOKIE)?.value || '';
  if (!accessToken || !challengeToken || !/^(?:\d{6}|[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4})$/.test(code)) {
    const response = json({ ok: false, code: 'MFA_STEP_UP_INVALID', message: UNIVERSAL_ERROR, correlationId }, accessToken ? 400 : 401);
    clear(response);
    return response;
  }
  if (!API_URL) return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);

  try {
    const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const userAgent = request.headers.get('user-agent');
    const apiResponse = await fetch(`${API_URL}/auth/mfa/step-up/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(userAgent ? { 'user-agent': userAgent } : {}),
      },
      body: JSON.stringify({ challengeToken, code }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
    if (!apiResponse.ok || payload.ok !== true || payload.mfaVerified !== true) {
      const response = json({
        ok: false,
        code: apiResponse.status === 429 ? 'RATE_LIMITED' : 'MFA_STEP_UP_INVALID',
        message: UNIVERSAL_ERROR,
        correlationId,
      }, apiResponse.status === 429 ? 429 : 401);
      clear(response);
      return response;
    }
    const response = json({
      ok: true,
      mfaVerified: true,
      mfaVerifiedAt: typeof payload.mfaVerifiedAt === 'string' ? payload.mfaVerifiedAt : null,
      correlationId,
    });
    clear(response);
    return response;
  } catch (error) {
    console.error('auth_mfa_step_up_verify_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
}
