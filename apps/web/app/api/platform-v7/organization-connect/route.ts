import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const MAX_BODY_BYTES = 8 * 1024;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

const allowedRoles = new Set([
  'PRODUCER_SELLER',
  'BUYER_PROCESSOR',
  'LOGISTICS',
  'STORAGE_ELEVATOR',
  'LAB_SURVEYOR',
  'BANK_FINANCE',
  'PUBLIC_INDUSTRY_PARTNER',
]);
const allowedScenarios = new Set([
  'DEAL_EXECUTION',
  'LOGISTICS_ACCEPTANCE',
  'QUALITY_LAB',
  'DOCUMENTS_EVIDENCE',
  'FINANCE_SETTLEMENT',
  'EXTERNAL_INTEGRATION',
]);
const allowedLocales = new Set(['ru', 'en', 'zh']);

type IntakePayload = {
  organizationName: string;
  inn: string;
  contactName: string;
  position: string;
  phone: string;
  email: string;
  organizationRole: string;
  scenario: string;
  locale: string;
  consent: true;
};

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function requestIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  );
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalize(body: Record<string, unknown>): IntakePayload | null {
  const payload = {
    organizationName: text(body.organizationName, 200),
    inn: text(body.inn, 12).replace(/\D/g, ''),
    contactName: text(body.contactName, 160),
    position: text(body.position, 160),
    phone: text(body.phone, 32),
    email: text(body.email, 254).toLowerCase(),
    organizationRole: text(body.organizationRole, 48),
    scenario: text(body.scenario, 48),
    locale: text(body.locale, 2),
    consent: body.consent === true,
  };
  if (
    payload.organizationName.length < 2 ||
    !/^\d{10}(?:\d{2})?$/.test(payload.inn) ||
    payload.contactName.length < 2 ||
    payload.position.length < 2 ||
    !/^\+?[0-9()\-\s]{7,32}$/.test(payload.phone) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
    !allowedRoles.has(payload.organizationRole) ||
    !allowedScenarios.has(payload.scenario) ||
    !allowedLocales.has(payload.locale) ||
    !payload.consent
  ) return null;
  return payload as IntakePayload;
}

export async function POST(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
  if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    return json({ ok: false, code: 'INVALID_IDEMPOTENCY_KEY', correlationId }, 400);
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, code: 'REQUEST_TOO_LARGE', correlationId }, 413);
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const payload = body ? normalize(body) : null;
  if (!payload) return json({ ok: false, code: 'INVALID_REQUEST', correlationId }, 400);
  if (!API_URL) return json({ ok: false, code: 'INTAKE_UNAVAILABLE', correlationId }, 503);

  const ip = requestIp(request);
  if (!ip) return json({ ok: false, code: 'REQUEST_SOURCE_UNAVAILABLE', correlationId }, 503);

  try {
    const upstream = await fetch(`${API_URL}/organization-intake/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': idempotencyKey,
        'x-correlation-id': correlationId,
        'x-forwarded-for': ip,
        ...(request.headers.get('user-agent') ? { 'user-agent': request.headers.get('user-agent')! } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    });
    const result = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    if (!upstream.ok) {
      const code = upstream.status === 429
        ? 'RATE_LIMITED'
        : upstream.status === 409
          ? 'IDEMPOTENCY_CONFLICT'
          : upstream.status === 400
            ? 'INVALID_REQUEST'
            : 'INTAKE_UNAVAILABLE';
      return json({ ok: false, code, correlationId }, upstream.status >= 500 ? 503 : upstream.status);
    }
    if (
      typeof result.requestNumber !== 'string' ||
      typeof result.status !== 'string' ||
      typeof result.replay !== 'boolean'
    ) {
      return json({ ok: false, code: 'INVALID_UPSTREAM_RESPONSE', correlationId }, 502);
    }
    return json({
      ok: true,
      requestNumber: result.requestNumber,
      status: result.status,
      replay: result.replay,
      correlationId: typeof result.correlationId === 'string' ? result.correlationId : correlationId,
    }, upstream.status === 201 ? 201 : 200);
  } catch {
    return json({ ok: false, code: 'INTAKE_UNAVAILABLE', correlationId }, 503);
  }
}
