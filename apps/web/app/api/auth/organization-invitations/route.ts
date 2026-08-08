import { createHash, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '../../../../lib/auth-cookies';
import {
  deliverOrganizationInvitation,
  organizationInvitationMailConfigured,
  type OrganizationInvitationDelivery,
} from '../../../../lib/server/organization-invitation-mail';
import { assertCsrf } from '../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const HUMAN_ROLES = new Set([
  'FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'ELEVATOR', 'LAB', 'SURVEYOR', 'ACCOUNTING', 'GUEST',
]);

type ApiPayload = {
  invitationId?: string;
  status?: string;
  expiresAt?: string;
  correlationId?: string;
  replayed?: boolean;
  emailDelivery?: Partial<OrganizationInvitationDelivery>;
  code?: string;
};

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function accountHash(email: string) {
  return createHash('sha256').update(email).digest('hex').slice(0, 16);
}

function upstreamStatus(status: number) {
  if ([401, 403, 409, 429].includes(status)) return status;
  return status >= 500 ? 503 : 400;
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const email = String(body.email || '').trim().toLowerCase();
  const role = String(body.role || '').trim();
  const locale = String(body.locale || 'ru');
  const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
  if (
    !/^\S+@\S+\.\S+$/.test(email)
    || email.length > 254
    || !HUMAN_ROLES.has(role)
    || idempotencyKey.length < 16
    || idempotencyKey.length > 128
  ) {
    return json({ ok: false, code: 'INVITATION_REQUEST_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  const deliveryKey = String(process.env.ORGANIZATION_INVITATION_DELIVERY_KEY || '').trim();
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value || '';
  if (!upstream || !accessToken || deliveryKey.length < 32 || !organizationInvitationMailConfigured()) {
    console.error('organization_invitation_configuration_error', JSON.stringify({
      correlationId,
      apiConfigured: Boolean(upstream),
      authenticated: Boolean(accessToken),
      deliveryBoundaryConfigured: deliveryKey.length >= 32,
      mailConfigured: organizationInvitationMailConfigured(),
    }));
    return json({ ok: false, code: accessToken ? 'INVITATION_SERVICE_UNAVAILABLE' : 'AUTH_REQUIRED', correlationId }, accessToken ? 503 : 401);
  }

  try {
    const apiResponse = await fetch(`${upstream}/auth/organization-invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'idempotency-key': idempotencyKey,
        'x-correlation-id': correlationId,
        'x-organization-invitation-delivery-key': deliveryKey,
      },
      body: JSON.stringify({ email, role }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!apiResponse.ok) {
      const status = upstreamStatus(apiResponse.status);
      return json({ ok: false, code: payload.code || 'INVITATION_REQUEST_REJECTED', correlationId }, status);
    }

    const delivery = payload.emailDelivery;
    if (delivery?.email && delivery.token) {
      const mail = await deliverOrganizationInvitation(request, delivery as OrganizationInvitationDelivery, locale);
      console.info('organization_invitation_delivery_result', JSON.stringify({
        correlationId,
        invitationId: payload.invitationId,
        accountHash: accountHash(email),
        delivered: mail.delivered,
        provider: mail.provider,
        reason: mail.reason,
      }));
      if (!mail.delivered) {
        return json({
          ok: false,
          code: 'INVITATION_EMAIL_UNAVAILABLE',
          invitationId: payload.invitationId,
          correlationId,
        }, 503);
      }
    }

    return json({
      ok: true,
      invitationId: payload.invitationId,
      status: payload.status,
      expiresAt: payload.expiresAt,
      replayed: Boolean(payload.replayed),
      correlationId: payload.correlationId || correlationId,
    }, 201);
  } catch (error) {
    console.error('organization_invitation_transport_failure', JSON.stringify({
      correlationId,
      accountHash: accountHash(email),
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'INVITATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
