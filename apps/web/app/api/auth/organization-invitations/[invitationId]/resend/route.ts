import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '../../../../../../lib/auth-cookies';
import {
  deliverOrganizationInvitation,
  organizationInvitationMailConfigured,
  type OrganizationInvitationDelivery,
} from '../../../../../../lib/server/organization-invitation-mail';
import { assertCsrf } from '../../../../../../lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

type ApiPayload = {
  invitationId?: string;
  status?: string;
  expiresAt?: string;
  replayed?: boolean;
  correlationId?: string;
  emailDelivery?: Partial<OrganizationInvitationDelivery>;
  code?: string;
};

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const { invitationId } = await context.params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const reason = String(body.reason || '').trim();
  const locale = String(body.locale || 'ru');
  const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
  if (!invitationId || invitationId.length > 160 || reason.length < 8 || reason.length > 500 || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return json({ ok: false, code: 'INVITATION_REQUEST_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  const deliveryKey = String(process.env.ORGANIZATION_INVITATION_DELIVERY_KEY || '').trim();
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value || '';
  if (!upstream || !accessToken || deliveryKey.length < 32 || !organizationInvitationMailConfigured()) {
    return json({ ok: false, code: accessToken ? 'INVITATION_SERVICE_UNAVAILABLE' : 'AUTH_REQUIRED', correlationId }, accessToken ? 503 : 401);
  }

  try {
    const apiResponse = await fetch(`${upstream}/auth/organization-invitations/${encodeURIComponent(invitationId)}/resend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'idempotency-key': idempotencyKey,
        'x-correlation-id': correlationId,
        'x-organization-invitation-delivery-key': deliveryKey,
      },
      body: JSON.stringify({ reason }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as ApiPayload)) as ApiPayload;
    if (!apiResponse.ok) {
      const status = [401, 403, 404, 409, 429].includes(apiResponse.status) ? apiResponse.status : apiResponse.status >= 500 ? 503 : 400;
      return json({ ok: false, code: payload.code || 'INVITATION_REQUEST_REJECTED', correlationId }, status);
    }
    const delivery = payload.emailDelivery;
    if (delivery?.email && delivery.token) {
      const mail = await deliverOrganizationInvitation(request, delivery as OrganizationInvitationDelivery, locale);
      if (!mail.delivered) return json({ ok: false, code: 'INVITATION_EMAIL_UNAVAILABLE', invitationId, correlationId }, 503);
    }
    return json({
      ok: true,
      invitationId: payload.invitationId || invitationId,
      status: payload.status,
      expiresAt: payload.expiresAt,
      replayed: Boolean(payload.replayed),
      correlationId: payload.correlationId || correlationId,
    }, 200);
  } catch {
    return json({ ok: false, code: 'INVITATION_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
