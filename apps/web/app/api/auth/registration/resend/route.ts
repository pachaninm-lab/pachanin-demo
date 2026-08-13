import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertCsrf } from '../../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

type ApiPayload = {
  accepted?: boolean;
  cooldownSeconds?: number;
  correlationId?: string;
  queued?: boolean;
};

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ accepted: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const locale = body.locale === 'en' || body.locale === 'zh' ? body.locale : 'ru';
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return json({ accepted: false, code: 'INVALID_EMAIL', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  if (!upstream) {
    return json({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const response = await fetch(`${upstream}/auth/registration/email/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ email, locale }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    });
    const payload = await response.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!response.ok) {
      return json({
        accepted: false,
        code: response.status === 429 ? 'RATE_LIMITED' : 'REGISTRATION_SERVICE_UNAVAILABLE',
        correlationId,
      }, response.status === 429 ? 429 : 503);
    }
    return json({
      accepted: payload.accepted !== false,
      cooldownSeconds: payload.cooldownSeconds || 60,
      correlationId: payload.correlationId || correlationId,
    }, 202);
  } catch {
    return json({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
