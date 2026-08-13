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
  ru: {
    subject: 'Гекта — подтвердите email',
    intro: 'Получен запрос на регистрацию в Гекте.',
    action: 'Подтвердите email по одноразовой ссылке:',
    expiry: 'Ссылка действует 30 минут. Затем настройте обязательный второй фактор, и начнётся 30-дневный пробный период.',
  },
  en: {
    subject: 'Gekta — confirm your email',
    intro: 'A request to create a Gekta account was received.',
    action: 'Confirm your email using this single-use link:',
    expiry: 'The link is valid for 30 minutes. Next, set up the required second factor to start the 30-day trial.',
  },
  zh: {
    subject: 'Gekta — 确认电子邮箱',
    intro: '已收到创建 Gekta 账户的请求。',
    action: '请使用以下一次性链接确认电子邮箱：',
    expiry: '链接有效期为30分钟。随后设置必需的双重验证，即可开始30天试用。',
  },
} as const;

type ApiPayload = {
  status?: string;
  emailDelivery?: { email?: string; token?: string };
  code?: string;
};

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (!assertCsrf(request).ok) return gektaAuthJson({ accepted: false, code: 'CSRF_REJECTED', correlationId }, 403);

  const body = await readGektaAuthJson(request);
  if (!body) return gektaAuthJson({ accepted: false, code: 'REGISTRATION_REQUEST_INVALID', correlationId }, 400);
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '');
  const locale = safeLocale(body.locale);
  const passwordClasses = [/[a-z]/u, /[A-Z]/u, /\d/u, /[^A-Za-z0-9]/u]
    .filter((pattern) => pattern.test(password)).length;
  const phoneDigits = phone.replace(/\D/gu, '');
  if (
    !validEmail(email)
    || fullName.length < 2
    || fullName.length > 120
    || phone.length > 32
    || phoneDigits.length < 10
    || phoneDigits.length > 15
    || password.length < 12
    || password.length > 128
    || passwordClasses < 3
    || body.acceptedServiceTerms !== true
    || body.acceptedPersonalData !== true
  ) {
    return gektaAuthJson({ accepted: false, code: 'REGISTRATION_REQUEST_INVALID', correlationId }, 400);
  }

  const upstream = gektaApiBase();
  const deliveryKey = registrationDeliveryKey();
  if (!upstream || deliveryKey.length < 32 || !isTransactionalMailConfigured()) {
    console.error('gekta_registration_configuration_error', JSON.stringify({
      correlationId,
      apiConfigured: Boolean(upstream),
      deliveryBoundaryConfigured: deliveryKey.length >= 32,
      mailConfigured: isTransactionalMailConfigured(),
    }));
    return gektaAuthJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const response = await fetch(`${upstream}/gekta/auth/register`, {
      method: 'POST',
      headers: gektaForwardHeaders(request, correlationId, { deliveryKey }),
      body: JSON.stringify({
        email,
        fullName,
        phone,
        password,
        acceptedServiceTerms: true,
        acceptedPersonalData: true,
      }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      return gektaAuthJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 502);
    }
    const payload = await response.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!response.ok) {
      const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
      console.warn('gekta_registration_api_rejected', JSON.stringify({
        correlationId,
        status: response.status,
        accountHash: accountHash(email),
      }));
      return gektaAuthJson({
        accepted: false,
        code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'REGISTRATION_SERVICE_UNAVAILABLE' : 'REGISTRATION_REQUEST_INVALID',
        correlationId,
      }, status);
    }

    const delivery = payload.emailDelivery;
    if (delivery?.email && delivery.token) {
      const origin = resolveRequestTargetOrigin(request);
      if (!origin) return gektaAuthJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
      const verifyUrl = new URL('/api/gekta/auth/email/verify', origin);
      verifyUrl.searchParams.set('token', delivery.token);
      verifyUrl.searchParams.set('lang', locale);
      const copy = COPY[locale];
      const delivered = await sendTransactionalMail({
        to: delivery.email,
        subject: copy.subject,
        text: [copy.intro, '', copy.action, verifyUrl.toString(), '', copy.expiry].join('\n'),
      });
      console.info('gekta_registration_email_delivery_result', JSON.stringify({
        correlationId,
        accountHash: accountHash(email),
        delivered: delivered.delivered,
        provider: delivered.provider,
        reason: delivered.reason,
      }));
      if (!delivered.delivered) {
        return gektaAuthJson({ accepted: false, code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE', correlationId }, 503);
      }
    } else {
      // Unknown/already-used email and a newly accepted email deliberately have
      // the same public response. The bearer token never crosses this BFF.
      console.info('gekta_registration_public_request_accepted', JSON.stringify({
        correlationId,
        accountHash: accountHash(email),
      }));
    }

    return gektaAuthJson({
      accepted: true,
      status: 'EMAIL_VERIFICATION_REQUIRED',
      correlationId,
    }, 202);
  } catch (error) {
    console.error('gekta_registration_transport_failure', JSON.stringify({
      correlationId,
      accountHash: accountHash(email),
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return gektaAuthJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
