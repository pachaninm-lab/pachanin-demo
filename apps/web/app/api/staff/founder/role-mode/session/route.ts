import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { requiresCanonicalControlHost } from '@/lib/platform-v7/control-host';
import { resolveServerApiBaseUrl } from '@/lib/server/server-api-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const API_BASE_URL = resolveServerApiBaseUrl();
const STAFF_ACCESS_COOKIE = 'pc_staff_access_token';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function correlationId(request: NextRequest) {
  return request.headers.get('x-correlation-id')?.trim().slice(0, 128) || randomUUID();
}

function requestIp(request: NextRequest) {
  return (
    request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || ''
  );
}

export async function GET(request: NextRequest) {
  const correlation = correlationId(request);
  if (requiresCanonicalControlHost(request)) {
    return json({ ok: false, code: 'CONTROL_HOST_REQUIRED', correlationId: correlation }, 421);
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
  const staffAccessToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value || '';
  if (!accessToken) {
    return json({ ok: false, code: 'UNAUTHENTICATED', correlationId: correlation }, 401);
  }
  if (!staffAccessToken) {
    return json({ ok: false, code: 'ROLE_MODE_SESSION_INACTIVE', correlationId: correlation }, 401);
  }
  if (!API_BASE_URL) {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', correlationId: correlation }, 503);
  }

  const ip = requestIp(request);
  const userAgent = request.headers.get('user-agent');

  try {
    const upstream = await fetch(`${API_BASE_URL}/staff/founder/role-mode/session`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Staff-Access-Session': staffAccessToken,
        Accept: 'application/json',
        'x-correlation-id': correlation,
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(userAgent ? { 'user-agent': userAgent } : {}),
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId: correlation }, 502);
    }

    const payload = await upstream.json().catch(() => ({})) as unknown;
    const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>), correlationId: correlation }
      : { correlationId: correlation };
    delete safePayload.accessToken;
    return json(safePayload, upstream.status);
  } catch {
    return json({
      ok: false,
      code: 'ROLE_MODE_SESSION_UNAVAILABLE',
      correlationId: correlation,
    }, 503);
  }
}
