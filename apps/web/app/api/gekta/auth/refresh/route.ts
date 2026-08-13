import { cookies } from 'next/headers';
import { REFRESH_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';
import { authJson, correlationId, postGektaAuth } from '@/lib/server/gekta-auth-bff';
import {
  applyGektaSession,
  clearGektaSession,
  isGektaSessionPayload,
} from '@/lib/server/gekta-auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const id = correlationId(request);
  if (!assertCsrf(request).ok) return authJson({ ok: false, code: 'CSRF_REJECTED', correlationId: id }, 403);
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value || '';
  if (!refreshToken) {
    return authJson({ ok: false, code: 'SESSION_NOT_REFRESHABLE', correlationId: id }, 401);
  }

  const upstream = await postGektaAuth(request, 'refresh', { refreshToken });
  if (!upstream.ok || !isGektaSessionPayload(upstream.payload)) {
    const status = upstream.status >= 500 ? 503 : 401;
    const response = authJson({
      ok: false,
      code: status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'SESSION_NOT_REFRESHABLE',
      correlationId: id,
    }, status);
    if (status === 401) clearGektaSession(response);
    return response;
  }

  const response = authJson({ ok: true, correlationId: id });
  applyGektaSession(response, upstream.payload);
  return response;
}
