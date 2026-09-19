import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { clearAuthenticatedSession } from '@/lib/server/auth-session-response';
import { MFA_PENDING_COOKIE, clearMfaPendingCookieOptions } from '@/lib/server/mfa-login-ticket';
import { MFA_STEP_UP_COOKIE, clearMfaStepUpCookieOptions } from '@/lib/server/mfa-step-up-cookie';
import {
  deliverMfaRecoveryCompleted,
  mfaRecoveryMailConfigured,
} from '@/lib/server/mfa-recovery-mail';
import { assertCsrf } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

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

function requestIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '';
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return json({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const token = String(body.token || '').trim();
  const password = String(body.password || '');
  const locale = body.locale === 'en' || body.locale === 'zh' ? body.locale : 'ru';
  if (!token.startsWith('mr_') || token.length < 48 || token.length > 512 || password.length < 8 || password.length > 256) {
    return json({ ok: false, code: 'MFA_RECOVERY_INVALID', correlationId }, 400);
  }

  const upstream = String(process.env.API_URL || '').trim().replace(/\/$/, '');
  const deliveryKey = String(process.env.ORGANIZATION_INVITATION_DELIVERY_KEY || '').trim();
  if (!upstream || deliveryKey.length < 32 || !mfaRecoveryMailConfigured()) {
    console.error('mfa_recovery_confirm_configuration_error', JSON.stringify({
      correlationId,
      apiConfigured: Boolean(upstream),
      deliveryBoundaryConfigured: deliveryKey.length >= 32,
      mailConfigured: mfaRecoveryMailConfigured(),
    }));
    return json({ ok: false, code: 'MFA_RECOVERY_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const ip = requestIp(request);
    const userAgent = request.headers.get('user-agent') || '';
    const apiResponse = await fetch(`${upstream}/auth/mfa-recovery/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        'x-organization-invitation-delivery-key': deliveryKey,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(userAgent ? { 'user-agent': userAgent } : {}),
      },
      body: JSON.stringify({ token, password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as Record<string, unknown>));
    if (!apiResponse.ok || payload.ok !== true || payload.mfaReenrollmentRequired !== true) {
      const status = apiResponse.status === 429 ? 429 : apiResponse.status >= 500 ? 503 : 400;
      return json({
        ok: false,
        code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'MFA_RECOVERY_UNAVAILABLE' : 'MFA_RECOVERY_INVALID',
        correlationId,
      }, status);
    }

    const notification = payload.notificationDelivery && typeof payload.notificationDelivery === 'object'
      ? payload.notificationDelivery as { email?: unknown }
      : null;
    if (typeof notification?.email === 'string' && notification.email) {
      const mail = await deliverMfaRecoveryCompleted(notification.email, locale);
      console.info('mfa_recovery_completed_notification_result', JSON.stringify({
        correlationId,
        delivered: mail.delivered,
        provider: mail.provider,
        reason: mail.reason,
      }));
    }

    const response = json({
      ok: true,
      sessionsRevoked: true,
      mfaReenrollmentRequired: true,
      correlationId: typeof payload.correlationId === 'string' ? payload.correlationId : correlationId,
    }, 200);
    clearAuthenticatedSession(response);
    response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
    response.cookies.set(MFA_STEP_UP_COOKIE, '', clearMfaStepUpCookieOptions());
    return response;
  } catch (error) {
    console.error('mfa_recovery_confirm_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'MFA_RECOVERY_UNAVAILABLE', correlationId }, 503);
  }
}
