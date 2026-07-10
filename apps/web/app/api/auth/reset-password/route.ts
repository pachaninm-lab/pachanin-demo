import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { clearAuthenticatedSession } from '../../../../../lib/server/auth-session-response';
import { MFA_PENDING_COOKIE, clearMfaPendingCookieOptions } from '../../../../../lib/server/mfa-login-ticket';

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
  return request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '';
}

function apiUrl() {
  return String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const token = String(body.token || '').trim();
  const newPassword = String(body.newPassword || '');

  if (token.length < 48 || token.length > 512 || newPassword.length < 12 || newPassword.length > 128) {
    return json({ ok: false, code: 'PASSWORD_RESET_INVALID', correlationId }, 400);
  }

  const upstream = apiUrl();
  if (!upstream) {
    console.error('password_reset_confirm_configuration_error', JSON.stringify({ correlationId, apiConfigured: false }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const ip = requestIp(request);
    const apiResponse = await fetch(`${upstream}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
      },
      body: JSON.stringify({ token, newPassword }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await apiResponse.json().catch(() => ({} as Record<string, unknown>));

    if (!apiResponse.ok || payload.success !== true) {
      const status = apiResponse.status === 429 ? 429 : apiResponse.status >= 500 ? 503 : 400;
      return json({
        ok: false,
        code: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'PASSWORD_RESET_INVALID',
        correlationId,
      }, status);
    }

    const response = json({ ok: true, sessionsRevoked: true, correlationId }, 200);
    clearAuthenticatedSession(response);
    response.cookies.set(MFA_PENDING_COOKIE, '', clearMfaPendingCookieOptions());
    return response;
  } catch (error) {
    console.error('password_reset_confirm_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
