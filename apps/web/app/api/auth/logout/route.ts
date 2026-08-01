import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { REFRESH_COOKIE } from '../../../../lib/auth-cookies';
import { assertCsrf } from '../../../../lib/server-request-security';
import { clearAuthenticatedSession } from '../../../../lib/server/auth-session-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

function response(body: Record<string, unknown>, status: number) {
  const result = NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
  clearAuthenticatedSession(result);
  return result;
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { ok: false, code: 'CSRF_REJECTED', correlationId },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value || '';
  if (!refreshToken) return response({ ok: true, correlationId }, 200);
  if (!API_URL) {
    return response({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', localSessionCleared: true, correlationId }, 503);
  }

  try {
    const upstream = await fetch(`${API_URL}/auth/logout`, {
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
    if (!upstream.ok) {
      return response({ ok: false, code: 'SESSION_REVOKE_FAILED', localSessionCleared: true, correlationId }, 503);
    }
    return response({ ok: true, correlationId }, 200);
  } catch (error) {
    console.error('auth_logout_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return response({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', localSessionCleared: true, correlationId }, 503);
  }
}
