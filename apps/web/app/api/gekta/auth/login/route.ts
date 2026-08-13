import { randomUUID } from 'node:crypto';
import { assertCsrf } from '@/lib/server-request-security';
import {
  GEKTA_AUTH_TIMEOUT_MS,
  gektaApiBase,
  gektaAuthJson,
  gektaForwardHeaders,
  validEmail,
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
  challengeToken?: string;
  expiresAt?: string;
  setupSecret?: string;
  otpAuthUri?: string;
};

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (!assertCsrf(request).ok) return gektaAuthJson({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!validEmail(email) || !password || password.length > 128) {
    return gektaAuthJson({ ok: false, code: 'INVALID_CREDENTIALS', correlationId }, 401);
  }
  const upstream = gektaApiBase();
  if (!upstream) return gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);

  try {
    const response = await fetch(`${upstream}/gekta/auth/login`, {
      method: 'POST',
      headers: gektaForwardHeaders(request, correlationId),
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!response.ok) {
      return gektaAuthJson({
        ok: false,
        code: response.status === 429 ? 'RATE_LIMITED' : 'INVALID_CREDENTIALS',
        correlationId,
      }, response.status === 429 ? 429 : 401);
    }
    if (payload.status !== 'MFA_REQUIRED' || !payload.challengeToken) {
      return gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', correlationId }, 502);
    }

    let ticket: string;
    try {
      ticket = sealGektaMfaTicket({
        challengeToken: payload.challengeToken,
        email,
        enrollment: Boolean(payload.setupSecret),
        ...(payload.setupSecret ? { setupSecret: payload.setupSecret } : {}),
        ...(payload.otpAuthUri ? { otpAuthUri: payload.otpAuthUri } : {}),
      });
    } catch {
      return gektaAuthJson({ ok: false, code: 'MFA_UNAVAILABLE', correlationId }, 503);
    }

    const result = gektaAuthJson({
      ok: true,
      mfaRequired: true,
      enrollmentRequired: Boolean(payload.setupSecret),
      setupSecret: payload.setupSecret || null,
      otpAuthUri: payload.otpAuthUri || null,
      expiresAt: payload.expiresAt || null,
      correlationId,
    });
    result.cookies.set(GEKTA_MFA_PENDING_COOKIE, ticket, gektaMfaCookieOptions());
    return result;
  } catch {
    return gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
