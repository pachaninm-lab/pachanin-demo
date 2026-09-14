import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  applyAuthenticatedSession,
  normalizeSurfaceRole,
  platformHome,
  type AuthenticatedSessionPayload,
} from '../../../../lib/server/auth-session-response';
import { isControlHostRequest } from '../../../../lib/platform-v7/control-host';
import {
  MFA_PENDING_COOKIE,
  clearMfaPendingCookieOptions,
  openMfaLoginTicket,
} from '../../../../lib/server/mfa-login-ticket';
import { assertCsrf } from '../../../../lib/server-request-security';
import { clientIpFromRequest, correlationIdFromRequest, userAgentFromRequest } from '@/lib/server/forwarded-request-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const UNIVERSAL_ERROR = 'Не удалось подтвердить второй фактор. Проверь код или начни вход заново.';

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function requestIp(request: Request) {
  return clientIpFromRequest(request) ?? '';
}

export async function POST(request: Request) {
  const correlationId = correlationIdFromRequest(request);
  const controlPlane = isControlHostRequest(request);
  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    if (controlPlane) console.warn('control_plane_mfa_denied', JSON.stringify({ correlationId, reason: 'csrf' }));
    return json({ ok: false, code: 'CSRF_REJECTED', message: UNIVERSAL_ERROR, correlationId }, 403);
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const code = String(body.code || '').trim();
  const jar = await cookies();
  const ticket = openMfaLoginTicket(jar.get(MFA_PENDING_COOKIE)?.value || '');

  if (!ticket || !code || code.length > 128) {
    const response = json({ ok: false, code: 'MFA_INVALID', message: UNIVERSAL_ERROR, correlationId }, 401);
    if (!ticket) response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
    return response;
  }
  if (!API_URL) {
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }

  const ip = requestIp(request);
  try {
    const apiResponse = await fetch(`${API_URL}/auth/mfa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(userAgentFromRequest(request) ? { 'user-agent': userAgentFromRequest(request) as string } : {}),
      },
      body: JSON.stringify({ challengeToken: ticket.challengeToken, code }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as AuthenticatedSessionPayload)) as AuthenticatedSessionPayload & {
      backupCodes?: string[];
    };

    if (
      !apiResponse.ok
      || !payload.accessToken
      || !payload.refreshToken
      || !payload.user?.id
      || !payload.user.email
      || !payload.user.role
      || !payload.user.orgId
      || !payload.user.tenantId
      || !payload.user.membershipId
    ) {
      const terminal = apiResponse.status === 401 || apiResponse.status === 403 || apiResponse.status === 410;
      const response = json({
        ok: false,
        code: apiResponse.status === 429 ? 'RATE_LIMITED' : 'MFA_INVALID',
        message: UNIVERSAL_ERROR,
        correlationId,
      }, apiResponse.status === 429 ? 429 : 401);
      if (terminal) response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
      if (controlPlane) console.warn('control_plane_mfa_denied', JSON.stringify({ correlationId, reason: 'verification' }));
      return response;
    }

    const role = normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole);
    if (!role) {
      return json({ ok: false, code: 'AUTH_SERVICE_INVALID_ROLE', message: UNIVERSAL_ERROR, correlationId }, 403);
    }
    const response = json({
      ok: true,
      redirectTo: controlPlane ? '/platform-v7/staff' : platformHome(role, payload.user.isOrgAdmin === true),
      backupCodes: Array.isArray(payload.backupCodes) ? payload.backupCodes : undefined,
      correlationId,
    });
    const session = await applyAuthenticatedSession(response, payload, { controlPlane });
    if (!session) {
      return json({ ok: false, code: 'SESSION_CONFIGURATION_ERROR', message: UNIVERSAL_ERROR, correlationId }, 503);
    }
    response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
    if (controlPlane) console.info('control_plane_mfa_success', JSON.stringify({ correlationId }));
    return response;
  } catch (error) {
    console.error('auth_mfa_transport_failure', JSON.stringify({
      correlationId,
      controlPlane,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
}
