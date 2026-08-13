import { randomUUID } from 'node:crypto';
import { assertCsrf } from '@/lib/server-request-security';
import {
  GEKTA_AUTH_TIMEOUT_MS,
  gektaApiBase,
  gektaAuthJson,
  gektaForwardHeaders,
  registrationDeliveryKey,
} from '@/lib/server/gekta-auth-route';
import {
  GEKTA_MFA_PENDING_COOKIE,
  gektaMfaCookieOptions,
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

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (!assertCsrf(request).ok) return gektaAuthJson({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const token = String(body.token || '').trim();
  if (token.length < 32 || token.length > 1_024) {
    return gektaAuthJson({ ok: false, code: 'REGISTRATION_EMAIL_TOKEN_INVALID', correlationId }, 400);
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
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!response.ok) {
      const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
      return gektaAuthJson({
        ok: false,
        code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'REGISTRATION_SERVICE_UNAVAILABLE' : 'REGISTRATION_EMAIL_TOKEN_INVALID',
        correlationId,
      }, status);
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
    return result;
  } catch {
    return gektaAuthJson({ ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
