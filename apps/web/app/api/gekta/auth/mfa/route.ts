import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { assertCsrf } from '@/lib/server-request-security';
import {
  GEKTA_AUTH_TIMEOUT_MS,
  gektaApiBase,
  gektaAuthJson,
  gektaForwardHeaders,
  readGektaAuthJson,
} from '@/lib/server/gekta-auth-route';
import {
  GEKTA_MFA_PENDING_COOKIE,
  clearGektaMfaCookieOptions,
  openGektaMfaTicket,
} from '@/lib/server/gekta-mfa-ticket';
import {
  applyGektaAuthenticatedSession,
  type GektaAuthenticatedSessionPayload,
} from '@/lib/server/auth-session-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ActivePayload = Partial<GektaAuthenticatedSessionPayload> & {
  status?: string;
  backupCodes?: unknown;
};

async function pendingTicket() {
  const raw = (await cookies()).get(GEKTA_MFA_PENDING_COOKIE)?.value || '';
  return openGektaMfaTicket(raw);
}

export async function GET() {
  const ticket = await pendingTicket();
  if (!ticket) {
    const response = gektaAuthJson({ ok: false, code: 'MFA_SESSION_EXPIRED' }, 401);
    response.cookies.set(GEKTA_MFA_PENDING_COOKIE, '', clearGektaMfaCookieOptions());
    return response;
  }
  return gektaAuthJson({
    ok: true,
    mfaRequired: true,
    enrollmentRequired: ticket.enrollment,
    setupSecret: ticket.setupSecret || null,
    otpAuthUri: ticket.otpAuthUri || null,
  });
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (!assertCsrf(request).ok) return gektaAuthJson({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await readGektaAuthJson(request);
  const code = String(body?.code || '').trim();
  const ticket = await pendingTicket();
  if (!ticket || !code || code.length > 128) {
    const response = gektaAuthJson({ ok: false, code: 'MFA_INVALID', correlationId }, 401);
    if (!ticket) response.cookies.set(GEKTA_MFA_PENDING_COOKIE, '', clearGektaMfaCookieOptions());
    return response;
  }
  const upstream = gektaApiBase();
  if (!upstream) return gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);

  try {
    const response = await fetch(`${upstream}/gekta/auth/mfa/verify`, {
      method: 'POST',
      headers: gektaForwardHeaders(request, correlationId),
      body: JSON.stringify({ challengeToken: ticket.challengeToken, code }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      return gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 502);
    }
    const payload = await response.json().catch(() => ({} as ActivePayload)) as ActivePayload;
    if (
      !response.ok
      || payload.status !== 'ACTIVE'
      || !payload.accessToken
      || !payload.refreshToken
      || !payload.user?.id
      || !payload.user.email
    ) {
      return gektaAuthJson({
        ok: false,
        code: response.status === 429 ? 'RATE_LIMITED' : 'MFA_INVALID',
        correlationId,
      }, response.status === 429 ? 429 : 401);
    }

    const accountHeaders = gektaForwardHeaders(request, correlationId, { accessToken: payload.accessToken });
    const entitlementResponse = await fetch(`${upstream}/gekta/entitlement`, {
      method: 'GET',
      headers: accountHeaders,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    const entitlementPayload = entitlementResponse.ok
      ? await entitlementResponse.json().catch(() => null) as Record<string, unknown> | null
      : null;
    // ensureAccount is deliberately completed before phone linking. Running
    // both first-account requests in parallel would race the unique userId.
    const phoneResponse = entitlementResponse.ok && ticket.declaredPhone
      ? await fetch(`${upstream}/gekta/phone`, {
          method: 'POST',
          headers: accountHeaders,
          body: JSON.stringify({ phone: ticket.declaredPhone }),
          cache: 'no-store',
          redirect: 'manual',
          signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
        })
      : null;
    const phonePayload = phoneResponse?.ok
      ? await phoneResponse.json().catch(() => null) as Record<string, unknown> | null
      : null;
    if (!entitlementResponse.ok) {
      console.error('gekta_trial_initialization_failed', JSON.stringify({ correlationId, status: entitlementResponse.status }));
    }
    if (ticket.declaredPhone && !phoneResponse?.ok) {
      console.error('gekta_declared_phone_link_failed', JSON.stringify({ correlationId, status: phoneResponse?.status || 0 }));
    }

    const backupCodes = Array.isArray(payload.backupCodes)
      ? payload.backupCodes.filter((item): item is string => typeof item === 'string').slice(0, 20)
      : [];
    const result = gektaAuthJson({
      ok: true,
      redirectTo: '/gekta',
      entitlement: entitlementPayload?.entitlement || null,
      phoneState: typeof phonePayload?.state === 'string' ? phonePayload.state : null,
      ...(backupCodes.length ? { backupCodes } : {}),
      correlationId,
    });
    if (!applyGektaAuthenticatedSession(result, payload as GektaAuthenticatedSessionPayload)) {
      return gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', correlationId }, 502);
    }
    result.cookies.set(GEKTA_MFA_PENDING_COOKIE, '', clearGektaMfaCookieOptions());
    return result;
  } catch (error) {
    console.error('gekta_mfa_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!assertCsrf(request).ok) return gektaAuthJson({ ok: false, code: 'CSRF_REJECTED' }, 403);
  const response = gektaAuthJson({ ok: true });
  response.cookies.set(GEKTA_MFA_PENDING_COOKIE, '', clearGektaMfaCookieOptions());
  return response;
}
