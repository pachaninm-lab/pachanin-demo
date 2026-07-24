import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf } from '@/lib/server-request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '')
  .trim()
  .replace(/\/$/, '');
const STAFF_ACCESS_COOKIE = 'pc_staff_access_token';
const MAX_BODY_BYTES = 64 * 1024;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;
const ACTIONS = new Set([
  'CREATE_PROFILE',
  'CREATE_DRAFT',
  'UPDATE_DRAFT',
  'SUBMIT_REVIEW',
  'APPROVE',
  'ACTIVATE',
  'DEPRECATE',
  'REVOKE',
]);

function secure(body: unknown, status = 200, correlationId?: string, etag?: string | null) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
      ...(etag ? { ETag: etag } : {}),
    },
  });
}

function resolveApiOrigin(): string {
  if (!API_URL) return '';
  try {
    const url = new URL(API_URL);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

type RouteContext = { params: Promise<{ profileId: string; actionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();
  const csrf = assertCsrf(request);
  if (!csrf.ok) return secure({ code: 'CSRF_REJECTED', correlationId }, 403, correlationId);

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const staffToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
  if (!accessToken || !staffToken) {
    return secure({ code: 'STAFF_SESSION_REQUIRED', correlationId }, 401, correlationId);
  }

  const apiOrigin = resolveApiOrigin();
  if (!apiOrigin) {
    return secure({ code: 'COMMODITY_PROFILE_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
  }

  const { profileId, actionId } = await context.params;
  if (!SAFE_ID.test(profileId) || !ACTIONS.has(actionId)) {
    return secure({ code: 'COMMODITY_PROFILE_ROUTE_NOT_ALLOWED', correlationId }, 404, correlationId);
  }

  const ifMatch = request.headers.get('if-match');
  if (!ifMatch || ifMatch.length > 32) {
    return secure({ code: 'COMMODITY_PROFILE_IF_MATCH_REQUIRED', correlationId }, 428, correlationId);
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_BODY_BYTES) {
    return secure({ code: 'PAYLOAD_TOO_LARGE', correlationId }, 413, correlationId);
  }
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
    return secure({ code: 'PAYLOAD_TOO_LARGE', correlationId }, 413, correlationId);
  }

  const target = `${apiOrigin}/platform-v7/commodity-profiles/${encodeURIComponent(profileId)}/commands/${encodeURIComponent(actionId)}`;
  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Staff-Access-Session': staffToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'If-Match': ifMatch,
        'X-Correlation-Id': correlationId,
      },
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return secure({ code: 'UPSTREAM_REDIRECT_REJECTED', correlationId }, 502, correlationId);
    }
    const payload = await upstream.json().catch(() => null) as unknown;
    if (payload === null) {
      return secure({ code: 'INVALID_UPSTREAM_RESPONSE', correlationId }, 502, correlationId);
    }
    return secure(payload, upstream.status, correlationId, upstream.headers.get('etag'));
  } catch {
    return secure({ code: 'COMMODITY_PROFILE_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
  }
}
