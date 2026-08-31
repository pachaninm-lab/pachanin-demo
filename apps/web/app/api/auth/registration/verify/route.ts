import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertCsrf } from '../../../../../lib/server-request-security';
import { sendTransactionalMail } from '../../../../../lib/server/transactional-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const joinAdminCopy = {
  ru: { subject: 'Прозрачная Цена — новая заявка на присоединение', text: (name: string, applicantEmail: string, workspace: string) => `Email заявителя подтверждён. К организации запрошено присоединение: ${name} (${applicantEmail}), рабочее пространство ${workspace}. Решение доступно администратору организации в разделе «Команда».` },
  en: { subject: 'Transparent Price — new organization join request', text: (name: string, applicantEmail: string, workspace: string) => `The applicant email is verified. A join request was submitted by ${name} (${applicantEmail}), workspace ${workspace}. Review it in Team.` },
  zh: { subject: '透明价格 — 新的组织加入申请', text: (name: string, applicantEmail: string, workspace: string) => `申请人的邮箱已验证。${name}（${applicantEmail}）申请加入，工作空间 ${workspace}。请在“团队”中审核。` },
} as const;

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
  const locale = body.locale === 'en' || body.locale === 'zh' ? body.locale : 'ru';
  if (token.length < 48 || token.length > 512) {
    return json({ ok: false, code: 'REGISTRATION_EMAIL_TOKEN_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  if (!upstream) {
    return json({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const ip = requestIp(request);
    const deliveryKey = String(process.env.REGISTRATION_DELIVERY_KEY || '').trim();
    const response = await fetch(`${upstream}/auth/registration/email/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(deliveryKey.length >= 32 ? { 'x-registration-delivery-key': deliveryKey } : {}),
        ...(ip ? { 'x-forwarded-for': ip } : {}),
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
    const joinNotification = payload.joinNotificationDelivery && typeof payload.joinNotificationDelivery === 'object'
      ? payload.joinNotificationDelivery as {
          recipients?: unknown;
          applicantName?: unknown;
          applicantEmail?: unknown;
          requestedWorkspace?: unknown;
        }
      : null;
    delete payload.joinNotificationDelivery;
    const recipients = Array.isArray(joinNotification?.recipients)
      ? joinNotification.recipients.filter((item): item is string => typeof item === 'string' && /^\S+@\S+\.\S+$/.test(item)).slice(0, 20)
      : [];
    if (recipients.length > 0) {
      const copy = joinAdminCopy[locale];
      const deliveries = await Promise.all(recipients.map((recipient) => sendTransactionalMail({
        to: recipient,
        subject: copy.subject,
        text: copy.text(
          String(joinNotification?.applicantName || 'Applicant'),
          String(joinNotification?.applicantEmail || ''),
          String(joinNotification?.requestedWorkspace || 'employee'),
        ),
      })));
      console.info('organization_join_admin_notification_result', JSON.stringify({
        correlationId,
        recipientCount: recipients.length,
        deliveredCount: deliveries.filter(({ delivered }) => delivered).length,
      }));
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
