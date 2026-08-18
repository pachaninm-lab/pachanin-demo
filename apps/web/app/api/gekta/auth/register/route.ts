import { randomUUID } from 'node:crypto';
import { assertCsrf } from '@/lib/server-request-security';
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

type ApiPayload = {
  status?: string;
  delivery?: 'QUEUED' | 'SUPPRESSED';
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
  if (!upstream || deliveryKey.length < 32) {
    console.error('gekta_registration_configuration_error', JSON.stringify({
      correlationId,
      apiConfigured: Boolean(upstream),
      deliveryBoundaryConfigured: deliveryKey.length >= 32,
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
        locale,
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

    // The API commits the one-time challenge and encrypted auth-mail outbox row
    // atomically. The Web BFF never receives a verification bearer and never
    // owns SMTP credentials for this path.
    console.info('gekta_registration_public_request_accepted', JSON.stringify({
      correlationId,
      accountHash: accountHash(email),
      durableMailBoundary: true,
    }));

    return gektaAuthJson({
      accepted: true,
      status: payload.status || 'EMAIL_VERIFICATION_REQUIRED',
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
