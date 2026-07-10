import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  applyAuthenticatedSession,
  normalizeSurfaceRole,
  platformHome,
} from '../../../../lib/server/auth-session-response';
import {
  MFA_PENDING_COOKIE,
  mfaPendingCookieOptions,
  openMfaLoginTicket,
} from '../../../../lib/server/mfa-login-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

type MfaMethod = 'totp' | 'backup_code';

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

function clearPending(response: NextResponse) {
  response.cookies.set(MFA_PENDING_COOKIE, '', {
    ...mfaPendingCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
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
  const method = String(body.method || '') as MfaMethod;
  const rawCode = String(body.code || '').trim();

  if (method !== 'totp' && method !== 'backup_code') {
    return json({ ok: false, code: 'MFA_INVALID', correlationId }, 400);
  }
  if (method === 'totp' && !/^\d{6}$/.test(rawCode)) {
    return json({ ok: false, code: 'MFA_INVALID', correlationId }, 400);
  }
  if (method === 'backup_code' && (rawCode.length < 8 || rawCode.length > 64)) {
    return json({ ok: false, code: 'MFA_INVALID', correlationId }, 400);
  }

  const jar = cookies();
  const sealed = jar.get(MFA_PENDING_COOKIE)?.value || '';
  const ticket = openMfaLoginTicket(sealed);
  if (!ticket) {
    const response = json({ ok: false, code: 'MFA_EXPIRED', correlationId }, 401);
    clearPending(response);
    return response;
  }
  if (!API_URL) {
    console.error('mfa_login_auth_service_not_configured', JSON.stringify({ correlationId }));
    return json({ ok: false, code: 'MFA_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const ip = requestIp(request);
    const apiResponse = await fetch(`${API_URL}/api/mfa/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ticket.accessToken}`,
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
      },
      body: JSON.stringify({
        challengeId: ticket.challengeId,
        ...(method === 'totp' ? { code: rawCode } : { backupCode: rawCode }),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });

    if (!apiResponse.ok) {
      const code = apiResponse.status === 429
        ? 'MFA_RATE_LIMITED'
        : apiResponse.status === 401 || apiResponse.status === 400
          ? 'MFA_INVALID'
          : 'MFA_UNAVAILABLE';
      const response = json({ ok: false, code, correlationId }, apiResponse.status === 429 ? 429 : apiResponse.status >= 500 ? 503 : 401);
      if (code === 'MFA_UNAVAILABLE') console.error('mfa_login_verify_failure', JSON.stringify({ correlationId, status: apiResponse.status }));
      return response;
    }

    const role = normalizeSurfaceRole(ticket.user.role, ticket.user.surfaceRole);
    const redirectTo = platformHome(role);
    const response = json({ ok: true, redirectTo, correlationId });
    applyAuthenticatedSession(response, {
      accessToken: ticket.accessToken,
      refreshToken: ticket.refreshToken,
      expiresIn: 15 * 60,
      user: ticket.user,
    });
    clearPending(response);
    return response;
  } catch (error) {
    console.error('mfa_login_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'MFA_UNAVAILABLE', correlationId }, 503);
  }
}
