import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '')
  .trim()
  .replace(/\/$/, '');
const READ_PATHS = [
  /^$/,
  /^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$/,
] as const;

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

function normalizePath(segments: string[]) {
  try {
    const decoded = segments.map((part) => decodeURIComponent(part).trim()).filter(Boolean);
    if (decoded.some((part) => part === '.' || part === '..' || part.includes('/') || part.includes('\\'))) return '';
    return decoded.join('/');
  } catch {
    return '';
  }
}

function apiOrigin(): string {
  if (!API_URL) return '';
  try {
    const url = new URL(API_URL);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return secure({ code: 'UNAUTHENTICATED', correlationId }, 401, correlationId);

  const origin = apiOrigin();
  if (!origin) return secure({ code: 'INTEGRATION_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
  const { path: segments = [] } = await context.params;
  const path = normalizePath(segments);
  if (!READ_PATHS.some((rule) => rule.test(path))) {
    return secure({ code: 'INTEGRATION_ROUTE_NOT_ALLOWED', correlationId }, 404, correlationId);
  }
  const query = request.nextUrl.searchParams.toString();
  const target = `${origin}/platform-v7/integrations${path ? `/${path}` : ''}${query ? `?${query}` : ''}`;
  try {
    const upstream = await fetch(target, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'X-Correlation-Id': correlationId,
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return secure({ code: 'UPSTREAM_REDIRECT_REJECTED', correlationId }, 502, correlationId);
    }
    const payload = await upstream.json().catch(() => null) as unknown;
    if (payload === null) return secure({ code: 'INVALID_UPSTREAM_RESPONSE', correlationId }, 502, correlationId);
    return secure(payload, upstream.status, correlationId, upstream.headers.get('etag'));
  } catch {
    return secure({ code: 'INTEGRATION_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
  }
}
