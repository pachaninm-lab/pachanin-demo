import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/server-request-security';
import { authJson, correlationId, postGektaAuth, publicOrigin } from '@/lib/server/gekta-auth-bff';
import {
  GEKTA_EMAIL_TICKET_COOKIE,
  clearGektaEmailTicket,
  openGektaEmailTicket,
  sealGektaEmailTicket,
  sealGektaMfaTicket,
  setGektaEmailTicket,
  setGektaMfaTicket,
} from '@/lib/server/gekta-mfa-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get('token') || '').trim();
  const locale = url.searchParams.get('lang') === 'en' || url.searchParams.get('lang') === 'zh'
    ? String(url.searchParams.get('lang'))
    : 'ru';
  const sealed = sealGektaEmailTicket(token);
  const target = new URL('/gekta/register', publicOrigin(request));
  target.searchParams.set('lang', locale);
  target.searchParams.set('confirm', sealed ? 'email' : 'invalid');
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Referrer-Policy', 'no-referrer');
  if (sealed) setGektaEmailTicket(response, sealed);
  return response;
}

export async function POST(request: Request) {
  const id = correlationId(request);
  if (!assertCsrf(request).ok) return authJson({ ok: false, code: 'CSRF_REJECTED', correlationId: id }, 403);
  const jar = await cookies();
  const token = openGektaEmailTicket(jar.get(GEKTA_EMAIL_TICKET_COOKIE)?.value);
  if (!token) {
    return authJson({ ok: false, code: 'EMAIL_LINK_INVALID', correlationId: id }, 400);
  }

  const upstream = await postGektaAuth(request, 'register/email/verify', { token });
  const challengeToken = String(upstream.payload.challengeToken || '');
  const expiresAt = String(upstream.payload.expiresAt || '');
  const setupSecret = typeof upstream.payload.setupSecret === 'string' ? upstream.payload.setupSecret : '';
  const otpAuthUri = typeof upstream.payload.otpAuthUri === 'string' && upstream.payload.otpAuthUri.startsWith('otpauth://')
    ? upstream.payload.otpAuthUri
    : '';
  const enrollmentRequired = upstream.payload.enrollmentRequired === true
    || Boolean(setupSecret || otpAuthUri);
  const sealed = upstream.ok
    ? sealGektaMfaTicket({ challengeToken, expiresAt, enrollmentRequired })
    : null;
  if (!upstream.ok || !sealed) {
    const status = upstream.status >= 500 ? 503 : upstream.status === 429 ? 429 : 400;
    const response = authJson({
      ok: false,
      code: status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : status === 429 ? 'RATE_LIMITED' : 'EMAIL_LINK_INVALID',
      correlationId: id,
    }, status);
    if (status === 400) clearGektaEmailTicket(response);
    return response;
  }

  if (enrollmentRequired && (!setupSecret || !otpAuthUri)) {
    return authJson({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', correlationId: id }, 502);
  }

  const response = authJson({
    ok: true,
    status: 'MFA_REQUIRED',
    enrollmentRequired,
    expiresAt,
    ...(setupSecret ? { setupSecret } : {}),
    ...(otpAuthUri ? { otpAuthUri } : {}),
    correlationId: id,
  });
  setGektaMfaTicket(response, sealed, expiresAt);
  clearGektaEmailTicket(response);
  return response;
}
