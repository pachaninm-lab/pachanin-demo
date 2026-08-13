import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/gekta/account-bridge';

const MAX_JSON_BYTES = 16 * 1024;

export type UpstreamResult = {
  ok: boolean;
  status: number;
  payload: Record<string, unknown>;
};

export function authJson(body: Record<string, unknown>, status = 200) {
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

export function correlationId(request: Request) {
  return String(request.headers.get('x-correlation-id') || randomUUID()).slice(0, 128);
}

export function accountHash(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
}

export function requestIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '';
}

export function publicOrigin(request: Request): string {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.PC_PUBLIC_ORIGIN || '').trim().replace(/\/$/u, '');
  if (/^https?:\/\/[^/]+/u.test(configured)) return configured;
  return new URL(request.url).origin;
}

export function mailChannelConfigured() {
  const resend = Boolean(process.env.RESEND_API_KEY && (process.env.RESEND_FROM_EMAIL || process.env.PC_MAIL_FROM));
  const smtp = Boolean(process.env.PC_SMTP_HOST && process.env.PC_SMTP_USER && process.env.PC_SMTP_PASS);
  return resend || smtp;
}

export async function readSmallJson(request: Request): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) return null;
  try {
    const text = await request.text();
    if (!text || Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) return null;
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function postGektaAuth(
  request: Request,
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<UpstreamResult> {
  const base = apiBaseUrl();
  if (!base || !/^[a-z/-]+$/u.test(path)) {
    return { ok: false, status: 503, payload: { code: 'AUTH_SERVICE_UNAVAILABLE' } };
  }
  const id = correlationId(request);
  const ip = requestIp(request);
  try {
    const response = await fetch(`${base}/gekta/auth/${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Correlation-Id': id,
        ...(ip ? { 'X-Forwarded-For': ip } : {}),
        ...(request.headers.get('user-agent') ? { 'User-Agent': String(request.headers.get('user-agent')) } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, status: 502, payload: { code: 'UPSTREAM_REDIRECT_REJECTED' } };
    }
    const payload = await response.json().catch(() => ({})) as unknown;
    return {
      ok: response.ok,
      status: response.status,
      payload: payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {},
    };
  } catch (error) {
    console.error('gekta_auth_transport_failure', JSON.stringify({
      correlationId: id,
      path,
      reason: error instanceof Error ? error.name : 'unknown',
    }));
    return { ok: false, status: 503, payload: { code: 'AUTH_SERVICE_UNAVAILABLE' } };
  }
}
