import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sendTransactionalMail } from '../../../../lib/server/transactional-mail';
import { assertCsrf } from '../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PUBLIC_WORKSPACES = new Set([
  'seller',
  'buyer',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'employee',
]);

const mailCopy = {
  ru: {
    subject: 'Прозрачная Цена — подтвердите адрес электронной почты',
    intro: 'Заявка на регистрацию на платформе «Прозрачная Цена» принята.',
    action: 'Для подтверждения адреса электронной почты откройте одноразовую ссылку:',
    expiry: 'Ссылка действует 30 минут. После подтверждения адреса заявка будет направлена на проверку.',
  },
  en: {
    subject: 'Transparent Price — confirm your email',
    intro: 'Your application to join the Transparent Price platform has been created.',
    action: 'Confirm your email using this single-use link:',
    expiry: 'The link is valid for 30 minutes. After confirmation, the organization review will begin.',
  },
  zh: {
    subject: '透明价格 — 确认电子邮箱',
    intro: '你加入“透明价格”平台的申请已创建。',
    action: '请使用以下一次性链接确认电子邮箱：',
    expiry: '链接有效期为30分钟。确认后，组织审核将开始。',
  },
} as const;

type Locale = keyof typeof mailCopy;
type RegistrationApiPayload = {
  accepted?: boolean;
  applicationId?: string;
  status?: string;
  nextAction?: string;
  statusToken?: string;
  correlationId?: string;
  emailDelivery?: { email?: string; token?: string; expiresInSeconds?: number };
  retryAfterSeconds?: number;
  code?: string;
  message?: string;
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

function requestIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '';
}

function normalizeOrigin(request: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  return configured || new URL(request.url).origin;
}

function mailChannelConfigured() {
  const resend = Boolean(process.env.RESEND_API_KEY && (process.env.RESEND_FROM_EMAIL || process.env.PC_MAIL_FROM));
  const smtp = Boolean(process.env.PC_SMTP_HOST && process.env.PC_SMTP_USER && process.env.PC_SMTP_PASS);
  return resend || smtp;
}

function accountHash(email: string) {
  return createHash('sha256').update(email).digest('hex').slice(0, 16);
}

function boundedRetryAfterSeconds(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 86_400
    ? Number(value)
    : null;
}

function shouldRetryRegistrationDelivery(result: Awaited<ReturnType<typeof sendTransactionalMail>>) {
  return result.delivered === false
    && result.provider === 'smtp'
    && result.reason.includes('smtp_timeout');
}

async function deliverRegistrationMail(mail: Parameters<typeof sendTransactionalMail>[0]) {
  let attempts = 1;
  let result = await sendTransactionalMail(mail);
  if (shouldRetryRegistrationDelivery(result)) {
    attempts = 2;
    await new Promise((resolve) => setTimeout(resolve, 250));
    result = await sendTransactionalMail(mail);
  }
  return { result, attempts };
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ accepted: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const workspace = String(body.workspace || '').trim();
  const localeValue = String(body.locale || 'ru');
  const locale = (localeValue === 'en' || localeValue === 'zh' ? localeValue : 'ru') as Locale;

  if (
    idempotencyKey.length < 16
    || idempotencyKey.length > 128
    || !/^\S+@\S+\.\S+$/.test(email)
    || email.length > 254
    || !PUBLIC_WORKSPACES.has(workspace)
    || Object.prototype.hasOwnProperty.call(body, 'role')
    || Object.prototype.hasOwnProperty.call(body, 'requestedRole')
  ) {
    return json({ accepted: false, code: 'REGISTRATION_REQUEST_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  const deliveryKey = String(process.env.REGISTRATION_DELIVERY_KEY || '').trim();
  if (!upstream || deliveryKey.length < 32 || !mailChannelConfigured()) {
    console.error('registration_configuration_error', JSON.stringify({
      correlationId,
      apiConfigured: Boolean(upstream),
      deliveryBoundaryConfigured: deliveryKey.length >= 32,
      mailConfigured: mailChannelConfigured(),
    }));
    return json({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const ip = requestIp(request);
    const apiResponse = await fetch(`${upstream}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': idempotencyKey,
        'x-correlation-id': correlationId,
        'x-registration-delivery-key': deliveryKey,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(request.headers.get('user-agent') ? { 'user-agent': String(request.headers.get('user-agent')) } : {}),
      },
      body: JSON.stringify({ ...body, email, workspace }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as RegistrationApiPayload)) as RegistrationApiPayload;

    if (!apiResponse.ok || payload.accepted !== true) {
      const status = apiResponse.status === 409 ? 409 : apiResponse.status === 429 ? 429 : apiResponse.status >= 500 ? 503 : 400;
      const retryAfterSeconds = status === 429 ? boundedRetryAfterSeconds(payload.retryAfterSeconds) : null;
      console.warn('registration_api_rejected', JSON.stringify({
        correlationId,
        status: apiResponse.status,
        code: payload.code || 'UNKNOWN',
        accountHash: accountHash(email),
      }));
      return json({
        accepted: false,
        code: payload.code || (status === 503 ? 'REGISTRATION_SERVICE_UNAVAILABLE' : 'REGISTRATION_REQUEST_INVALID'),
        message: payload.message || null,
        correlationId,
        ...(retryAfterSeconds === null ? {} : { retryAfterSeconds }),
      }, status);
    }

    const delivery = payload.emailDelivery;
    if (!delivery?.email || !delivery.token || !payload.statusToken) {
      console.error('registration_delivery_contract_invalid', JSON.stringify({
        correlationId,
        registrationApplicationRef: payload.applicationId,
        accountHash: accountHash(email),
      }));
      return json({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId: payload.correlationId || correlationId }, 503);
    }
    const verifyUrl = new URL('/platform-v7/register', normalizeOrigin(request));
    verifyUrl.searchParams.set('verify', delivery.token);
    verifyUrl.searchParams.set('statusToken', payload.statusToken);
    verifyUrl.searchParams.set('lang', locale);
    const copy = mailCopy[locale];
    const deliveryAttempt = await deliverRegistrationMail({
      to: delivery.email,
      subject: copy.subject,
      text: [copy.intro, '', copy.action, verifyUrl.toString(), '', copy.expiry].join('\n'),
    });
    const deliveryResult = deliveryAttempt.result;
    console.info('registration_email_delivery_result', JSON.stringify({
      correlationId,
      registrationApplicationRef: payload.applicationId,
      accountHash: accountHash(email),
      delivered: deliveryResult.delivered,
      provider: deliveryResult.provider,
      reason: deliveryResult.reason,
      attempts: deliveryAttempt.attempts,
    }));
    if (!deliveryResult.delivered) {
      console.warn('registration_email_delivery_deferred', JSON.stringify({
        correlationId,
        registrationApplicationRef: payload.applicationId,
        accountHash: accountHash(email),
        attempts: deliveryAttempt.attempts,
      }));
      return json({
        accepted: false,
        code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE',
        correlationId: payload.correlationId || correlationId,
      }, 503);
    }

    return json({
      accepted: true,
      status: 'EMAIL_VERIFICATION_REQUIRED',
      nextAction: 'VERIFY_EMAIL',
      correlationId: payload.correlationId || correlationId,
    }, 202);
  } catch (error) {
    console.error('registration_transport_failure', JSON.stringify({
      correlationId,
      accountHash: accountHash(email),
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
