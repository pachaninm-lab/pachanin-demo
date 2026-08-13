import { cookies } from 'next/headers';
import { assertCsrf } from '@/lib/server-request-security';
import { authJson, correlationId, postGektaAuth, readSmallJson } from '@/lib/server/gekta-auth-bff';
import { applyGektaSession, isGektaSessionPayload } from '@/lib/server/gekta-auth-session';
import {
  GEKTA_MFA_TICKET_COOKIE,
  clearGektaMfaTicket,
  openGektaMfaTicket,
} from '@/lib/server/gekta-mfa-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const id = correlationId(request);
  if (!assertCsrf(request).ok) return authJson({ ok: false, code: 'CSRF_REJECTED', correlationId: id }, 403);
  const body = await readSmallJson(request);
  const rawCode = String(body?.code || '').trim();
  const code = /^\d[\d\s]{5,10}$/u.test(rawCode)
    ? rawCode.replace(/\s/gu, '')
    : rawCode.toUpperCase();
  if (!/^\d{6}$/u.test(code) && !/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/u.test(code)) {
    return authJson({ ok: false, code: 'MFA_CODE_INVALID', correlationId: id }, 400);
  }

  const jar = await cookies();
  const ticket = openGektaMfaTicket(jar.get(GEKTA_MFA_TICKET_COOKIE)?.value);
  if (!ticket) {
    const response = authJson({ ok: false, code: 'MFA_CHALLENGE_EXPIRED', correlationId: id }, 401);
    clearGektaMfaTicket(response);
    return response;
  }

  const upstream = await postGektaAuth(request, 'mfa/verify', {
    challengeToken: ticket.challengeToken,
    code,
  });
  if (!upstream.ok || !isGektaSessionPayload(upstream.payload)) {
    const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 503 : 401;
    const response = authJson({
      ok: false,
      code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'MFA_CODE_INVALID',
      correlationId: id,
    }, status);
    return response;
  }

  const backupCodes = Array.isArray(upstream.payload.backupCodes)
    ? upstream.payload.backupCodes.filter((value): value is string => typeof value === 'string').slice(0, 12)
    : [];
  const response = authJson({
    ok: true,
    status: 'ACTIVE',
    redirectTo: '/gekta?chat=new',
    ...(backupCodes.length ? { backupCodes } : {}),
    correlationId: id,
  });
  applyGektaSession(response, upstream.payload);
  clearGektaMfaTicket(response);
  return response;
}
