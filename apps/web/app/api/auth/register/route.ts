import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertCsrf } from '../../../../lib/server-request-security';

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

type RegistrationApiPayload = {
  accepted?: boolean;
  applicationId?: string;
  status?: string;
  nextAction?: string;
  statusToken?: string;
  emailQueued?: boolean;
  correlationId?: string;
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

function accountHash(email: string) {
  return createHash('sha256').update(email).digest('hex').slice(0, 16);
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ accepted: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const workspace = String(body.workspace || '').trim();
  const locale = body.locale === 'en' || body.locale === 'zh' ? body.locale : 'ru';

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
  if (!upstream) {
    console.error('registration_configuration_error', JSON.stringify({ correlationId, apiConfigured: false }));
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
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(request.headers.get('user-agent') ? { 'user-agent': String(request.headers.get('user-agent')) } : {}),
      },
      body: JSON.stringify({ ...body, email, workspace, locale }),
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

    if (payload.applicationId && payload.emailQueued !== true) {
      console.error('registration_mail_queue_contract_invalid', JSON.stringify({
        correlationId,
        registrationApplicationRef: payload.applicationId,
        accountHash: accountHash(email),
      }));
      return json({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId: payload.correlationId || correlationId }, 503);
    }

    console.info('registration_mail_queued', JSON.stringify({
      correlationId,
      registrationApplicationRef: payload.applicationId || null,
      accountHash: accountHash(email),
      queued: payload.emailQueued === true,
    }));
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
