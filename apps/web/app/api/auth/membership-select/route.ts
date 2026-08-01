import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  applyAuthenticatedSession,
  normalizeSurfaceRole,
  platformHome,
  type AuthenticatedSessionPayload,
} from '../../../../lib/server/auth-session-response';
import {
  MEMBERSHIP_SELECTION_COOKIE,
  clearMembershipSelectionCookieOptions,
} from '../../../../lib/server/membership-selection-cookie';
import {
  MFA_PENDING_COOKIE,
  clearMfaPendingCookieOptions,
  mfaPendingCookieOptions,
  sealMfaLoginTicket,
} from '../../../../lib/server/mfa-login-ticket';
import { assertCsrf } from '../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const UNIVERSAL_ERROR = 'Не удалось выбрать организацию. Начни вход заново.';

type ApiPayload = Partial<AuthenticatedSessionPayload> & {
  mfaRequired?: boolean;
  challengeToken?: string;
  challengeExpiresAt?: string;
  setupSecret?: string;
  otpAuthUri?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function clearSelection(response: NextResponse) {
  response.cookies.set(MEMBERSHIP_SELECTION_COOKIE, '', clearMembershipSelectionCookieOptions());
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', message: UNIVERSAL_ERROR, correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const membershipId = String(body.membershipId || '').trim();
  const challengeToken = (await cookies()).get(MEMBERSHIP_SELECTION_COOKIE)?.value || '';
  if (!membershipId || membershipId.length > 160 || !challengeToken || !API_URL) {
    const response = json({ ok: false, code: 'MEMBERSHIP_SELECTION_INVALID', message: UNIVERSAL_ERROR, correlationId }, API_URL ? 401 : 503);
    clearSelection(response);
    return response;
  }

  try {
    const apiResponse = await fetch(`${API_URL}/auth/membership/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(request.headers.get('user-agent') ? { 'user-agent': String(request.headers.get('user-agent')) } : {}),
      },
      body: JSON.stringify({ challengeToken, membershipId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!apiResponse.ok) {
      const response = json({ ok: false, code: 'MEMBERSHIP_SELECTION_INVALID', message: UNIVERSAL_ERROR, correlationId }, 401);
      clearSelection(response);
      return response;
    }

    if (payload.mfaRequired) {
      if (!payload.challengeToken || !payload.user?.id || !payload.user.email || !payload.user.role) {
        const response = json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', message: UNIVERSAL_ERROR, correlationId }, 502);
        clearSelection(response);
        return response;
      }
      let ticket: string;
      try {
        ticket = sealMfaLoginTicket({ challengeToken: payload.challengeToken, user: payload.user });
      } catch {
        const response = json({ ok: false, code: 'MFA_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
        clearSelection(response);
        return response;
      }
      const response = json({
        ok: true,
        mfaRequired: true,
        methods: ['totp', 'backup_code'],
        enrollmentRequired: Boolean(payload.setupSecret),
        setupSecret: payload.setupSecret || null,
        otpAuthUri: payload.otpAuthUri || null,
        expiresAt: payload.challengeExpiresAt || null,
        correlationId,
      });
      response.cookies.set(MFA_PENDING_COOKIE, ticket, mfaPendingCookieOptions());
      clearSelection(response);
      return response;
    }

    if (
      !payload.accessToken || !payload.refreshToken || !payload.user?.id || !payload.user.email
      || !payload.user.role || !payload.user.orgId || !payload.user.tenantId || !payload.user.membershipId
    ) {
      const response = json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', message: UNIVERSAL_ERROR, correlationId }, 502);
      clearSelection(response);
      return response;
    }
    const role = normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole);
    if (!role) {
      const response = json({ ok: false, code: 'AUTH_SERVICE_INVALID_ROLE', message: UNIVERSAL_ERROR, correlationId }, 403);
      clearSelection(response);
      return response;
    }
    const response = json({
      ok: true,
      mfaRequired: false,
      redirectTo: platformHome(role, payload.user.isOrgAdmin === true),
      correlationId,
    });
    const applied = await applyAuthenticatedSession(response, payload as AuthenticatedSessionPayload);
    if (!applied) return json({ ok: false, code: 'SESSION_CONFIGURATION_ERROR', message: UNIVERSAL_ERROR, correlationId }, 503);
    response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
    clearSelection(response);
    return response;
  } catch {
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
}
