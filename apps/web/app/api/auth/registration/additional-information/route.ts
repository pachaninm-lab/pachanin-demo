import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertCsrf } from '../../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const statusToken = String(body.statusToken || '').trim();
  const responseText = String(body.response || '').trim();
  if (!statusToken.startsWith('rst_reg_') || statusToken.length > 512 || responseText.length < 8 || responseText.length > 4000) {
    return json({ ok: false, code: 'REGISTRATION_INFORMATION_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  if (!upstream) return json({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);

  try {
    const upstreamResponse = await fetch(`${upstream}/auth/registration/additional-information`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify({ statusToken, response: responseText }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(6_000),
    });
    if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId }, 502);
    }
    const payload = await upstreamResponse.json().catch(() => ({} as Record<string, unknown>));
    const status = upstreamResponse.status === 429 ? 429 : upstreamResponse.status >= 500 ? 503 : upstreamResponse.ok ? 200 : 400;
    return json({ ...payload, correlationId: payload.correlationId || correlationId }, status);
  } catch {
    return json({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
