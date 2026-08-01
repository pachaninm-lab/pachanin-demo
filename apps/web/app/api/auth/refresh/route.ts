import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { REFRESH_COOKIE } from '../../../../lib/auth-cookies';
import { assertCsrf } from '../../../../lib/server-request-security';
import {
  applyAuthenticatedSession,
  clearAuthenticatedSession,
  type AuthenticatedSessionPayload,
} from '../../../../lib/server/auth-session-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

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

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  }

  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value || '';
  if (!refreshToken || refreshToken.startsWith('demo-refresh.')) {
    const response = json({ ok: false, code: 'SESSION_NOT_REFRESHABLE', correlationId }, 401);
    clearAuthenticatedSession(response);
    return response;
  }
  if (!API_URL) {
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const upstream = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(request.headers.get('user-agent') ? { 'user-agent': request.headers.get('user-agent') as string } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await upstream.json().catch(() => ({})) as Partial<AuthenticatedSessionPayload>;
    if (!upstream.ok) {
      const response = json({ ok: false, code: 'SESSION_NOT_REFRESHABLE', correlationId }, 401);
      clearAuthenticatedSession(response);
      return response;
    }
    if (!payload.accessToken || !payload.refreshToken || !payload.user) {
      return json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', correlationId }, 502);
    }

    const response = json({ ok: true, correlationId });
    const session = await applyAuthenticatedSession(response, payload as AuthenticatedSessionPayload);
    if (!session) {
      const failed = json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', correlationId }, 502);
      clearAuthenticatedSession(failed);
      return failed;
    }
    return response;
  } catch (error) {
    console.error('auth_refresh_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
