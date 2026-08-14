import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertCsrf } from '../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const UNIVERSAL_MESSAGE = 'If the account exists, password reset instructions will be sent.';
const SUPPORTED_LOCALES = new Set(['ru', 'en', 'zh']);

type ApiPayload = {
  accepted?: boolean;
  message?: string;
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
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '';
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ accepted: false, code: 'CSRF_REJECTED', correlationId }, 403);

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const locale = SUPPORTED_LOCALES.has(String(body.locale)) ? String(body.locale) : 'ru';

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return json({ accepted: false, code: 'INVALID_EMAIL', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  const deliveryKey = String(process.env.PASSWORD_RESET_DELIVERY_KEY || '').trim();
  if (!upstream || deliveryKey.length < 32) {
    console.error('password_reset_request_configuration_error', JSON.stringify({
      correlationId,
      apiConfigured: Boolean(upstream),
      deliveryBoundaryConfigured: deliveryKey.length >= 32,
    }));
    return json({ accepted: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
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
      body: JSON.stringify({ email, locale }),
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
      if (apiResponse.status === 429) {
        return json({ accepted: false, code: 'RATE_LIMITED', correlationId }, 429);
      }
      return json({ accepted: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
    }

    console.info('password_reset_request_queued', JSON.stringify({
      correlationId,
      accountHash: emailHash(email),
      accepted: payload.accepted !== false,
    }));
    return json({
      accepted: true,
      message: payload.message || UNIVERSAL_MESSAGE,
      cooldownSeconds: 60,
      correlationId,
    });
  } catch (error) {
    console.error('password_reset_request_transport_failure', JSON.stringify({
      correlationId,
      accountHash: emailHash(email),
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ accepted: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
