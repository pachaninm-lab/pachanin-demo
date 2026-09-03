import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { requiresCanonicalControlHost } from '@/lib/platform-v7/control-host';
import { resolveServerApiBaseUrl } from '@/lib/server/server-api-origin';
import { assertCsrf } from '@/lib/server-request-security';
import { readBoundedBody } from '@/lib/uploads/bounded-body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const API_BASE_URL = resolveServerApiBaseUrl();
const STAFF_ACCESS_COOKIE = 'pc_staff_access_token';
const MAX_BODY_BYTES = 16 * 1024;

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  if (requiresCanonicalControlHost(request)) {
    return json({ ok: false, code: 'CONTROL_HOST_REQUIRED' }, 421);
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return json({ ok: false, code: 'UNAUTHENTICATED', message: 'Требуется повторный вход.' }, 401);
  }
  if (!API_BASE_URL) {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE' }, 503);
  }

  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    return json({ ok: false, code: 'CSRF_REJECTED', message: 'Сессия формы устарела. Обнови страницу.' }, 403);
  }

  const staffAccessToken = String(request.cookies.get(STAFF_ACCESS_COOKIE)?.value || '').trim();
  if (!staffAccessToken) {
    return json({ ok: false, code: 'STAFF_CONTROL_SESSION_REQUIRED' }, 403);
  }

  const { applicationId: rawApplicationId } = await context.params;
  const applicationId = String(rawApplicationId || '').trim();
  if (!applicationId || applicationId.length > 256 || applicationId.includes('/')) {
    return json({ ok: false, code: 'REGISTRATION_APPLICATION_ID_REQUIRED' }, 400);
  }

  const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED' }, 400);
  }
  const correlationId = String(request.headers.get('x-correlation-id') || '').trim();
  if (!correlationId || correlationId.length > 128) {
    return json({ ok: false, code: 'CORRELATION_ID_REQUIRED' }, 400);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
  }

  let raw: ArrayBuffer | null;
  try {
    raw = await readBoundedBody(request.body, MAX_BODY_BYTES);
  } catch {
    return json({ ok: false, code: 'REQUEST_BODY_UNREADABLE' }, 400);
  }
  if (raw === null) {
    return json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
  }
  const body = new TextDecoder().decode(raw);

  try {
    const upstream = await fetch(
      `${API_BASE_URL}/staff/registration/applications/${encodeURIComponent(applicationId)}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Staff-Access-Session': staffAccessToken,
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-Id': correlationId,
        },
        body,
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (upstream.status >= 300 && upstream.status < 400) {
      return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED' }, 502);
    }
    const payload = await upstream.json().catch(() => ({
      ok: false,
      code: 'STAFF_RESPONSE_INVALID',
    }));
    return json(payload, upstream.status);
  } catch {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE' }, 503);
  }
}
