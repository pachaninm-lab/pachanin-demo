import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const STAFF_SESSION_COOKIE = 'pc_staff_access_session';
const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;

function apiBaseUrl() {
  const value = String(process.env.API_URL ?? '').trim().replace(/\/$/, '');
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') return null;
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

function findAccessToken(request: NextRequest) {
  for (const cookie of request.cookies.getAll()) {
    const payload = decodeJwtPayload(cookie.value);
    if (!payload) continue;
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') continue;
    if (payload.purpose === 'mfa-login' || payload.type === 'refresh') continue;
    return cookie.value;
  }
  return null;
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

function safePath(segments: string[]) {
  const normalized = segments
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);
  if (normalized.some((segment) => segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\'))) {
    return null;
  }
  return normalized.map(encodeURIComponent).join('/');
}

function isMutation(method: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function isActivationPath(path: string) {
  return /^access\/grants\/[^/]+\/activate$/.test(path);
}

function endsStaffSession(path: string) {
  return /^access\/sessions\/[^/]+\/(end|revoke)$/.test(path)
    || /^break-glass\/[^/]+\/end$/.test(path);
}

function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

export async function proxyStaffRequest(request: NextRequest, segments: string[]) {
  const base = apiBaseUrl();
  if (!base) {
    return noStore(NextResponse.json({
      ok: false,
      code: 'STAFF_API_UNAVAILABLE',
      message: 'Staff control plane is not configured.',
    }, { status: 503 }));
  }

  const path = safePath(segments);
  if (!path) {
    return noStore(NextResponse.json({ ok: false, code: 'INVALID_STAFF_PATH' }, { status: 400 }));
  }
  if (isMutation(request.method) && !sameOrigin(request)) {
    return noStore(NextResponse.json({ ok: false, code: 'CSRF_ORIGIN_REJECTED' }, { status: 403 }));
  }

  const accessToken = findAccessToken(request);
  if (!accessToken) {
    return noStore(NextResponse.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 }));
  }

  let body: ArrayBuffer | undefined;
  if (isMutation(request.method)) {
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_REQUEST_BODY_BYTES) {
      return noStore(NextResponse.json({ ok: false, code: 'REQUEST_TOO_LARGE' }, { status: 413 }));
    }
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_REQUEST_BODY_BYTES) {
      return noStore(NextResponse.json({ ok: false, code: 'REQUEST_TOO_LARGE' }, { status: 413 }));
    }
  }

  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();
  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'X-Correlation-Id': correlationId,
  });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const staffSession = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
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
    return noStore(NextResponse.json({
      ok: false,
      code: 'STAFF_API_UNAVAILABLE',
      correlationId,
    }, { status: 503 }));
  }

  const raw = await upstream.text();
  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = { ok: false, code: 'INVALID_UPSTREAM_RESPONSE', correlationId };
  }

  if (isActivationPath(path) && upstream.ok && payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const opaqueToken = typeof record.accessToken === 'string' ? record.accessToken : null;
    if (!opaqueToken) {
      return noStore(NextResponse.json({ ok: false, code: 'INVALID_STAFF_SESSION_RESPONSE', correlationId }, { status: 502 }));
    }
    const expiresAt = new Date(String(record.expiresAt ?? ''));
    const boundedSeconds = Number.isFinite(expiresAt.getTime())
      ? Math.max(60, Math.min(STAFF_SESSION_MAX_AGE_SECONDS, Math.floor((expiresAt.getTime() - Date.now()) / 1000)))
      : 15 * 60;
    const sanitized = { ...record };
    delete sanitized.accessToken;
    const response = NextResponse.json(sanitized, { status: upstream.status });
    response.cookies.set(STAFF_SESSION_COOKIE, opaqueToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/platform-v7/staff',
      maxAge: boundedSeconds,
    });
    return noStore(response);
  }

  const response = NextResponse.json(payload, { status: upstream.status });
  response.headers.set('X-Correlation-Id', upstream.headers.get('x-correlation-id') || correlationId);
  if (endsStaffSession(path) && upstream.ok) {
    response.cookies.set(STAFF_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/platform-v7/staff',
      maxAge: 0,
    });
  }
  return noStore(response);
}

export { STAFF_SESSION_COOKIE };
