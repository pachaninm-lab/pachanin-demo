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
const MAX_STAFF_SESSION_SECONDS = 60 * 60;

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
  staffRole: string;
  accessMode: string;
  permissions: string[];
  effectiveTenantId: string | null;
  effectiveOrganizationId: string | null;
  effectiveUserId: string | null;
  effectiveRole: string | null;
  targetDealId: string | null;
  reason: string | null;
  ticketId: string | null;
  expiresAt: string;
};

type StaffSessionRow = {
  id?: string;
  status?: string;
  expires_at?: string;
};

function secureCookie(maxAge: number) {
  return {
    path: '/api/staff',
    maxAge,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    priority: 'high' as const,
  };
}

function clearStaffSession(response: NextResponse) {
  for (const name of [STAFF_ACCESS_COOKIE, STAFF_ACCESS_META_COOKIE]) {
    response.cookies.set(name, '', {
      path: '/api/staff',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function normalizePath(segments: string[]) {
  try {
    return segments.map((part) => decodeURIComponent(part).trim()).filter(Boolean).join('/');
  } catch {
    return '';
  }
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

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function parseMetadata(raw: string | undefined): StaffSessionMetadata | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<StaffSessionMetadata>;
    const expiresAtMs = new Date(String(value.expiresAt || '')).getTime();
    if (
      typeof value.accessSessionId !== 'string'
      || typeof value.staffRole !== 'string'
      || typeof value.accessMode !== 'string'
      || !Array.isArray(value.permissions)
      || !Number.isFinite(expiresAtMs)
      || expiresAtMs <= Date.now()
    ) return null;
    return {
      accessSessionId: value.accessSessionId,
      staffRole: value.staffRole,
      accessMode: value.accessMode,
      permissions: value.permissions.filter((item): item is string => typeof item === 'string'),
      effectiveTenantId: optionalString(value.effectiveTenantId),
      effectiveOrganizationId: optionalString(value.effectiveOrganizationId),
      effectiveUserId: optionalString(value.effectiveUserId),
      effectiveRole: optionalString(value.effectiveRole),
      targetDealId: optionalString(value.targetDealId),
      reason: optionalString(value.reason),
      ticketId: optionalString(value.ticketId),
      expiresAt: String(value.expiresAt),
    };
  } catch {
    return null;
  }
}

async function verifiedSessionContext(
  request: NextRequest,
  accessToken: string,
  correlationId: string,
) {
  const token = request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
  const metadata = parseMetadata(request.cookies.get(STAFF_ACCESS_META_COOKIE)?.value);
  if (!token || !metadata) {
    const response = json({ active: false, session: null, correlationId });
    clearStaffSession(response);
    return response;
  }

  try {
    const upstream = await fetch(`${API_URL}/staff/access/sessions`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'x-correlation-id': correlationId,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    });
    if (!upstream.ok) {
      const response = json({ active: false, session: null, correlationId }, upstream.status === 401 ? 401 : 200);
      clearStaffSession(response);
      return response;
    }
    const rows = await upstream.json().catch(() => []) as StaffSessionRow[];
    const active = Array.isArray(rows) && rows.some((row) => {
      const expiry = new Date(String(row.expires_at || '')).getTime();
      return row.id === metadata.accessSessionId
        && (!row.status || row.status === 'ACTIVE')
        && Number.isFinite(expiry)
        && expiry > Date.now();
    });
    const response = json({ active, session: active ? metadata : null, correlationId });
    if (!active) clearStaffSession(response);
    return response;
  } catch {
    return json({
      active: false,
      session: null,
      code: 'STAFF_SESSION_VERIFICATION_UNAVAILABLE',
      message: 'Контур проверки защищённой сессии временно недоступен.',
      correlationId,
    }, 503);
  }
}

async function proxy(request: NextRequest, context: { params: { path?: string[] } }) {
  const method = request.method.toUpperCase();
  const path = normalizePath(context.params.path || []);
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    const response = json({ ok: false, code: 'UNAUTHENTICATED', message: 'Требуется повторный вход.', correlationId }, 401);
    clearStaffSession(response);
    return response;
  }
  if (!API_URL) {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', message: 'Контур управления временно недоступен.', correlationId }, 503);
  }

  if (method === 'GET' && path === 'session-context') {
    return verifiedSessionContext(request, accessToken, correlationId);
  }
  if (!path || !isAllowed(method, path)) {
    return json({ ok: false, code: 'STAFF_ROUTE_NOT_ALLOWED', message: 'Операция недоступна.', correlationId }, 404);
  }

  if (method === 'POST') {
    const csrf = assertCsrf(request);
    if (!csrf.ok) {
      return json({ ok: false, code: 'CSRF_REJECTED', message: 'Сессия формы устарела. Обнови страницу.', correlationId }, 403);
    }
  }

  const staffAccessToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Запрос превышает допустимый размер.', correlationId }, 413);
  }

  let body: string | undefined;
  if (method === 'POST') {
    body = await request.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return json({ ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Запрос превышает допустимый размер.', correlationId }, 413);
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
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
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
    const safePayload: Record<string, unknown> = { ...payload, correlationId };
    delete safePayload.accessToken;
    const response = json(safePayload, upstream.status);

    if (upstream.ok && /^access\/grants\/[^/]+\/activate$/.test(path)) {
      const token = typeof payload.accessToken === 'string' ? payload.accessToken : '';
      const sessionId = typeof payload.accessSessionId === 'string' ? payload.accessSessionId : '';
      const staffRole = typeof payload.staffRole === 'string' ? payload.staffRole : '';
      const accessMode = typeof payload.accessMode === 'string' ? payload.accessMode : '';
      const permissions = Array.isArray(payload.permissions)
        ? payload.permissions.filter((item): item is string => typeof item === 'string')
        : [];
      const expiresAt = typeof payload.expiresAt === 'string' ? payload.expiresAt : '';
      const expiresAtMs = new Date(expiresAt).getTime();
      const rawMaxAge = Math.floor((expiresAtMs - Date.now()) / 1000);
      const maxAge = Number.isFinite(rawMaxAge)
        ? Math.min(MAX_STAFF_SESSION_SECONDS, rawMaxAge)
        : 0;

      if (!token || !sessionId || !staffRole || !accessMode || permissions.length === 0 || !expiresAt || maxAge <= 0) {
        const invalid = json({
          ok: false,
          code: 'STAFF_SESSION_INVALID_RESPONSE',
          message: 'Не удалось активировать защищённую сессию.',
          correlationId,
        }, 502);
        clearStaffSession(invalid);
        return invalid;
      }

      const metadata: StaffSessionMetadata = {
        accessSessionId: sessionId,
        staffRole,
        accessMode,
        permissions,
        effectiveTenantId: optionalString(payload.effectiveTenantId),
        effectiveOrganizationId: optionalString(payload.effectiveOrganizationId),
        effectiveUserId: optionalString(payload.effectiveUserId),
        effectiveRole: optionalString(payload.effectiveRole),
        targetDealId: optionalString(payload.targetDealId),
        reason: optionalString(payload.reason),
        ticketId: optionalString(payload.ticketId),
        expiresAt,
      };
      response.cookies.set(STAFF_ACCESS_COOKIE, token, secureCookie(maxAge));
      response.cookies.set(
        STAFF_ACCESS_META_COOKIE,
        encodeURIComponent(JSON.stringify(metadata)),
        secureCookie(maxAge),
      );
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
