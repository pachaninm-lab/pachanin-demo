import { randomUUID } from 'node:crypto';
import { sendTransactionalMail, isTransactionalMailConfigured } from '@/lib/server/transactional-mail';
import { assertCsrf, resolveRequestTargetOrigin } from '@/lib/server-request-security';
import {
  GEKTA_AUTH_TIMEOUT_MS,
  accountHash,
  gektaApiBase,
  gektaAuthJson,
  gektaForwardHeaders,
  registrationDeliveryKey,
  readGektaAuthJson,
  safeLocale,
  validEmail,
} from '@/lib/server/gekta-auth-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const COPY = {
  ru: { subject: 'Гекта — новая ссылка подтверждения', intro: 'Получен повторный запрос подтверждения email.', action: 'Откройте одноразовую ссылку:', expiry: 'Ссылка действует 30 минут.' },
  en: { subject: 'Gekta — new confirmation link', intro: 'A new email-confirmation request was received.', action: 'Open the single-use link:', expiry: 'The link is valid for 30 minutes.' },
  zh: { subject: 'Gekta — 新的确认链接', intro: '已收到新的电子邮箱确认请求。', action: '请打开一次性链接：', expiry: '链接有效期为30分钟。' },
} as const;

type ApiPayload = { emailDelivery?: { email?: string; token?: string }; cooldownSeconds?: number };

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (!assertCsrf(request).ok) return gektaAuthJson({ accepted: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await readGektaAuthJson(request);
  const email = String(body?.email || '').trim().toLowerCase();
  const locale = safeLocale(body?.locale);
  if (!validEmail(email)) return gektaAuthJson({ accepted: false, code: 'INVALID_EMAIL', correlationId }, 400);

  const upstream = gektaApiBase();
  const deliveryKey = registrationDeliveryKey();
  if (!upstream || deliveryKey.length < 32 || !isTransactionalMailConfigured()) {
    return gektaAuthJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const response = await fetch(`${upstream}/gekta/auth/register/email/resend`, {
      method: 'POST',
      headers: gektaForwardHeaders(request, correlationId, { deliveryKey }),
      body: JSON.stringify({ email }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      return gektaAuthJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 502);
    }
    const payload = await response.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!response.ok) {
      return gektaAuthJson({
        accepted: false,
        code: response.status === 429 ? 'RATE_LIMITED' : 'REGISTRATION_SERVICE_UNAVAILABLE',
        correlationId,
      }, response.status === 429 ? 429 : 503);
    }

    const delivery = payload.emailDelivery;
    if (delivery?.email && delivery.token) {
      const origin = resolveRequestTargetOrigin(request);
      if (!origin) return gektaAuthJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
      const verifyUrl = new URL('/api/gekta/auth/email/verify', origin);
      verifyUrl.searchParams.set('token', delivery.token);
      verifyUrl.searchParams.set('lang', locale);
      const copy = COPY[locale];
      const result = await sendTransactionalMail({
        to: delivery.email,
        subject: copy.subject,
        text: [copy.intro, '', copy.action, verifyUrl.toString(), '', copy.expiry].join('\n'),
      });
      console.info('gekta_registration_resend_delivery_result', JSON.stringify({
        correlationId,
        accountHash: accountHash(email),
        delivered: result.delivered,
        provider: result.provider,
        reason: result.reason,
      }));
      if (!result.delivered) {
        return gektaAuthJson({ accepted: false, code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE', correlationId }, 503);
      }
    }

    return gektaAuthJson({ accepted: true, cooldownSeconds: payload.cooldownSeconds || 60, correlationId }, 202);
  } catch {
    return gektaAuthJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
