import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sendTransactionalMail } from '../../../../../lib/server/transactional-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const UNIVERSAL_MESSAGE = 'If the account exists, password reset instructions will be sent.';
const SUPPORTED_LOCALES = new Set(['ru', 'en', 'zh']);

const mailCopy = {
  ru: {
    subject: 'Прозрачная Цена — восстановление доступа',
    intro: 'Получен запрос на восстановление доступа к платформе «Прозрачная Цена».',
    action: 'Чтобы установить новый пароль, открой ссылку:',
    expiry: 'Ссылка действует 15 минут и может быть использована только один раз.',
    ignore: 'Если запрос отправил не ты, ничего не делай. Действующие сессии не изменятся.',
  },
  en: {
    subject: 'Transparent Price — restore access',
    intro: 'A request was received to restore access to the Transparent Price platform.',
    action: 'Open this link to set a new password:',
    expiry: 'The link is valid for 15 minutes and can be used only once.',
    ignore: 'If you did not make this request, no action is required. Existing sessions will remain unchanged.',
  },
  zh: {
    subject: '透明价格 — 恢复访问权限',
    intro: '我们收到了恢复“透明价格”平台访问权限的请求。',
    action: '请打开以下链接设置新密码：',
    expiry: '该链接有效期为15分钟且只能使用一次。',
    ignore: '如果不是你发起的请求，无需操作。现有会话不会改变。',
  },
} as const;

type Locale = keyof typeof mailCopy;
type ApiPayload = {
  accepted?: boolean;
  delivery?: { email?: string; token?: string; expiresInSeconds?: number };
};

function json(body: Record<string, unknown>, status = 202) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function emailHash(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
}

function requestIp(request: Request) {
  return request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '';
}

function apiUrl() {
  return String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
}

function normalizeOrigin(request: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  return configured || new URL(request.url).origin;
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const locale = SUPPORTED_LOCALES.has(String(body.locale)) ? String(body.locale) as Locale : 'ru';

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return json({ accepted: false, code: 'INVALID_EMAIL', correlationId }, 400);
  }

  const upstream = apiUrl();
  const deliveryKey = String(process.env.PASSWORD_RESET_DELIVERY_KEY || '').trim();
  if (!upstream || deliveryKey.length < 32) {
    console.error('password_reset_request_configuration_error', JSON.stringify({
      correlationId,
      apiConfigured: Boolean(upstream),
      deliveryBoundaryConfigured: deliveryKey.length >= 32,
    }));
    return json({ accepted: true, message: UNIVERSAL_MESSAGE, cooldownSeconds: 60, correlationId });
  }

  try {
    const ip = requestIp(request);
    const apiResponse = await fetch(`${upstream}/auth/password-reset/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-password-reset-delivery-key': deliveryKey,
        'x-correlation-id': correlationId,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
      },
      body: JSON.stringify({ email }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as ApiPayload)) as ApiPayload;

    if (!apiResponse.ok) {
      console.error('password_reset_request_api_failure', JSON.stringify({
        correlationId,
        status: apiResponse.status,
        accountHash: emailHash(email),
      }));
      return json({ accepted: true, message: UNIVERSAL_MESSAGE, cooldownSeconds: 60, correlationId });
    }

    const delivery = payload.delivery;
    if (delivery?.email && delivery.token) {
      const resetUrl = new URL('/platform-v7/reset-password', normalizeOrigin(request));
      resetUrl.searchParams.set('token', delivery.token);
      resetUrl.searchParams.set('lang', locale);
      const copy = mailCopy[locale];
      const result = await sendTransactionalMail({
        to: delivery.email,
        subject: copy.subject,
        text: [copy.intro, '', copy.action, resetUrl.toString(), '', copy.expiry, copy.ignore].join('\n'),
      });
      console.info('password_reset_delivery_result', JSON.stringify({
        correlationId,
        accountHash: emailHash(email),
        delivered: result.delivered,
        provider: result.provider,
        reason: result.reason,
      }));
    } else {
      console.info('password_reset_request_accepted_without_delivery', JSON.stringify({
        correlationId,
        accountHash: emailHash(email),
      }));
    }
  } catch (error) {
    console.error('password_reset_request_transport_failure', JSON.stringify({
      correlationId,
      accountHash: emailHash(email),
      reason: error instanceof Error ? error.name : 'unknown',
    }));
  }

  return json({ accepted: true, message: UNIVERSAL_MESSAGE, cooldownSeconds: 60, correlationId });
}
