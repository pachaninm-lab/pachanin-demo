import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { assertCsrf, resolveRequestTargetOrigin } from '@/lib/server-request-security';
import {
  GEKTA_AUTH_TIMEOUT_MS,
  gektaApiBase,
  gektaAuthJson,
  gektaForwardHeaders,
  registrationDeliveryKey,
  safeLocale,
} from '@/lib/server/gekta-auth-route';
import {
  GEKTA_EMAIL_PENDING_COOKIE,
  GEKTA_MFA_PENDING_COOKIE,
  clearGektaEmailCookieOptions,
  gektaEmailCookieOptions,
  gektaMfaCookieOptions,
  openGektaEmailTicket,
  sealGektaEmailTicket,
  sealGektaMfaTicket,
} from '@/lib/server/gekta-mfa-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApiPayload = {
  status?: string;
  email?: string;
  challengeToken?: string;
  expiresAt?: string;
  setupSecret?: string;
  otpAuthUri?: string;
  declaredPhone?: string;
};

export function GET(request: Request) {
  const url = new URL(request.url);
  const locale = safeLocale(url.searchParams.get('lang'));
  const origin = resolveRequestTargetOrigin(request);
  if (!origin) return gektaAuthJson({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE' }, 503);

  let ticket = '';
  try {
    ticket = sealGektaEmailTicket(String(url.searchParams.get('token') || '').trim());
  } catch {
    ticket = '';
  }
  const target = new URL('/gekta/register', origin);
  target.searchParams.set('lang', locale);
  target.searchParams.set('confirm', ticket ? 'email' : 'invalid');
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (ticket) response.cookies.set(GEKTA_EMAIL_PENDING_COOKIE, ticket, gektaEmailCookieOptions());
  return response;
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (!assertCsrf(request).ok) return gektaAuthJson({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const token = openGektaEmailTicket((await cookies()).get(GEKTA_EMAIL_PENDING_COOKIE)?.value || '');
  if (!token) {
    const response = gektaAuthJson({ ok: false, code: 'REGISTRATION_EMAIL_TOKEN_INVALID', correlationId }, 400);
    response.cookies.set(GEKTA_EMAIL_PENDING_COOKIE, '', clearGektaEmailCookieOptions());
    return response;
  }
  const upstream = gektaApiBase();
  const deliveryKey = registrationDeliveryKey();
  if (!upstream || deliveryKey.length < 32) {
    return gektaAuthJson({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const response = await fetch(`${upstream}/gekta/auth/register/email/verify`, {
      method: 'POST',
      headers: gektaForwardHeaders(request, correlationId, { deliveryKey }),
      body: JSON.stringify({ token }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      return gektaAuthJson({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 502);
    }
    const payload = await response.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!response.ok) {
      const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
      const result = gektaAuthJson({
        ok: false,
        code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'REGISTRATION_SERVICE_UNAVAILABLE' : 'REGISTRATION_EMAIL_TOKEN_INVALID',
        correlationId,
      }, status);
      if (status === 400) result.cookies.set(GEKTA_EMAIL_PENDING_COOKIE, '', clearGektaEmailCookieOptions());
      return result;
    }
    if (
      payload.status !== 'MFA_ENROLLMENT_REQUIRED'
      || !payload.challengeToken
      || !payload.setupSecret
      || !payload.otpAuthUri
      || !payload.email
      || !payload.declaredPhone
    ) {
      console.error('gekta_email_verification_contract_invalid', JSON.stringify({ correlationId }));
      return gektaAuthJson({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 502);
    }

    let ticket: string;
    try {
      ticket = sealGektaMfaTicket({
        challengeToken: payload.challengeToken,
        email: payload.email,
        enrollment: true,
        setupSecret: payload.setupSecret,
        otpAuthUri: payload.otpAuthUri,
        declaredPhone: payload.declaredPhone,
      });
    } catch {
      return gektaAuthJson({ ok: false, code: 'MFA_UNAVAILABLE', correlationId }, 503);
    }

    const result = gektaAuthJson({
      ok: true,
      mfaRequired: true,
      enrollmentRequired: true,
      setupSecret: payload.setupSecret,
      otpAuthUri: payload.otpAuthUri,
      expiresAt: payload.expiresAt || null,
      correlationId,
    });
    result.cookies.set(GEKTA_MFA_PENDING_COOKIE, ticket, gektaMfaCookieOptions());
    result.cookies.set(GEKTA_EMAIL_PENDING_COOKIE, '', clearGektaEmailCookieOptions());
    return result;
  } catch {
    return gektaAuthJson({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
