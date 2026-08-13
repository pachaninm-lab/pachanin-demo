import { assertCsrf } from '@/lib/server-request-security';
import {
  accountHash,
  authJson,
  correlationId,
  mailChannelConfigured,
  postGektaAuth,
  readSmallJson,
} from '@/lib/server/gekta-auth-bff';
import {
  gektaRegistrationLocale,
  sendGektaVerificationMail,
} from '@/lib/server/gekta-registration-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
function validPassword(password: string) {
  const classes = [/[a-z]/u, /[A-Z]/u, /\d/u, /[^A-Za-z0-9]/u]
    .filter((pattern) => pattern.test(password)).length;
  return password.length >= 12 && password.length <= 128 && classes >= 3;
}

export async function POST(request: Request) {
  const id = correlationId(request);
  if (!assertCsrf(request).ok) return authJson({ accepted: false, code: 'CSRF_REJECTED', correlationId: id }, 403);
  const body = await readSmallJson(request);
  if (!body) return authJson({ accepted: false, code: 'REGISTRATION_REQUEST_INVALID', correlationId: id }, 400);

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.fullName || '').trim();
  const phone = String(body.phone || '').trim();
  const locale = gektaRegistrationLocale(body.locale);
  const phoneDigits = phone.replace(/\D/gu, '');
  if (
    email.length > 254
    || !EMAIL.test(email)
    || fullName.length < 2
    || fullName.length > 120
    || phone.length > 32
    || phoneDigits.length < 10
    || phoneDigits.length > 15
    || !validPassword(password)
    || body.acceptedServiceTerms !== true
    || body.acceptedPersonalData !== true
  ) {
    return authJson({ accepted: false, code: 'REGISTRATION_REQUEST_INVALID', correlationId: id }, 400);
  }

  const deliveryKey = String(process.env.REGISTRATION_DELIVERY_KEY || '').trim();
  if (deliveryKey.length < 32 || !mailChannelConfigured()) {
    console.error('gekta_registration_configuration_error', JSON.stringify({
      correlationId: id,
      deliveryBoundaryConfigured: deliveryKey.length >= 32,
      mailConfigured: mailChannelConfigured(),
    }));
    return authJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId: id }, 503);
  }

  const upstream = await postGektaAuth(request, 'register', {
    email,
    password,
    fullName,
    phone,
    acceptedServiceTerms: true,
    acceptedPersonalData: true,
  }, { 'X-Registration-Delivery-Key': deliveryKey });

  if (!upstream.ok) {
    const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 503 : 400;
    console.warn('gekta_registration_api_rejected', JSON.stringify({
      correlationId: id,
      status: upstream.status,
      accountHash: accountHash(email),
      code: String(upstream.payload.code || 'UNKNOWN').slice(0, 80),
    }));
    return authJson({
      accepted: false,
      code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'REGISTRATION_SERVICE_UNAVAILABLE' : 'REGISTRATION_REQUEST_INVALID',
      correlationId: id,
    }, status);
  }

  const delivery = upstream.payload.emailDelivery;
  if (delivery && typeof delivery === 'object' && !Array.isArray(delivery)) {
    const target = delivery as Record<string, unknown>;
    const deliveryEmail = typeof target.email === 'string' ? target.email : '';
    const token = typeof target.token === 'string' ? target.token : '';
    if (!deliveryEmail || !token) {
      return authJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId: id }, 503);
    }
    const sent = await sendGektaVerificationMail({ request, email: deliveryEmail, token, locale });
    console.info('gekta_registration_email_delivery_result', JSON.stringify({
      correlationId: id,
      accountHash: accountHash(email),
      delivered: sent.delivered,
      provider: sent.provider,
      reason: sent.reason,
    }));
    if (!sent.delivered) {
      return authJson({ accepted: false, code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE', correlationId: id }, 503);
    }
  }

  // The response is deliberately identical when the email was already used.
  return authJson({
    accepted: true,
    status: 'EMAIL_VERIFICATION_REQUIRED',
    correlationId: id,
  }, 202);
}
