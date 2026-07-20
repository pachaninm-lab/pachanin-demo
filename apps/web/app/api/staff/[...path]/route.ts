import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
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
  staff_role?: string;
  access_mode?: string;
  permissions?: unknown;
  effective_tenant_id?: string | null;
  effective_organization_id?: string | null;
  effective_user_id?: string | null;
  effective_role?: string | null;
  target_deal_id?: string | null;
  reason?: string | null;
  ticket_id?: string | null;
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

function normalizePath(segments: string[]) {
  try {
    const decoded = segments.map((part) => decodeURIComponent(part).trim()).filter(Boolean);
    if (decoded.some((part) => part === '.' || part === '..' || part.includes('/') || part.includes('\\'))) return '';
    return decoded.join('/');
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
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

async function listOwnSessions(accessToken: string, correlationId: string): Promise<StaffSessionRow[]> {
  const upstream = await fetch(`${API_URL}/staff/access/sessions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'x-correlation-id': correlationId,
    },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(6_000),
  });
  if (!upstream.ok) throw new Error(`staff_session_list_${upstream.status}`);
  const rows = await upstream.json().catch(() => []) as unknown;
  return Array.isArray(rows) ? rows as StaffSessionRow[] : [];
}

function persistedMetadata(row: StaffSessionRow): StaffSessionMetadata | null {
  const expiresAt = optionalString(row.expires_at);
  const expiry = new Date(expiresAt || '').getTime();
  const permissions = stringArray(row.permissions);
  if (
    !row.id
    || (row.status && row.status !== 'ACTIVE')
    || !row.staff_role
    || !row.access_mode
    || !expiresAt
    || !Number.isFinite(expiry)
    || expiry <= Date.now()
    || permissions.length === 0
  ) return null;

  return {
    accessSessionId: row.id,
    staffRole: row.staff_role,
    accessMode: row.access_mode,
    permissions,
    effectiveTenantId: optionalString(row.effective_tenant_id),
    effectiveOrganizationId: optionalString(row.effective_organization_id),
    effectiveUserId: optionalString(row.effective_user_id),
    effectiveRole: optionalString(row.effective_role),
    targetDealId: optionalString(row.target_deal_id),
    reason: optionalString(row.reason),
    ticketId: optionalString(row.ticket_id),
    expiresAt,
  };
}

async function cleanupActivatedSession(accessToken: string, sessionId: string, correlationId: string) {
  try {
    await fetch(`${API_URL}/staff/access/sessions/${encodeURIComponent(sessionId)}/end`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ reason: 'Activation metadata verification failed' }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    // Backend TTL still bounds an orphaned session if cleanup transport is unavailable.
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
    const rows = await listOwnSessions(accessToken, correlationId);
    const persisted = rows.find((row) => row.id === metadata.accessSessionId);
    const verified = persistedMetadata(persisted || {});
    const active = Boolean(
      verified
      && verified.accessSessionId === metadata.accessSessionId
      && verified.staffRole === metadata.staffRole
      && verified.accessMode === metadata.accessMode
      && verified.expiresAt === metadata.expiresAt,
    );
    const response = json({ active, session: active ? verified : null, correlationId });
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

async function proxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const method = request.method.toUpperCase();
  const { path: pathSegments = [] } = await context.params;
  const path = normalizePath(pathSegments);
  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    const response = json({ ok: false, code: 'UNAUTHENTICATED', message: 'Требуется повторный вход.', correlationId }, 401);
    clearStaffSession(response);
    return response;
  }
  if (!API_URL) {
    return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', message: 'Контур управления временно недоступен.', correlationId }, 503);
  }

  let apiOrigin: string;
  try {
    const url = new URL(API_URL);
    if (
      process.env.NODE_ENV === 'production'
      && url.protocol !== 'https:'
      && process.env.PC_INTERNAL_API_ALLOW_HTTP !== 'true'
    ) {
      return json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', message: 'Контур управления временно недоступен.', correlationId }, 503);
    }
    apiOrigin = url.toString().replace(/\/$/, '');
  } catch {
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
  const targetUrl = `${apiOrigin}/staff/${path}${query ? `?${query}` : ''}`;
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
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId }, 502);
    }

    const payload = await upstream.json().catch(() => ({})) as unknown;
    const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const safePayload: Record<string, unknown> = { ...payloadObject, correlationId };
    delete safePayload.accessToken;
    let response = json(Array.isArray(payload) ? payload : safePayload, upstream.status);

    if (upstream.ok && /^access\/grants\/[^/]+\/activate$/.test(path)) {
      const token = typeof payloadObject.accessToken === 'string' ? payloadObject.accessToken : '';
      const sessionId = typeof payloadObject.accessSessionId === 'string' ? payloadObject.accessSessionId : '';
      let metadata: StaffSessionMetadata | null = null;

      if (token && sessionId) {
        const rows = await listOwnSessions(accessToken, correlationId).catch(() => []);
        metadata = persistedMetadata(rows.find((row) => row.id === sessionId) || {});
      }

      const expiry = new Date(metadata?.expiresAt || '').getTime();
      const rawMaxAge = Math.floor((expiry - Date.now()) / 1000);
      const maxAge = Number.isFinite(rawMaxAge)
        ? Math.min(MAX_STAFF_SESSION_SECONDS, rawMaxAge)
        : 0;

      if (!token || !sessionId || !metadata || metadata.accessSessionId !== sessionId || maxAge <= 0) {
        if (sessionId) await cleanupActivatedSession(accessToken, sessionId, correlationId);
        const invalid = json({
          ok: false,
          code: 'STAFF_SESSION_INVALID_RESPONSE',
          message: 'Не удалось активировать защищённую сессию.',
          correlationId,
        }, 502);
        clearStaffSession(invalid);
        return invalid;
      }

      safePayload.staffRole = metadata.staffRole;
      safePayload.accessMode = metadata.accessMode;
      safePayload.permissions = metadata.permissions;
      safePayload.effectiveTenantId = metadata.effectiveTenantId;
      safePayload.effectiveOrganizationId = metadata.effectiveOrganizationId;
      safePayload.effectiveUserId = metadata.effectiveUserId;
      safePayload.effectiveRole = metadata.effectiveRole;
      safePayload.targetDealId = metadata.targetDealId;
      safePayload.reason = metadata.reason;
      safePayload.ticketId = metadata.ticketId;
      safePayload.expiresAt = metadata.expiresAt;
      response = json(safePayload, upstream.status);
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

export function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, context);
}

export function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, context);
}
