import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';
import { sendTransactionalMail } from '@/lib/server/transactional-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const mailCopy = {
  ru: { subject: 'Прозрачная Цена — решение по присоединению', text: (status: string, reason: string) => `Статус заявки на присоединение: ${status}. Основание: ${reason}. Проверьте состояние по исходной защищённой ссылке.` },
  en: { subject: 'Transparent Price — join request decision', text: (status: string, reason: string) => `Join request status: ${status}. Basis: ${reason}. Check the state using the original protected link.` },
  zh: { subject: '透明价格 — 加入申请决定', text: (status: string, reason: string) => `加入申请状态：${status}。依据：${reason}。请使用原始安全链接查看状态。` },
} as const;

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

  try {
    const upstreamResponse = await fetch(`${upstream}/auth/organization-join-requests/${encodeURIComponent(applicationId)}/decision`, {
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
      signal: AbortSignal.timeout(8_000),
    });
    if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId }, 502);
    }
    const payload = await upstreamResponse.json().catch(() => ({} as Record<string, unknown>));
    const notification = payload.notificationDelivery && typeof payload.notificationDelivery === 'object'
      ? payload.notificationDelivery as { email?: unknown; status?: unknown; reason?: unknown }
      : null;
    delete payload.notificationDelivery;

    if (!upstreamResponse.ok) return json({ ...payload, correlationId }, upstreamResponse.status);

    let notificationDelivered = false;
    if (typeof notification?.email === 'string' && notification.email) {
      const copy = mailCopy[locale];
      const delivery = await sendTransactionalMail({
        to: notification.email,
        subject: copy.subject,
        text: copy.text(String(notification.status || 'UPDATED'), String(notification.reason || reason)),
      });
      notificationDelivered = delivery.delivered;
      console.info('organization_join_decision_notification_result', JSON.stringify({
        correlationId,
        delivered: delivery.delivered,
        provider: delivery.provider,
        reason: delivery.reason,
      }));
    }
    return json({ ...payload, notificationDelivered, correlationId }, upstreamResponse.status);
  } catch {
    return json({ ok: false, code: 'JOIN_REQUEST_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
