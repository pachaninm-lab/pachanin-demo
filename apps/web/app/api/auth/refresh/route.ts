import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  applyAuthenticatedSession,
  clearAuthenticatedSession,
  type AuthenticatedSessionPayload,
} from '../../../../lib/server/auth-session-response';
import { REFRESH_COOKIE } from '../../../../lib/auth-cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 8;

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
  const jar = cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value || '';

  if (!API_URL || !refreshToken) {
    const response = json({ ok: false, code: 'SESSION_UNAVAILABLE', correlationId }, 401);
    clearAuthenticatedSession(response);
    return response;
  }

  try {
    const apiResponse = await fetch(`${API_URL}/auth/refresh`, {
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
    const payload = await apiResponse.json().catch(() => ({} as AuthenticatedSessionPayload)) as AuthenticatedSessionPayload;

    if (!apiResponse.ok || !payload.accessToken || !payload.refreshToken || !payload.user?.email || !payload.user?.role) {
      const response = json({
        ok: false,
        code: apiResponse.status === 429 ? 'RATE_LIMITED' : 'SESSION_REVOKED',
        correlationId,
      }, apiResponse.status === 429 ? 429 : 401);
      clearAuthenticatedSession(response);
      return response;
    }

    const response = json({ ok: true, correlationId });
    applyAuthenticatedSession(response, payload);
    return response;
  } catch (error) {
    console.error('auth_refresh_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
