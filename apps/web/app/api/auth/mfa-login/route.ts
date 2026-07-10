import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  applyAuthenticatedSession,
  normalizeSurfaceRole,
  platformHome,
  type AuthenticatedSessionPayload,
} from '../../../../lib/server/auth-session-response';
import {
  MFA_PENDING_COOKIE,
  clearMfaPendingCookieOptions,
  openMfaLoginTicket,
} from '../../../../lib/server/mfa-login-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const UNIVERSAL_ERROR = 'Не удалось подтвердить второй фактор. Проверь код или начни вход заново.';

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

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const code = String(body.code || '').trim();
  const jar = cookies();
  const ticket = openMfaLoginTicket(jar.get(MFA_PENDING_COOKIE)?.value || '');

  if (!ticket || !code || code.length > 128) {
    const response = json({ ok: false, code: 'MFA_INVALID', message: UNIVERSAL_ERROR, correlationId }, 401);
    if (!ticket) response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
    return response;
  }
  if (!API_URL) {
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }

  const ip = requestIp(request);
  try {
    const apiResponse = await fetch(`${API_URL}/auth/mfa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(request.headers.get('user-agent') ? { 'user-agent': request.headers.get('user-agent') as string } : {}),
      },
      body: JSON.stringify({ challengeToken: ticket.challengeToken, code }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as AuthenticatedSessionPayload)) as AuthenticatedSessionPayload & {
      backupCodes?: string[];
    };

    if (!apiResponse.ok || !payload.accessToken || !payload.refreshToken || !payload.user?.email || !payload.user?.role) {
      const terminal = apiResponse.status === 401 || apiResponse.status === 403 || apiResponse.status === 410;
      const response = json({
        ok: false,
        code: apiResponse.status === 429 ? 'RATE_LIMITED' : 'MFA_INVALID',
        message: UNIVERSAL_ERROR,
        correlationId,
      }, apiResponse.status === 429 ? 429 : 401);
      if (terminal) response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
      return response;
    }

    const role = normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole);
    const response = json({
      ok: true,
      redirectTo: platformHome(role),
      backupCodes: Array.isArray(payload.backupCodes) ? payload.backupCodes : undefined,
      correlationId,
    });
    const session = await applyAuthenticatedSession(response, payload);
    if (!session) {
      return json({ ok: false, code: 'SESSION_CONFIGURATION_ERROR', message: UNIVERSAL_ERROR, correlationId }, 503);
    }
    response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
    return response;
  } catch (error) {
    console.error('auth_mfa_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
}
