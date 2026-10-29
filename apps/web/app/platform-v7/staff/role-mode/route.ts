import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { requiresCanonicalControlHost } from '@/lib/platform-v7/control-host';
import { resolveServerApiBaseUrl } from '@/lib/server/server-api-origin';
import { assertCsrf } from '@/lib/server-request-security';
import { readBoundedBody } from '../../../../lib/uploads/bounded-body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 12;

const API_BASE_URL = resolveServerApiBaseUrl();
const MAX_BODY_BYTES = 16 * 1024;
const CREATE_INTENT = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

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

function requestIp(request: NextRequest) {
  return (
    request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || ''
  );
}

function boundedString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function correlationId(request: NextRequest) {
  return request.headers.get('x-correlation-id')?.trim().slice(0, 128) || randomUUID();
}

function baseHeaders(request: NextRequest, accessToken: string, correlation: string) {
  const ip = requestIp(request);
  const userAgent = request.headers.get('user-agent');
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'x-correlation-id': correlation,
    ...(ip ? { 'x-forwarded-for': ip } : {}),
    ...(userAgent ? { 'user-agent': userAgent } : {}),
  };
}

async function readJsonBody(request: NextRequest): Promise<JsonRecord | null> {
  let raw: ArrayBuffer | null;
  try {
    raw = await readBoundedBody(request.body, MAX_BODY_BYTES);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(raw)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : null;
  } catch {
    return null;
  }
}

async function proxyRegistry(request: NextRequest, accessToken: string, correlation: string) {
  const upstream = await fetch(`${API_BASE_URL}/staff/founder/role-mode/registry`, {
    headers: baseHeaders(request, accessToken, correlation),
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });
  if (upstream.status >= 300 && upstream.status < 400) {
    return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId: correlation }, 502);
  }
  const payload = await upstream.json().catch(() => ({})) as unknown;
  const safePayload: JsonRecord = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? { ...(payload as JsonRecord), correlationId: correlation }
    : { correlationId: correlation };
  delete safePayload.accessToken;
  return json(safePayload, upstream.status);
}

async function proxyRequest(request: NextRequest, accessToken: string, correlation: string) {
  const csrf = assertCsrf(request);
  if (!csrf.ok) {
    return json({
      ok: false,
      code: 'CSRF_REJECTED',
      message: 'Сессия формы устарела. Обнови страницу.',
      correlationId: correlation,
    }, 403);
  }

  const raw = await readJsonBody(request);
  if (!raw) {
    return json({ ok: false, code: 'INVALID_REQUEST_BODY', correlationId: correlation }, 400);
  }

  const cabinetKey = boundedString(raw.cabinetKey, 2, 32);
  const organizationId = boundedString(raw.organizationId, 3, 128);
  const reason = boundedString(raw.reason, 10, 2000);
  const ticketId = boundedString(raw.ticketId, 3, 128);
  const durationSeconds = raw.durationSeconds === undefined ? 900 : Number(raw.durationSeconds);
  const createIntentId = typeof raw.createIntentId === 'string' && CREATE_INTENT.test(raw.createIntentId)
    ? raw.createIntentId.toLowerCase() : null;

  if (
    !createIntentId
    || !cabinetKey
    || !organizationId
    || !reason
    || !ticketId
    || !Number.isInteger(durationSeconds)
    || durationSeconds < 60
    || durationSeconds > 3600
  ) {
    return json({ ok: false, code: 'ROLE_MODE_REQUEST_INVALID', correlationId: correlation }, 400);
  }

  const upstream = await fetch(`${API_BASE_URL}/staff/founder/role-mode/requests`, {
    method: 'POST',
    headers: {
      ...baseHeaders(request, accessToken, correlation),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      createIntentId,
      cabinetKey,
      organizationId,
      reason,
      ticketId,
      durationSeconds,
    }),
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });

  if (upstream.status >= 300 && upstream.status < 400) {
    return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId: correlation }, 502);
  }
  const payload = await upstream.json().catch(() => ({})) as unknown;
  const safePayload: JsonRecord = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? { ...(payload as JsonRecord), correlationId: correlation }
    : { correlationId: correlation };
  delete safePayload.accessToken;
  return json(safePayload, upstream.status);
}

function withoutCredentials(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (Array.isArray(value)) return value.map((item) => withoutCredentials(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(?:access[_-]?token|refresh[_-]?token|authorization|password|secret|token)$/i.test(key))
    .map(([key, item]) => [key, withoutCredentials(item, depth + 1)]));
}

async function proxyCreateRecovery(request: NextRequest, accessToken: string, correlation: string) {
  const ids = request.nextUrl.searchParams.getAll('createIntentId');
  const views = request.nextUrl.searchParams.getAll('view');
  if (ids.length !== 1 || views.length !== 1 || views[0] !== 'create-intent' || !CREATE_INTENT.test(ids[0])
    || [...request.nextUrl.searchParams.keys()].some((key) => key !== 'view' && key !== 'createIntentId')) {
    return json({ ok: false, code: 'CREATE_INTENT_INVALID', correlationId: correlation }, 400);
  }
  const upstream = await fetch(`${API_BASE_URL}/staff/access/request-intents/${encodeURIComponent(ids[0].toLowerCase())}`, {
    headers: baseHeaders(request, accessToken, correlation), cache: 'no-store', redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });
  if (upstream.status >= 300 && upstream.status < 400) return json({ ok: false, code: 'UPSTREAM_REDIRECT_REJECTED', correlationId: correlation }, 502);
  const raw = await readBoundedBody(upstream.body, 64 * 1024);
  if (!raw) return json({ ok: false, code: 'CREATE_INTENT_RESPONSE_INVALID', correlationId: correlation }, 502);
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(raw)); }
  catch { return json({ ok: false, code: 'CREATE_INTENT_RESPONSE_INVALID', correlationId: correlation }, 502); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ ok: false, code: 'CREATE_INTENT_RESPONSE_INVALID', correlationId: correlation }, 502);
  return json({ ...withoutCredentials(payload) as JsonRecord, correlationId: correlation }, upstream.status);
}

function preflight(request: NextRequest) {
  const correlation = correlationId(request);
  if (requiresCanonicalControlHost(request)) {
    return {
      correlation,
      accessToken: '',
      response: json({ ok: false, code: 'CONTROL_HOST_REQUIRED', correlationId: correlation }, 421),
    };
  }
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
  if (!accessToken) {
    return {
      correlation,
      accessToken,
      response: json({ ok: false, code: 'UNAUTHENTICATED', correlationId: correlation }, 401),
    };
  }
  if (!API_BASE_URL) {
    return {
      correlation,
      accessToken,
      response: json({ ok: false, code: 'STAFF_SERVICE_UNAVAILABLE', correlationId: correlation }, 503),
    };
  }
  return { correlation, accessToken, response: null as NextResponse | null };
}

export async function GET(request: NextRequest) {
  const checked = preflight(request);
  if (checked.response) return checked.response;
  try {
    if (request.nextUrl.searchParams.get('view') === 'session') {
      return json({ ok: false, code: 'ROLE_MODE_SESSION_USE_STAFF_BFF', correlationId: checked.correlation }, 410);
    }
    if (request.nextUrl.searchParams.has('createIntentId') || request.nextUrl.searchParams.has('view')) {
      return await proxyCreateRecovery(request, checked.accessToken, checked.correlation);
    }
    return await proxyRegistry(request, checked.accessToken, checked.correlation);
  } catch {
    return json({
      ok: false,
      code: 'ROLE_MODE_REGISTRY_UNAVAILABLE',
      correlationId: checked.correlation,
    }, 503);
  }
}

export async function POST(request: NextRequest) {
  const checked = preflight(request);
  if (checked.response) return checked.response;
  try {
    return await proxyRequest(request, checked.accessToken, checked.correlation);
  } catch {
    return json({
      ok: false,
      code: 'ROLE_MODE_REQUEST_UNAVAILABLE',
      correlationId: checked.correlation,
    }, 503);
  }
}
