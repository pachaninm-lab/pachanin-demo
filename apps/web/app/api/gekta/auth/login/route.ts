import { assertCsrf } from '@/lib/server-request-security';
import { authJson, correlationId, postGektaAuth, readSmallJson } from '@/lib/server/gekta-auth-bff';
import { sealGektaMfaTicket, setGektaMfaTicket } from '@/lib/server/gekta-mfa-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export async function POST(request: Request) {
  const id = correlationId(request);
  if (!assertCsrf(request).ok) return authJson({ ok: false, code: 'CSRF_REJECTED', correlationId: id }, 403);
  const body = await readSmallJson(request);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!EMAIL.test(email) || email.length > 254 || password.length < 1 || password.length > 128) {
    return authJson({ ok: false, code: 'INVALID_CREDENTIALS', correlationId: id }, 401);
  }

  const upstream = await postGektaAuth(request, 'login', { email, password });
  const challengeToken = String(upstream.payload.challengeToken || '');
  const expiresAt = String(upstream.payload.expiresAt || '');
  const setupSecret = typeof upstream.payload.setupSecret === 'string' ? upstream.payload.setupSecret : '';
  const otpAuthUri = typeof upstream.payload.otpAuthUri === 'string' && upstream.payload.otpAuthUri.startsWith('otpauth://')
    ? upstream.payload.otpAuthUri
    : '';
  // The API contract may express first-factor enrollment either explicitly or
  // by returning its one-time setup material. The browser sees one normalized
  // boolean and never receives the upstream challenge bearer.
  const enrollmentRequired = upstream.payload.enrollmentRequired === true
    || Boolean(setupSecret || otpAuthUri);
  const sealed = upstream.ok
    ? sealGektaMfaTicket({ challengeToken, expiresAt, enrollmentRequired })
    : null;
  if (!upstream.ok || !sealed) {
    const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 503 : 401;
    return authJson({
      ok: false,
      code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'INVALID_CREDENTIALS',
      correlationId: id,
    }, status);
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
  return response;
}
