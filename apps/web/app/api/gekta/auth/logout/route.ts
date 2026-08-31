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
import { clearAuthenticatedSession } from '@/lib/server/auth-session-response';
import { GEKTA_MFA_PENDING_COOKIE, clearGektaMfaCookieOptions } from '@/lib/server/gekta-mfa-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleared(body: Record<string, unknown>, status: number) {
  const result = gektaAuthJson(body, status);
  clearAuthenticatedSession(result);
  result.cookies.set(GEKTA_MFA_PENDING_COOKIE, '', clearGektaMfaCookieOptions());
  return result;
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (!assertCsrf(request).ok) return gektaAuthJson({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value || '';
  if (!refreshToken) return cleared({ ok: true, correlationId }, 200);
  const upstream = gektaApiBase();
  if (!upstream) return cleared({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', localSessionCleared: true, correlationId }, 503);

  try {
    const response = await fetch(`${upstream}/gekta/auth/logout`, {
      method: 'POST',
      headers: gektaForwardHeaders(request, correlationId),
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    return cleared({
      ok: response.ok,
      ...(response.ok ? {} : { code: 'SESSION_REVOKE_FAILED', localSessionCleared: true }),
      correlationId,
    }, response.ok ? 200 : 503);
  } catch {
    return cleared({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', localSessionCleared: true, correlationId }, 503);
  }
}
