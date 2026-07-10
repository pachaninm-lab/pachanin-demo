import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, SESSION_COOKIE } from '../../../../../lib/auth-cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

function response(body: Record<string, unknown>, status: number, clearSession = false) {
  const result = NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });

  if (clearSession) {
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, CSRF_COOKIE]) {
      result.cookies.set(name, '', { path: '/', expires: new Date(0), maxAge: 0 });
    }
  }
  return result;
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

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const token = String(body.token || '').trim();
  const newPassword = String(body.newPassword || '');

  if (token.length < 32 || token.length > 2048) {
    return response({ success: false, code: 'PASSWORD_RESET_INVALID', correlationId }, 400);
  }
  if (newPassword.length < 12 || newPassword.length > 128) {
    return response({ success: false, code: 'PASSWORD_POLICY_FAILED', correlationId }, 400);
  }
  if (!API_URL) {
    console.error('password_reset_confirm_configuration_error', JSON.stringify({ correlationId }));
    return response({ success: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const ip = requestIp(request);
    const apiResponse = await fetch(`${API_URL}/auth/password-reset/confirm`, {
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

    if (!apiResponse.ok) {
      const code = String((payload as { code?: string; message?: { code?: string } }).code ||
        (payload as { message?: { code?: string } }).message?.code ||
        'PASSWORD_RESET_INVALID');
      return response({ success: false, code, correlationId }, apiResponse.status >= 500 ? 503 : 400);
    }

    return response({ success: true, sessionsRevoked: true, correlationId }, 200, true);
  } catch (error) {
    console.error('password_reset_confirm_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return response({ success: false, code: 'AUTH_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
