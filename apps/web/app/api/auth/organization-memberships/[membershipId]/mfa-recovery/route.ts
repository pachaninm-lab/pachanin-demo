import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

type ApiPayload = {
  membershipId?: string;
  mfaRecoveryInitiated?: boolean;
  status?: string;
  expiresAt?: string;
  version?: string;
  correlationId?: string;
  replayed?: boolean;
  emailQueued?: boolean;
  code?: string;
};

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

function upstreamStatus(status: number) {
  if ([401, 403, 404, 409, 429].includes(status)) return status;
  return status >= 500 ? 503 : 400;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ membershipId: string }> },
) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);

  const { membershipId } = await context.params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const version = String(body.version || '').trim();
  const reason = String(body.reason || '').trim();
  const locale = body.locale === 'en' || body.locale === 'zh' ? body.locale : 'ru';
  const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
  if (
    !membershipId
    || membershipId.length > 160
    || !/^\d+$/.test(version)
    || reason.length < 8
    || reason.length > 500
    || idempotencyKey.length < 16
    || idempotencyKey.length > 128
  ) {
    return json({ ok: false, code: 'MFA_RECOVERY_REQUEST_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value || '';
  if (!upstream || !accessToken) {
    console.error('mfa_recovery_initiate_configuration_error', JSON.stringify({
      correlationId,
      apiConfigured: Boolean(upstream),
      authenticated: Boolean(accessToken),
    }));
    return json({ ok: false, code: accessToken ? 'MFA_RECOVERY_UNAVAILABLE' : 'AUTH_REQUIRED', correlationId }, accessToken ? 503 : 401);
  }

  try {
    const apiResponse = await fetch(`${upstream}/auth/organization-memberships/${encodeURIComponent(membershipId)}/mfa-reset`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'idempotency-key': idempotencyKey,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ version, reason, locale }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!apiResponse.ok || payload.mfaRecoveryInitiated !== true) {
      const status = upstreamStatus(apiResponse.status);
      return json({ ok: false, code: payload.code || 'MFA_RECOVERY_REJECTED', correlationId }, status);
    }
    if (!payload.replayed && payload.emailQueued !== true) {
      return json({ ok: false, code: 'MFA_RECOVERY_UNAVAILABLE', correlationId }, 503);
    }

    return json({
      ok: true,
      membershipId: payload.membershipId || membershipId,
      status: payload.status,
      expiresAt: payload.expiresAt,
      version: payload.version,
      replayed: Boolean(payload.replayed),
      correlationId: payload.correlationId || correlationId,
    }, 202);
  } catch (error) {
    console.error('mfa_recovery_initiate_transport_failure', JSON.stringify({
      correlationId,
      membershipId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'MFA_RECOVERY_UNAVAILABLE', correlationId }, 503);
  }
}
