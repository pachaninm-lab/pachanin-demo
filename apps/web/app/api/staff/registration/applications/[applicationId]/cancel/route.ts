import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { requiresCanonicalControlHost } from '@/lib/platform-v7/control-host';
import { resolveServerApiBaseUrl } from '@/lib/server/server-api-origin';
import { assertCsrf } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE_URL = resolveServerApiBaseUrl();
const STAFF_ACCESS_COOKIE = 'pc_staff_access_token';
const MAX_BODY_BYTES = 4 * 1024;

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

async function readBoundedBody(request: NextRequest): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) return null;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  const providedCorrelationId = String(request.headers.get('x-correlation-id') || '').trim();
  const correlationId = providedCorrelationId.slice(0, 128) || randomUUID();
  if (requiresCanonicalControlHost(request)) {
    return json({ ok: false, code: 'CONTROL_HOST_REQUIRED', correlationId }, 421);
  }
  if (!providedCorrelationId || providedCorrelationId.length > 128) {
    return json({ ok: false, code: 'CORRELATION_ID_REQUIRED', correlationId }, 400);
  }

  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    return json({ ok: false, code: 'CSRF_REJECTED', message: 'Сессия формы устарела. Обнови страницу.', correlationId }, 403);
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const staffAccessToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return json({ ok: false, code: 'UNAUTHENTICATED', message: 'Требуется повторный вход.', correlationId }, 401);
  }
  if (!staffAccessToken) {
    return json({ ok: false, code: 'FORBIDDEN', message: 'Операция недоступна.', correlationId }, 403);
  }
  if (!API_BASE_URL) {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', correlationId }, 503);
  }

  const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', correlationId }, 400);
  }

  let body: string | null;
  try {
    body = await readBoundedBody(request);
  } catch {
    return json({ ok: false, code: 'REQUEST_BODY_UNREADABLE', correlationId }, 400);
  }
  if (body === null) {
    return json({ ok: false, code: 'PAYLOAD_TOO_LARGE', correlationId }, 413);
  }

  const { applicationId } = await context.params;
  const applicationKey = String(applicationId || '').trim();
  if (!applicationKey || applicationKey.includes('/') || applicationKey.includes('\\')) {
    return json({ ok: false, code: 'INVALID_APPLICATION_ID', correlationId }, 400);
  }

  try {
    const upstream = await fetch(
      `${API_BASE_URL}/staff/registration/applications/${encodeURIComponent(applicationKey)}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-staff-access-session': staffAccessToken,
          'x-correlation-id': correlationId,
          'idempotency-key': idempotencyKey,
        },
        body,
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (upstream.status >= 300 && upstream.status < 400) {
      return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId }, 502);
    }
    const payload = await upstream.json().catch(() => ({ code: 'UPSTREAM_INVALID_JSON' }));
    return json(payload, upstream.status);
  } catch {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', correlationId }, 503);
  }
}
