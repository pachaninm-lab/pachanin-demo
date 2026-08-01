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

function requestIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '';
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const token = String(body.token || '').trim();
  const password = String(body.password || '');
  const fullName = String(body.fullName || '').trim();
  const phone = String(body.phone || '').trim();
  const termsVersion = String(body.termsVersion || '').trim();
  const privacyVersion = String(body.privacyVersion || '').trim();
  if (
    token.length < 48 || token.length > 512
    || password.length < 1 || password.length > 128
    || fullName.length < 2 || fullName.length > 200
    || (phone && (phone.length < 7 || phone.length > 24))
    || !termsVersion || termsVersion.length > 64
    || !privacyVersion || privacyVersion.length > 64
    || body.acceptTerms !== true
    || body.acceptPrivacy !== true
  ) {
    return json({ ok: false, code: 'INVITATION_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  if (!upstream) return json({ ok: false, code: 'INVITATION_SERVICE_UNAVAILABLE', correlationId }, 503);

  try {
    const ip = requestIp(request);
    const response = await fetch(`${upstream}/auth/organization-invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(request.headers.get('user-agent') ? { 'user-agent': String(request.headers.get('user-agent')) } : {}),
      },
      body: JSON.stringify({
        token,
        password,
        fullName,
        ...(phone ? { phone } : {}),
        termsVersion,
        privacyVersion,
        acceptTerms: true,
        acceptPrivacy: true,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok || payload.ok !== true) {
      const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
      return json({
        ok: false,
        code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'INVITATION_SERVICE_UNAVAILABLE' : 'INVITATION_INVALID',
        correlationId,
      }, status);
    }
    return json({
      ok: true,
      organizationName: payload.organizationName,
      role: payload.role,
      nextAction: 'LOGIN',
      correlationId: payload.correlationId || correlationId,
    }, 200);
  } catch {
    return json({ ok: false, code: 'INVITATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
