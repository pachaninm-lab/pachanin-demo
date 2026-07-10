import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { applyAuthenticatedSession, type AuthenticatedSessionPayload } from '../../../../lib/server/auth-session-response';
import {
  MFA_PENDING_COOKIE,
  mfaPendingCookieOptions,
  sealMfaLoginTicket,
} from '../../../../lib/server/mfa-login-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const UNIVERSAL_ERROR = 'Не удалось войти. Проверь данные или восстанови доступ.';

type ApiLoginPayload = AuthenticatedSessionPayload & {
  user: AuthenticatedSessionPayload['user'] & {
    mfaEnabled?: boolean;
    mfaVerified?: boolean;
  };
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function requestIp(request: Request) {
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  );
}

async function revokeUncompletedSession(payload: ApiLoginPayload, correlationId: string) {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.accessToken}`,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ refreshToken: payload.refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    console.error('mfa_pending_session_revoke_failed', JSON.stringify({ correlationId }));
  }
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password || email.length > 254 || password.length > 256) {
    return json({ ok: false, code: 'INVALID_CREDENTIALS', message: UNIVERSAL_ERROR, correlationId }, 400);
  }
  if (!API_URL) {
    console.error('auth_service_not_configured', JSON.stringify({ correlationId }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }

  const ip = requestIp(request);
  try {
    const apiResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(request.headers.get('user-agent') ? { 'user-agent': request.headers.get('user-agent') as string } : {}),
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as ApiLoginPayload)) as ApiLoginPayload;

    if (!apiResponse.ok) {
      const rateLimited = apiResponse.status === 429;
      return json({
        ok: false,
        code: rateLimited ? 'RATE_LIMITED' : 'INVALID_CREDENTIALS',
        message: UNIVERSAL_ERROR,
        correlationId,
      }, rateLimited ? 429 : 401);
    }

    if (!payload.accessToken || !payload.refreshToken || !payload.user?.email || !payload.user?.role) {
      console.error('auth_service_incomplete_session', JSON.stringify({ correlationId }));
      return json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', message: UNIVERSAL_ERROR, correlationId }, 502);
    }

    if (payload.user.mfaEnabled && !payload.user.mfaVerified) {
      const challengeResponse = await fetch(`${API_URL}/api/mfa/verify/init`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          ...(ip ? { 'x-forwarded-for': ip } : {}),
        },
        body: '{}',
        cache: 'no-store',
        signal: AbortSignal.timeout(4_000),
      });
      const challenge = await challengeResponse.json().catch(() => ({} as { challengeId?: string; expiresAt?: string }));

      if (!challengeResponse.ok || !challenge.challengeId) {
        await revokeUncompletedSession(payload, correlationId);
        return json({ ok: false, code: 'MFA_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
      }

      let ticket: string;
      try {
        ticket = sealMfaLoginTicket({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          challengeId: challenge.challengeId,
          user: payload.user,
        });
      } catch {
        await revokeUncompletedSession(payload, correlationId);
        console.error('mfa_ticket_secret_not_configured', JSON.stringify({ correlationId }));
        return json({ ok: false, code: 'MFA_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
      }

      const response = json({
        ok: true,
        mfaRequired: true,
        methods: ['totp', 'backup_code'],
        expiresAt: challenge.expiresAt || null,
        correlationId,
      });
      response.cookies.set(MFA_PENDING_COOKIE, ticket, mfaPendingCookieOptions());
      return response;
    }

    const response = json({ ok: true, mfaRequired: false, correlationId });
    const session = applyAuthenticatedSession(response, payload);
    return json({ ok: true, mfaRequired: false, redirectTo: session.redirectTo, correlationId }, 200).also;
  } catch (error) {
    console.error('auth_login_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
}
