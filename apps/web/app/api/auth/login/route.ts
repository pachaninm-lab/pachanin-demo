import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  applyAuthenticatedSession,
  normalizeSurfaceRole,
  platformHome,
  type AuthenticatedSessionPayload,
} from '../../../../lib/server/auth-session-response';
import {
  MFA_PENDING_COOKIE,
  clearMfaPendingCookieOptions,
  mfaPendingCookieOptions,
  sealMfaLoginTicket,
} from '../../../../lib/server/mfa-login-ticket';
import { assertCsrf } from '../../../../lib/server-request-security';
import {
  MEMBERSHIP_SELECTION_COOKIE,
  clearMembershipSelectionCookieOptions,
  membershipSelectionCookieOptions,
} from '../../../../lib/server/membership-selection-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const UNIVERSAL_ERROR = 'Не удалось войти. Проверь данные или восстанови доступ.';

type ApiLoginPayload = Partial<AuthenticatedSessionPayload> & {
  membershipSelectionRequired?: boolean;
  memberships?: Array<{
    membershipId?: string;
    organizationId?: string;
    organizationName?: string;
    role?: string;
    isOrgAdmin?: boolean;
  }>;
  mfaRequired?: boolean;
  challengeToken?: string;
  challengeExpiresAt?: string;
  setupSecret?: string;
  otpAuthUri?: string;
  staffOwner?: boolean;
  user?: AuthenticatedSessionPayload['user'];
};

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
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  );
}

function forwardedHeaders(request: Request, correlationId: string) {
  const ip = requestIp(request);
  const userAgent = request.headers.get('user-agent');
  return {
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId,
    ...(ip ? { 'x-forwarded-for': ip } : {}),
    ...(userAgent ? { 'user-agent': userAgent } : {}),
  };
}

async function completeSession(payload: ApiLoginPayload, correlationId: string) {
  if (
    !payload.accessToken
    || !payload.refreshToken
    || !payload.user?.id
    || !payload.user.email
    || !payload.user.role
    || !payload.user.orgId
    || !payload.user.tenantId
    || !payload.user.membershipId
  ) {
    console.error('auth_service_incomplete_session', JSON.stringify({ correlationId }));
    return json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', message: UNIVERSAL_ERROR, correlationId }, 502);
  }

  const role = normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole);
  if (!role) {
    console.error('auth_service_unauthorized_role', JSON.stringify({ correlationId }));
    return json({ ok: false, code: 'AUTH_SERVICE_INVALID_ROLE', message: UNIVERSAL_ERROR, correlationId }, 403);
  }
  const response = json({
    ok: true,
    mfaRequired: false,
    redirectTo: payload.staffOwner
      ? '/platform-v7/staff'
      : platformHome(role, payload.user.isOrgAdmin === true),
    correlationId,
  });
  const session = await applyAuthenticatedSession(response, payload as AuthenticatedSessionPayload);
  if (!session) {
    console.error('cabinet_session_signing_failed', JSON.stringify({ correlationId }));
    return json({ ok: false, code: 'SESSION_CONFIGURATION_ERROR', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
  response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
  response.cookies.set(MEMBERSHIP_SELECTION_COOKIE, '', clearMembershipSelectionCookieOptions());
  return response;
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', message: UNIVERSAL_ERROR, correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password || email.length > 254 || password.length > 256) {
    return json({ ok: false, code: 'INVALID_CREDENTIALS', message: UNIVERSAL_ERROR, correlationId }, 400);
  }

  if (!API_URL) {
    console.error('auth_service_not_configured', JSON.stringify({ correlationId }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }

  try {
    const apiResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: forwardedHeaders(request, correlationId),
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as ApiLoginPayload)) as ApiLoginPayload;

    if (!apiResponse.ok) {
      const rateLimited = apiResponse.status === 429;
      return json({
        ok: false,
        code: rateLimited ? 'RATE_LIMITED' : 'INVALID_CREDENTIALS',
        message: UNIVERSAL_ERROR,
        correlationId,
      }, rateLimited ? 429 : 401);
    }

    if (payload.membershipSelectionRequired) {
      const memberships = Array.isArray(payload.memberships)
        ? payload.memberships.filter((membership) => (
          Boolean(membership?.membershipId)
          && Boolean(membership?.organizationId)
          && Boolean(membership?.organizationName)
          && Boolean(normalizeSurfaceRole(String(membership?.role || '')))
          && typeof membership?.isOrgAdmin === 'boolean'
        ))
        : [];
      if (!payload.challengeToken || memberships.length < 2 || memberships.length > 50) {
        console.error('auth_service_invalid_membership_selection', JSON.stringify({ correlationId }));
        return json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', message: UNIVERSAL_ERROR, correlationId }, 502);
      }
      const response = json({
        ok: true,
        membershipSelectionRequired: true,
        memberships,
        expiresAt: payload.challengeExpiresAt || null,
        correlationId,
      });
      response.cookies.set(MEMBERSHIP_SELECTION_COOKIE, payload.challengeToken, membershipSelectionCookieOptions());
      response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
      return response;
    }

    if (payload.mfaRequired) {
      if (!payload.challengeToken || !payload.user?.id || !payload.user.email || !payload.user.role) {
        console.error('auth_service_incomplete_mfa_challenge', JSON.stringify({ correlationId }));
        return json({ ok: false, code: 'AUTH_SERVICE_INVALID_RESPONSE', message: UNIVERSAL_ERROR, correlationId }, 502);
      }

      let ticket: string;
      try {
        ticket = sealMfaLoginTicket({ challengeToken: payload.challengeToken, user: payload.user });
      } catch {
        console.error('mfa_ticket_secret_not_configured', JSON.stringify({ correlationId }));
        return json({ ok: false, code: 'MFA_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
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
      response.cookies.set(MEMBERSHIP_SELECTION_COOKIE, '', clearMembershipSelectionCookieOptions());
      return response;
    }

    return completeSession(payload, correlationId);
  } catch (error) {
    console.error('auth_login_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', message: UNIVERSAL_ERROR, correlationId }, 503);
  }
}
