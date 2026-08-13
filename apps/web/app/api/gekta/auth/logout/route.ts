import { cookies } from 'next/headers';
import { REFRESH_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';
import { authJson, correlationId, postGektaAuth } from '@/lib/server/gekta-auth-bff';
import { clearGektaSession } from '@/lib/server/gekta-auth-session';
import { clearGektaMfaTicket } from '@/lib/server/gekta-mfa-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const id = correlationId(request);
  if (!assertCsrf(request).ok) return authJson({ ok: false, code: 'CSRF_REJECTED', correlationId: id }, 403);
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value || '';
  if (refreshToken) await postGektaAuth(request, 'logout', { refreshToken });

  // Local credentials are cleared even when the upstream is unavailable. A
  // server-side family remains bounded and will expire; keeping browser access
  // after the user pressed sign out would be the worse failure mode.
  const response = authJson({ ok: true, redirectTo: '/gekta', correlationId: id });
  clearGektaSession(response);
  clearGektaMfaTicket(response);
  return response;
}
