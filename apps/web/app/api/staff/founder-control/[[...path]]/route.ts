import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { requiresCanonicalControlHost } from '@/lib/platform-v7/control-host';
import { assertCsrf } from '@/lib/server-request-security';
import { resolveServerApiBaseUrl } from '@/lib/server/server-api-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE_URL = resolveServerApiBaseUrl();
const MAX_BODY_BYTES = 72 * 1024;

function reply(body: unknown, status = 200) {
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

function safePath(parts: string[] | undefined) {
  const normalized = (parts ?? []).map((part) => String(part || '').trim());
  if (normalized.some((part) => !part || part === '.' || part === '..' || part.includes('\\'))) return null;
  return normalized.join('/');
}

async function readBody(request: NextRequest): Promise<string | null> {
  const text = await request.text();
  return Buffer.byteLength(text, 'utf8') <= MAX_BODY_BYTES ? text : null;
}

async function forward(request: NextRequest, parts: string[] | undefined, method: 'GET' | 'PUT') {
  const correlationId = String(request.headers.get('x-correlation-id') || '').trim().slice(0, 128) || randomUUID();
  if (requiresCanonicalControlHost(request)) return reply({ ok: false, code: 'CONTROL_HOST_REQUIRED', correlationId }, 421);
  const path = safePath(parts);
  if (path === null) return reply({ ok: false, code: 'INVALID_PATH', correlationId }, 400);
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return reply({ ok: false, code: 'UNAUTHENTICATED', correlationId }, 401);
  if (!API_BASE_URL) return reply({ ok: false, code: 'FOUNDER_CONTROL_UNAVAILABLE', correlationId }, 503);

  let body: string | undefined;
  if (method === 'PUT') {
    const csrf = assertCsrf(request);
    if (!csrf.ok) return reply({ ok: false, code: 'CSRF_REJECTED', message: 'Сессия формы устарела. Обнови страницу.', correlationId }, 403);
    const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 180) return reply({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', correlationId }, 400);
    const raw = await readBody(request);
    if (raw === null) return reply({ ok: false, code: 'PAYLOAD_TOO_LARGE', correlationId }, 413);
    body = raw;
  }

  try {
    const target = `${API_BASE_URL}/founder-control${path ? `/${path}` : ''}${request.nextUrl.search}`;
    const headers = new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Correlation-Id': correlationId,
    });
    if (method === 'PUT') {
      headers.set('Content-Type', 'application/json');
      headers.set('Idempotency-Key', String(request.headers.get('idempotency-key') || ''));
    }
    const response = await fetch(target, {
      method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return reply({ ok: false, code: 'FOUNDER_CONTROL_UNAVAILABLE', correlationId }, 503);
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return forward(request, (await context.params).path, 'GET');
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return forward(request, (await context.params).path, 'PUT');
}
