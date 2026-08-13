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

export async function POST(request: Request) {
  const id = correlationId(request);
  if (!assertCsrf(request).ok) return authJson({ accepted: false, code: 'CSRF_REJECTED', correlationId: id }, 403);
  const body = await readSmallJson(request);
  const email = String(body?.email || '').trim().toLowerCase();
  const locale = gektaRegistrationLocale(body?.locale);
  if (!EMAIL.test(email) || email.length > 254) {
    return authJson({ accepted: false, code: 'REGISTRATION_REQUEST_INVALID', correlationId: id }, 400);
  }

  const deliveryKey = String(process.env.REGISTRATION_DELIVERY_KEY || '').trim();
  if (deliveryKey.length < 32 || !mailChannelConfigured()) {
    return authJson({ accepted: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE', correlationId: id }, 503);
  }

  const upstream = await postGektaAuth(
    request,
    'register/email/resend',
    { email },
    { 'X-Registration-Delivery-Key': deliveryKey },
  );
  if (!upstream.ok) {
    const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 503 : 400;
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
    console.info('gekta_registration_email_resend_result', JSON.stringify({
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

  // Unknown, active, cooling-down and pending addresses have one public reply.
  return authJson({ accepted: true, correlationId: id }, 202);
}
