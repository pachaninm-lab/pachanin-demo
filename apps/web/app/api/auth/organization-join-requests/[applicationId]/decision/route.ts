import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 100;

// The API performs four guarded database stages before a Serializable
// transaction whose maxWait + timeout envelope is 20 seconds. Four default
// 10-second pool-acquisition windows plus that transaction total 60 seconds;
// keep explicit transport/query headroom before the synchronous mail fallback.
const JOIN_DECISION_UPSTREAM_TIMEOUT_MS = 75_000;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return json({ ok: false, code: 'UNAUTHENTICATED', correlationId }, 401);
  const { applicationId } = await context.params;
  if (!applicationId || applicationId.length > 160 || applicationId.includes('/') || applicationId.includes('\\')) {
    return json({ ok: false, code: 'JOIN_REQUEST_INVALID', correlationId }, 400);
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const decision = String(body.decision || '');
  const reason = String(body.reason || '').trim();
  const locale = body.locale === 'en' || body.locale === 'zh' ? body.locale : 'ru';
  if (!['APPROVE', 'REJECT'].includes(decision) || reason.length < 8 || reason.length > 1000) {
    return json({ ok: false, code: 'JOIN_REQUEST_INVALID', correlationId }, 400);
  }
  const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  const deliveryKey = String(process.env.REGISTRATION_DELIVERY_KEY || '').trim();
  if (!upstream || deliveryKey.length < 32 || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return json({ ok: false, code: 'JOIN_REQUEST_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${upstream}/auth/organization-join-requests/${encodeURIComponent(applicationId)}/decision`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-Id': correlationId,
        'X-Registration-Delivery-Key': deliveryKey,
      },
      body: JSON.stringify({ decision, reason }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(JOIN_DECISION_UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const failureClass = error instanceof Error && error.name === 'TimeoutError'
      ? 'UPSTREAM_TIMEOUT'
      : 'UPSTREAM_TRANSPORT';
    console.warn('organization_join_decision_upstream_failure', JSON.stringify({
      correlationId,
      failureClass,
    }));
    return json({ ok: false, code: 'JOIN_REQUEST_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId }, 502);
  }
  const payload = await upstreamResponse.json().catch(() => ({} as Record<string, unknown>));
  const notification = payload.notificationDelivery && typeof payload.notificationDelivery === 'object'
    ? payload.notificationDelivery as { status?: unknown }
    : null;
  delete payload.notificationDelivery;

  if (!upstreamResponse.ok) return json({ ...payload, correlationId }, upstreamResponse.status);
  if (payload.replayed === true) return json({ ...payload, correlationId }, 200);

  let notificationDelivered = false;
  notificationDelivered = notification?.status === 'SENT';
  console.info('organization_join_decision_notification_result', JSON.stringify({
    correlationId,
    delivered: notificationDelivered,
    provider: 'auth-mail-outbox',
    reason: String(notification?.status || 'MISSING'),
  }));
  if (!notificationDelivered) {
    return json({
      ...payload,
      code: 'REGISTRATION_DECISION_NOTIFICATION_PENDING',
      correlationId,
    }, 503);
  }
  return json({ ...payload, notificationDelivered, correlationId }, 200);
}
