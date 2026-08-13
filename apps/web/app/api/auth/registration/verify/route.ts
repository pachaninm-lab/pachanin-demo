import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertCsrf } from '../../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

function json(body: Record<string, unknown>, status: number) {
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
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const token = String(body.token || '').trim();
  if (token.length < 48 || token.length > 512) {
    return json({ ok: false, code: 'REGISTRATION_EMAIL_TOKEN_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  if (!upstream) {
    return json({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const response = await fetch(`${upstream}/auth/registration/email/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ token }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok || payload.ok !== true) {
      const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
      return json({
        ok: false,
        code: status === 429
          ? 'RATE_LIMITED'
          : status === 503
            ? 'REGISTRATION_SERVICE_UNAVAILABLE'
            : 'REGISTRATION_EMAIL_TOKEN_INVALID',
        correlationId,
      }, status);
    }
    return json({ ...payload, correlationId: payload.correlationId || correlationId }, 200);
  } catch (error) {
    console.error('registration_email_verify_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
