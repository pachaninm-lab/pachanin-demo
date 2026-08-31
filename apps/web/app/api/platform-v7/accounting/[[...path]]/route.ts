import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';

/**
 * The accounting BFF.
 *
 * A forwarder and nothing else: it holds no state, invents no data and has no
 * fallback. When the API cannot be reached it says so — an accounting screen
 * that shows figures from a cache while the server is unreachable is a screen
 * that shows figures nobody can stand behind.
 *
 * The path allowlist is explicit rather than a wildcard. A proxy that forwards
 * whatever it is given is a way to reach every route the API has, from a
 * surface whose own access rules are weaker.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '')
  .trim()
  .replace(/\/$/, '');

const ID = '[A-Za-z0-9][A-Za-z0-9:_.@-]{0,239}';

/** Reads the dashboard needs. */
const READ_PATHS: readonly RegExp[] = [
  new RegExp('^tasks$'),
  new RegExp('^tasks/projection$'),
  new RegExp('^periods$'),
  new RegExp(`^deals/${ID}/source-snapshot$`),
  new RegExp(`^documents/versions/${ID}/transmission-readiness$`),
];

/** Writes the dashboard needs. Deliberately short. */
const WRITE_PATHS: readonly RegExp[] = [
  new RegExp('^tasks$'),
  new RegExp(`^tasks/${ID}/transition$`),
  new RegExp('^tasks/derive$'),
  new RegExp('^periods$'),
  new RegExp(`^periods/${ID}/advance$`),
  new RegExp('^periods/derive$'),
];

function secure(body: unknown, status: number, correlationId: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Correlation-Id': correlationId,
    },
  });
}

function normalizePath(segments: string[]): string {
  try {
    const decoded = segments.map((part) => decodeURIComponent(part).trim()).filter(Boolean);
    if (
      decoded.some(
        (part) => part === '.' || part === '..' || part.includes('/') || part.includes('\\'),
      )
    ) {
      return '';
    }
    return decoded.join('/');
  } catch {
    return '';
  }
}

function resolveApiOrigin(): string {
  if (!API_URL) return '';
  try {
    const url = new URL(API_URL);
    // In production an http origin is refused rather than downgraded to: the
    // documents behind these routes are the organization's accounting.
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

type RouteContext = { params: Promise<{ path?: string[] }> };

async function forward(
  request: NextRequest,
  context: RouteContext,
  method: 'GET' | 'POST',
  allowed: readonly RegExp[],
) {
  const correlationId = request.headers.get('x-correlation-id')?.slice(0, 128) || randomUUID();
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return secure({ code: 'UNAUTHENTICATED', correlationId }, 401, correlationId);
  }

  const apiOrigin = resolveApiOrigin();
  if (!apiOrigin) {
    return secure({ code: 'ACCOUNTING_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
  }

  const { path: segments = [] } = await context.params;
  const path = normalizePath(segments);
  if (!allowed.some((rule) => rule.test(path))) {
    return secure({ code: 'ACCOUNTING_ROUTE_NOT_ALLOWED', correlationId }, 404, correlationId);
  }

  const query = request.nextUrl.searchParams.toString();
  const target = `${apiOrigin}/accounting/${path}${query ? `?${query}` : ''}`;
  const body = method === 'POST' ? await request.text() : undefined;

  try {
    const upstream = await fetch(target, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'X-Correlation-Id': correlationId,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return secure({ code: 'UPSTREAM_REDIRECT_REJECTED', correlationId }, 502, correlationId);
    }
    const payload = (await upstream.json().catch(() => null)) as unknown;
    if (payload === null) {
      return secure({ code: 'INVALID_UPSTREAM_RESPONSE', correlationId }, 502, correlationId);
    }
    return secure(payload, upstream.status, correlationId);
  } catch {
    return secure({ code: 'ACCOUNTING_SERVICE_UNAVAILABLE', correlationId }, 503, correlationId);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, context, 'GET', READ_PATHS);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, context, 'POST', WRITE_PATHS);
}
