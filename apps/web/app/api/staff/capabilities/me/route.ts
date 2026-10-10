import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { requiresCanonicalControlHost } from '@/lib/platform-v7/control-host';
import { parseStaffCapabilitiesContract } from '@/lib/platform-v7/staff-capabilities';
import { resolveServerApiBaseUrl } from '@/lib/server/server-api-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_BASE_URL = resolveServerApiBaseUrl();

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

export async function GET(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  if (requiresCanonicalControlHost(request)) {
    return json({ code: 'CONTROL_HOST_REQUIRED', correlationId }, 421);
  }
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value || '';

  if (!accessToken || accessToken.startsWith('demo.')) {
    return json({ code: 'UNAUTHENTICATED', correlationId }, 401);
  }
  if (!API_BASE_URL) {
    return json({ code: 'STAFF_AUTHORITY_UNAVAILABLE', correlationId }, 503);
  }

  try {
    const upstream = await fetch(`${API_BASE_URL}/staff/capabilities/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'x-correlation-id': correlationId,
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return json({ code: 'STAFF_AUTHORITY_REDIRECT_REJECTED', correlationId }, 502);
    }
    if (upstream.status === 401) {
      return json({ code: 'UNAUTHENTICATED', correlationId }, 401);
    }
    if (upstream.status === 403) {
      return json({ code: 'STAFF_ACCESS_FORBIDDEN', correlationId }, 403);
    }
    if (!upstream.ok) {
      return json({ code: 'STAFF_AUTHORITY_UNAVAILABLE', correlationId }, 503);
    }

    const capabilities = parseStaffCapabilitiesContract(
      await upstream.json().catch(() => null),
    );
    if (!capabilities) {
      return json({ code: 'STAFF_AUTHORITY_INVALID_RESPONSE', correlationId }, 502);
    }

    return json({ ...capabilities, correlationId });
  } catch (error) {
    console.error('staff_capabilities_transport_failure', JSON.stringify({
      correlationId,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ code: 'STAFF_AUTHORITY_UNAVAILABLE', correlationId }, 503);
  }
}
