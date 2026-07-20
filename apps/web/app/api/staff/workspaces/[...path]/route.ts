import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
const STAFF_ACCESS_COOKIE = 'pc_staff_access_token';
const MAX_BODY_BYTES = 64 * 1024;

const READ_PATHS = [
  /^support$/,
  /^support\/cases$/,
  /^operations$/,
  /^finance$/,
  /^diagnostics$/,
  /^critical-actions(?:\/mine)?$/,
  /^assignments$/,
  /^organizations\/[^/]+\/users$/,
  /^break-glass$/,
  /^audit\/actors\/[^/]+\/verify$/,
] as const;

const WRITE_PATHS = [
  /^support\/cases$/,
  /^support\/cases\/[^/]+\/transition$/,
  /^support\/users\/[^/]+\/revoke-sessions$/,
  /^support\/users\/[^/]+\/recovery$/,
  /^critical-actions$/,
  /^critical-actions\/[^/]+\/decision$/,
  /^assignments$/,
  /^assignments\/[^/]+\/revoke$/,
  /^break-glass\/[^/]+\/end$/,
] as const;

function secure(body: unknown, status = 200, correlationId?: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
    },
  });
}

function normalizePath(segments: string[]) {
  try {
    const decoded = segments.map((part) => decodeURIComponent(part).trim()).filter(Boolean);
    if (decoded.some((part) => part === '.' || part === '..' || part.includes('/') || part.includes('\\'))) return '';
    return decoded.map(encodeURIComponent).join('/');
  } catch {
    return '';
  }
}

function allowed(method: string, path: string) {
  const rules = method === 'GET' ? READ_PATHS : method === 'POST' ? WRITE_PATHS : [];
  return rules.some((rule) => rule.test(path));
}

type StaffWorkspaceRouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function handler(request: NextRequest, context: StaffWorkspaceRouteContext) {
  const method = request.method.toUpperCase();
  const params = await context.params;
  const path = normalizePath(params.path || []);
  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();

  if (!path || !allowed(method, path)) {
    return secure({ ok: false, code: 'STAFF_WORKSPACE_ROUTE_NOT_ALLOWED', correlationId }, 404, correlationId);
  }
  if (!API_URL) {
    return secure({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
  }

  let apiOrigin: string;
  try {
    const url = new URL(API_URL);
    if (
      process.env.NODE_ENV === 'production'
      && url.protocol !== 'https:'
      && process.env.PC_INTERNAL_API_ALLOW_HTTP !== 'true'
    ) {
      return secure({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
    }
    apiOrigin = url.toString().replace(/\/$/, '');
  } catch {
    return secure({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const staffToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
  if (!accessToken || !staffToken) {
    return secure({ ok: false, code: 'STAFF_SESSION_REQUIRED', correlationId }, 401, correlationId);
  }

  if (method === 'POST') {
    const csrf = assertCsrf(request);
    if (!csrf.ok) return secure({ ok: false, code: 'CSRF_REJECTED', correlationId }, 403, correlationId);
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_BODY_BYTES) {
    return secure({ ok: false, code: 'PAYLOAD_TOO_LARGE', correlationId }, 413, correlationId);
  }

  let body: string | undefined;
  if (method === 'POST') {
    body = await request.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return secure({ ok: false, code: 'PAYLOAD_TOO_LARGE', correlationId }, 413, correlationId);
    }
  }

  const query = request.nextUrl.searchParams.toString();
  try {
    const upstream = await fetch(`${apiOrigin}/staff/workspaces/${path}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Staff-Access-Session': staffToken,
        Accept: 'application/json',
        'X-Correlation-Id': correlationId,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return secure({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId }, 502, correlationId);
    }

    const text = await upstream.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) as unknown : {};
    } catch {
      return secure({ ok: false, code: 'INVALID_UPSTREAM_RESPONSE', correlationId }, 502, correlationId);
    }

    const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    delete payloadObject.accessToken;
    return secure(
      Array.isArray(payload) ? payload : { ...payloadObject, correlationId },
      upstream.status,
      correlationId,
    );
  } catch {
    return secure({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
  }
}

export const GET = handler;
export const POST = handler;
