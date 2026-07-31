import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sendTransactionalMail } from '../../../../lib/server/transactional-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

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
    subject: 'Прозрачная Цена — подтвердите email',
    intro: 'Заявка на подключение к платформе «Прозрачная Цена» создана.',
    action: 'Подтвердите email по одноразовой ссылке:',
    expiry: 'Ссылка действует 30 минут. После подтверждения заявка перейдёт на проверку организации.',
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

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
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
      }, status);
    }

    const delivery = payload.emailDelivery;
    if (delivery?.email && delivery.token && payload.statusToken) {
      const verifyUrl = new URL('/platform-v7/register', normalizeOrigin(request));
      verifyUrl.searchParams.set('verify', delivery.token);
      verifyUrl.searchParams.set('statusToken', payload.statusToken);
      verifyUrl.searchParams.set('lang', locale);
      const copy = mailCopy[locale];
      const deliveryResult = await sendTransactionalMail({
        to: delivery.email,
        subject: copy.subject,
        text: [copy.intro, '', copy.action, verifyUrl.toString(), '', copy.expiry].join('\n'),
      });
      console.info('registration_email_delivery_result', JSON.stringify({
        correlationId,
        applicationId: payload.applicationId,
        accountHash: accountHash(email),
        delivered: deliveryResult.delivered,
        provider: deliveryResult.provider,
        reason: deliveryResult.reason,
      }));
      if (!deliveryResult.delivered) {
        return json({ accepted: false, code: 'REGISTRATION_EMAIL_UNAVAILABLE', correlationId }, 503);
      }
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
