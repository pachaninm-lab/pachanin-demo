import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sendTransactionalMail } from '../../../../../lib/server/transactional-mail';
import { assertCsrf } from '../../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const COPY = {
  ru: { subject: 'Прозрачная Цена — подтвердите email', intro: 'Получен повторный запрос подтверждения email.', action: 'Открой одноразовую ссылку:', expiry: 'Ссылка действует 30 минут.' },
  en: { subject: 'Transparent Price — confirm your email', intro: 'A new email-confirmation request was received.', action: 'Open the single-use link:', expiry: 'The link is valid for 30 minutes.' },
  zh: { subject: '透明价格 — 确认电子邮箱', intro: '收到了新的电子邮箱确认请求。', action: '请打开一次性链接：', expiry: '链接有效期为30分钟。' },
} as const;
type Locale = keyof typeof COPY;
type ApiPayload = { accepted?: boolean; cooldownSeconds?: number; correlationId?: string; emailDelivery?: { email?: string; token?: string } };

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function mailConfigured() {
  return Boolean(
    (process.env.RESEND_API_KEY && (process.env.RESEND_FROM_EMAIL || process.env.PC_MAIL_FROM))
    || (process.env.PC_SMTP_HOST && process.env.PC_SMTP_USER && process.env.PC_SMTP_PASS),
  );
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ accepted: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const locale = (body.locale === 'en' || body.locale === 'zh' ? body.locale : 'ru') as Locale;
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return json({ accepted: false, code: 'INVALID_EMAIL', correlationId }, 400);
  }
  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  const deliveryKey = String(process.env.REGISTRATION_DELIVERY_KEY || '').trim();
  if (!upstream || deliveryKey.length < 32 || !mailConfigured()) {
    return json({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const response = await fetch(`${upstream}/auth/registration/email/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        'x-registration-delivery-key': deliveryKey,
      },
      body: JSON.stringify({ email }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    });
    const payload = await response.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!response.ok) {
      return json({ accepted: false, code: response.status === 429 ? 'RATE_LIMITED' : 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, response.status === 429 ? 429 : 503);
    }
    const delivery = payload.emailDelivery;
    if (delivery?.email && delivery.token) {
      const origin = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '') || new URL(request.url).origin;
      const verifyUrl = new URL('/platform-v7/register', origin);
      verifyUrl.searchParams.set('verify', delivery.token);
      verifyUrl.searchParams.set('lang', locale);
      const copy = COPY[locale];
      const result = await sendTransactionalMail({
        to: delivery.email,
        subject: copy.subject,
        text: [copy.intro, '', copy.action, verifyUrl.toString(), '', copy.expiry].join('\n'),
      });
      console.info('registration_resend_delivery_result', JSON.stringify({
        correlationId,
        accountHash: createHash('sha256').update(email).digest('hex').slice(0, 16),
        delivered: result.delivered,
        provider: result.provider,
        reason: result.reason,
      }));
    }
    return json({ accepted: true, cooldownSeconds: payload.cooldownSeconds || 60, correlationId: payload.correlationId || correlationId }, 202);
  } catch {
    return json({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
