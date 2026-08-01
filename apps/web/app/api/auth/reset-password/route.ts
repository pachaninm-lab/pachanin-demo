import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { clearAuthenticatedSession } from '../../../../lib/server/auth-session-response';
import { MFA_PENDING_COOKIE, clearMfaPendingCookieOptions } from '../../../../lib/server/mfa-login-ticket';
import { assertCsrf } from '../../../../lib/server-request-security';
import { sendTransactionalMail } from '../../../../lib/server/transactional-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const notificationCopy = {
  ru: {
    subject: 'Прозрачная Цена — пароль изменён',
    text: 'Пароль учётной записи изменён. Все прежние сессии и refresh-токены отозваны. Если это сделали не вы, немедленно обратитесь к владельцу организации.',
  },
  en: {
    subject: 'Transparent Price — password changed',
    text: 'The account password was changed. All previous sessions and refresh tokens were revoked. If this was not you, contact your organization owner immediately.',
  },
  zh: {
    subject: '透明价格 — 密码已更改',
    text: '账户密码已更改，所有旧会话和刷新令牌均已撤销。如果并非本人操作，请立即联系组织负责人。',
  },
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

function mailChannelConfigured() {
  return Boolean(
    (process.env.RESEND_API_KEY && (process.env.RESEND_FROM_EMAIL || process.env.PC_MAIL_FROM))
    || (process.env.PC_SMTP_HOST && process.env.PC_SMTP_USER && process.env.PC_SMTP_PASS),
  );
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const token = String(body.token || '').trim();
  const newPassword = String(body.newPassword || '');
  const requestedLocale = String(body.locale || 'ru');
  const locale = requestedLocale === 'en' || requestedLocale === 'zh' ? requestedLocale : 'ru';

  if (token.length < 48 || token.length > 512 || newPassword.length < 12 || newPassword.length > 128) {
    return json({ ok: false, code: 'PASSWORD_RESET_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  const deliveryKey = String(process.env.PASSWORD_RESET_DELIVERY_KEY || '').trim();
  if (!upstream || deliveryKey.length < 32 || !mailChannelConfigured()) {
    console.error('password_reset_confirm_configuration_error', JSON.stringify({
      correlationId,
      apiConfigured: Boolean(upstream),
      deliveryBoundaryConfigured: deliveryKey.length >= 32,
      mailConfigured: mailChannelConfigured(),
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const ip = requestIp(request);
    const apiResponse = await fetch(`${upstream}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        'x-password-reset-delivery-key': deliveryKey,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
      },
      body: JSON.stringify({ token, newPassword }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as Record<string, unknown>));

    if (!apiResponse.ok || payload.success !== true) {
      const status = apiResponse.status === 429 ? 429 : apiResponse.status >= 500 ? 503 : 400;
      return json({
        ok: false,
        code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'PASSWORD_RESET_INVALID',
        correlationId,
      }, status);
    }

    const notification = payload.notificationDelivery && typeof payload.notificationDelivery === 'object'
      ? payload.notificationDelivery as { email?: unknown }
      : null;
    if (typeof notification?.email === 'string' && notification.email) {
      const copy = notificationCopy[locale];
      const delivery = await sendTransactionalMail({
        to: notification.email,
        subject: copy.subject,
        text: copy.text,
      });
      console.info('password_reset_notification_result', JSON.stringify({
        correlationId,
        delivered: delivery.delivered,
        provider: delivery.provider,
        reason: delivery.reason,
      }));
    }

    const response = json({ ok: true, sessionsRevoked: true, correlationId }, 200);
    clearAuthenticatedSession(response);
    response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
    return response;
  } catch (error) {
    console.error('password_reset_confirm_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
