import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export type StaffBffChannel = 'control' | 'delegated';

const CONTROL_COOKIE = 'pc_staff_control_session';
const DELEGATED_COOKIE = 'pc_staff_delegated_session';
const MAX_SESSION_AGE_SECONDS = 60 * 60;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;

function apiBaseUrl() {
  const raw = String(process.env.API_URL ?? '').trim().replace(/\/$/, '');
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function decodeJwtPayload(value: string): Record<string, unknown> | null {
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function accessToken(request: NextRequest) {
  for (const cookie of request.cookies.getAll()) {
    const payload = decodeJwtPayload(cookie.value);
    if (!payload) continue;
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') continue;
    if (payload.purpose === 'mfa-login' || payload.type === 'refresh') continue;
    return cookie.value;
  }
  return null;
}

function safePath(segments: string[]) {
  const decoded = segments.map((segment) => decodeURIComponent(segment).trim()).filter(Boolean);
  if (decoded.some((segment) => segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\'))) {
    return null;
  }
  return decoded.map(encodeURIComponent).join('/');
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function mutating(method: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function activationPath(path: string) {
  return /^access\/grants\/[^/]+\/activate$/.test(path);
}

function sessionCookieForMode(mode: unknown) {
  return ['VIEW_AS', 'ASSISTED', 'OPERATIONS', 'BREAK_GLASS'].includes(String(mode))
    ? DELEGATED_COOKIE
    : CONTROL_COOKIE;
}

function selectedCookie(channel: StaffBffChannel) {
  return channel === 'delegated' ? DELEGATED_COOKIE : CONTROL_COOKIE;
}

function clearsSession(path: string) {
  return /^access\/sessions\/[^/]+\/(end|revoke)$/.test(path)
    || /^break-glass\/[^/]+\/end$/.test(path);
}

function secure(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

function error(status: number, code: string, correlationId?: string) {
  return secure(NextResponse.json({ ok: false, code, correlationId }, { status }));
}

export async function proxyStaffChannel(
  request: NextRequest,
  segments: string[],
  channel: StaffBffChannel,
) {
  const base = apiBaseUrl();
  if (!base) return error(503, 'STAFF_API_UNAVAILABLE');

  const path = safePath(segments);
  if (!path) return error(400, 'INVALID_STAFF_PATH');
  if (mutating(request.method) && !sameOrigin(request)) return error(403, 'CSRF_ORIGIN_REJECTED');

  const bearer = accessToken(request);
  if (!bearer) return error(401, 'AUTH_REQUIRED');

  let body: ArrayBuffer | undefined;
  if (mutating(request.method)) {
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_REQUEST_BODY_BYTES) return error(413, 'REQUEST_TOO_LARGE');
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_REQUEST_BODY_BYTES) return error(413, 'REQUEST_TOO_LARGE');
  }

  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();
  const headers = new Headers({
    Authorization: `Bearer ${bearer}`,
    Accept: 'application/json',
    'X-Correlation-Id': correlationId,
  });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const staffSession = request.cookies.get(selectedCookie(channel))?.value;
  if (staffSession) headers.set('X-Staff-Access-Session', staffSession);

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/staff/${path}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return error(503, 'STAFF_API_UNAVAILABLE', correlationId);
  }

  const raw = await upstream.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    return error(502, 'INVALID_UPSTREAM_RESPONSE', correlationId);
  }

  if (activationPath(path) && upstream.ok && payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const opaque = typeof record.accessToken === 'string' ? record.accessToken : null;
    if (!opaque) return error(502, 'INVALID_STAFF_SESSION_RESPONSE', correlationId);
    const expiresAt = new Date(String(record.expiresAt ?? ''));
    const maxAge = Number.isFinite(expiresAt.getTime())
      ? Math.max(60, Math.min(MAX_SESSION_AGE_SECONDS, Math.floor((expiresAt.getTime() - Date.now()) / 1000)))
      : 15 * 60;
    const sanitized = { ...record };
    delete sanitized.accessToken;
    const response = NextResponse.json(sanitized, { status: upstream.status });
    response.cookies.set(sessionCookieForMode(record.accessMode), opaque, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/platform-v7/staff',
      maxAge,
    });
    response.headers.set('X-Correlation-Id', correlationId);
    return secure(response);
  }

  const response = NextResponse.json(payload, { status: upstream.status });
  response.headers.set('X-Correlation-Id', upstream.headers.get('x-correlation-id') || correlationId);
  if (clearsSession(path) && upstream.ok) {
    response.cookies.set(selectedCookie(channel), '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/platform-v7/staff',
      maxAge: 0,
    });
  }
  return secure(response);
}

export const STAFF_CONTROL_COOKIE = CONTROL_COOKIE;
export const STAFF_DELEGATED_COOKIE = DELEGATED_COOKIE;
