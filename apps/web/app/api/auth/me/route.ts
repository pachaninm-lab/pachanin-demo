import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '../../../../lib/auth-cookies';
import {
  clearAuthenticatedSession,
  normalizeSurfaceRole,
} from '../../../../lib/server/auth-session-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

export async function GET(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value || '';
  if (!accessToken || accessToken.startsWith('demo.')) {
    const response = json({ authenticated: false, code: 'UNAUTHENTICATED', correlationId }, 401);
    clearAuthenticatedSession(response);
    return response;
  }
  if (!API_URL) {
    return json({ authenticated: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const upstream = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-correlation-id': correlationId,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    if (!upstream.ok) {
      const response = json({ authenticated: false, code: 'UNAUTHENTICATED', correlationId }, 401);
      clearAuthenticatedSession(response);
      return response;
    }
    const role = normalizeSurfaceRole(String(payload.role || ''), typeof payload.surfaceRole === 'string' ? payload.surfaceRole : undefined);
    if (
      !role
      || typeof payload.id !== 'string'
      || typeof payload.orgId !== 'string'
      || typeof payload.tenantId !== 'string'
      || typeof payload.membershipId !== 'string'
    ) {
      const response = json({ authenticated: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', correlationId }, 502);
      clearAuthenticatedSession(response);
      return response;
    }
    return json({ ...payload, authenticated: true, surfaceRole: role, correlationId });
  } catch (error) {
    console.error('auth_me_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ authenticated: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
