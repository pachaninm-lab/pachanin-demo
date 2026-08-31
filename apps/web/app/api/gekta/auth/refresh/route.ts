import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { REFRESH_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';
import {
  GEKTA_AUTH_TIMEOUT_MS,
  gektaApiBase,
  gektaAuthJson,
  gektaForwardHeaders,
} from '@/lib/server/gekta-auth-route';
import {
  applyGektaAuthenticatedSession,
  clearAuthenticatedSession,
  type GektaAuthenticatedSessionPayload,
} from '@/lib/server/auth-session-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (!assertCsrf(request).ok) return gektaAuthJson({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value || '';
  if (!refreshToken) {
    const result = gektaAuthJson({ ok: false, code: 'SESSION_NOT_REFRESHABLE', correlationId }, 401);
    clearAuthenticatedSession(result);
    return result;
  }
  const upstream = gektaApiBase();
  if (!upstream) return gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);

  try {
    const response = await fetch(`${upstream}/gekta/auth/refresh`, {
      method: 'POST',
      headers: gektaForwardHeaders(request, correlationId),
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => ({})) as Partial<GektaAuthenticatedSessionPayload>;
    if (!response.ok || !payload.accessToken || !payload.refreshToken || !payload.user) {
      const result = gektaAuthJson({ ok: false, code: 'SESSION_NOT_REFRESHABLE', correlationId }, 401);
      clearAuthenticatedSession(result);
      return result;
    }
    const result = gektaAuthJson({ ok: true, correlationId });
    if (!applyGektaAuthenticatedSession(result, payload as GektaAuthenticatedSessionPayload)) {
      const invalid = gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', correlationId }, 502);
      clearAuthenticatedSession(invalid);
      return invalid;
    }
    return result;
  } catch {
    return gektaAuthJson({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
