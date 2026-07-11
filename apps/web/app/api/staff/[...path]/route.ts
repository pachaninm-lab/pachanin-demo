import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const STAFF_ACCESS_COOKIE = 'pc_staff_access_token';
const STAFF_ACCESS_META_COOKIE = 'pc_staff_access_meta';
const MAX_BODY_BYTES = 64 * 1024;

const READ_PATHS = [
  /^assignments\/me$/,
  /^access\/requests$/,
  /^access\/requests\/review$/,
  /^access\/sessions$/,
  /^access\/sessions\/review$/,
  /^organizations$/,
  /^organizations\/[^/]+\/users$/,
  /^organizations\/[^/]+\/cabinet\/[^/]+$/,
  /^audit\/events$/,
  /^break-glass\/active$/,
] as const;

const WRITE_PATHS = [
  /^access\/requests$/,
  /^access\/requests\/[^/]+\/decision$/,
  /^access\/grants\/[^/]+\/activate$/,
  /^access\/sessions\/[^/]+\/(?:end|revoke)$/,
  /^break-glass\/activate$/,
  /^break-glass\/[^/]+\/end$/,
] as const;

type StaffSessionMetadata = {
  accessSessionId: string;
  accessMode: string;
  permissions: string[];
  expiresAt: string;
};

function secureCookie(maxAge: number) {
  return {
    path: '/api/staff',
    maxAge,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

function clearStaffSession(response: NextResponse) {
  for (const name of [STAFF_ACCESS_COOKIE, STAFF_ACCESS_META_COOKIE]) {
    response.cookies.set(name, '', { path: '/api/staff', expires: new Date(0), maxAge: 0 });
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function normalizePath(segments: string[]) {
  return segments.map((part) => decodeURIComponent(part).trim()).filter(Boolean).join('/');
}

function isAllowed(method: string, path: string) {
  const rules = method === 'GET' ? READ_PATHS : method === 'POST' ? WRITE_PATHS : [];
  return rules.some((rule) => rule.test(path));
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

function parseMetadata(raw: string | undefined): StaffSessionMetadata | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<StaffSessionMetadata>;
    if (
      typeof value.accessSessionId !== 'string'
      || typeof value.accessMode !== 'string'
      || !Array.isArray(value.permissions)
      || typeof value.expiresAt !== 'string'
    ) return null;
    if (new Date(value.expiresAt).getTime() <= Date.now()) return null;
    return {
      accessSessionId: value.accessSessionId,
      accessMode: value.accessMode,
      permissions: value.permissions.filter((item): item is string => typeof item === 'string'),
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}

function localSessionContext(request: NextRequest) {
  const token = request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
  const metadata = parseMetadata(request.cookies.get(STAFF_ACCESS_META_COOKIE)?.value);
  const response = json({ active: Boolean(token && metadata), session: token && metadata ? metadata : null });
  if (!token || !metadata) clearStaffSession(response);
  return response;
}

async function proxy(request: NextRequest, context: { params: { path?: string[] } }) {
  const method = request.method.toUpperCase();
  const path = normalizePath(context.params.path || []);

  if (method === 'GET' && path === 'session-context') return localSessionContext(request);
  if (!path || !isAllowed(method, path)) {
    return json({ ok: false, code: 'STAFF_ROUTE_NOT_ALLOWED', message: 'Операция недоступна.' }, 404);
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return json({ ok: false, code: 'UNAUTHENTICATED', message: 'Требуется повторный вход.' }, 401);
  }
  if (!API_URL) {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', message: 'Контур управления временно недоступен.' }, 503);
  }

  if (method === 'POST') {
    const csrf = assertCsrf(request);
    if (!csrf.ok) {
      return json({ ok: false, code: 'CSRF_REJECTED', message: 'Сессия формы устарела. Обнови страницу.' }, 403);
    }
  }

  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const staffAccessToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Запрос превышает допустимый размер.' }, 413);
  }

  let body: string | undefined;
  if (method === 'POST') {
    body = await request.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return json({ ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Запрос превышает допустимый размер.' }, 413);
    }
  }

  const query = request.nextUrl.searchParams.toString();
  const targetUrl = `${API_URL}/staff/${path}${query ? `?${query}` : ''}`;
  const ip = requestIp(request);
  const userAgent = request.headers.get('user-agent');

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-correlation-id': correlationId,
        ...(staffAccessToken ? { 'x-staff-access-session': staffAccessToken } : {}),
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(userAgent ? { 'user-agent': userAgent } : {}),
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    const payload = await upstream.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
    const safePayload = { ...payload, correlationId };
    delete safePayload.accessToken;

    const response = json(safePayload, upstream.status);

    if (upstream.ok && /^access\/grants\/[^/]+\/activate$/.test(path)) {
      const token = typeof payload.accessToken === 'string' ? payload.accessToken : '';
      const sessionId = typeof payload.accessSessionId === 'string' ? payload.accessSessionId : '';
      const accessMode = typeof payload.accessMode === 'string' ? payload.accessMode : '';
      const permissions = Array.isArray(payload.permissions)
        ? payload.permissions.filter((item): item is string => typeof item === 'string')
        : [];
      const expiresAt = typeof payload.expiresAt === 'string' ? payload.expiresAt : '';
      const maxAge = Math.max(1, Math.min(3600, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));

      if (!token || !sessionId || !accessMode || !expiresAt || maxAge <= 0) {
        clearStaffSession(response);
        return json({ ok: false, code: 'STAFF_SESSION_INVALID_RESPONSE', message: 'Не удалось активировать защищённую сессию.', correlationId }, 502);
      }

      const metadata: StaffSessionMetadata = { accessSessionId: sessionId, accessMode, permissions, expiresAt };
      response.cookies.set(STAFF_ACCESS_COOKIE, token, secureCookie(maxAge));
      response.cookies.set(STAFF_ACCESS_META_COOKIE, encodeURIComponent(JSON.stringify(metadata)), secureCookie(maxAge));
    }

    const endedMatch = path.match(/^access\/sessions\/([^/]+)\/(?:end|revoke)$/);
    if (upstream.ok && endedMatch) {
      const current = parseMetadata(request.cookies.get(STAFF_ACCESS_META_COOKIE)?.value);
      if (current?.accessSessionId === endedMatch[1]) clearStaffSession(response);
    }

    if (upstream.status === 401) clearStaffSession(response);
    return response;
  } catch (error) {
    console.error('staff_control_plane_proxy_failure', JSON.stringify({
      correlationId,
      path,
      method,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', message: 'Контур управления временно недоступен.', correlationId }, 503);
  }
}

export function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxy(request, context);
}

export function POST(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxy(request, context);
}
