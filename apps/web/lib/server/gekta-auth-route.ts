import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

export const GEKTA_AUTH_TIMEOUT_MS = 7_000;
const GEKTA_AUTH_MAX_JSON_BYTES = 16 * 1_024;

export function gektaAuthJson(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function readGektaAuthJson(request: Request): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > GEKTA_AUTH_MAX_JSON_BYTES) return null;
  try {
    const text = await request.text();
    if (!text || Buffer.byteLength(text, 'utf8') > GEKTA_AUTH_MAX_JSON_BYTES) return null;
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function gektaApiBase(): string {
  return String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/u, '');
}

export function registrationDeliveryKey(): string {
  return String(process.env.REGISTRATION_DELIVERY_KEY || '').trim();
}

export function requestIp(request: Request): string {
  return request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '';
}

export function gektaForwardHeaders(
  request: Request,
  correlationId: string,
  options: { deliveryKey?: string; accessToken?: string } = {},
): Record<string, string> {
  const ip = requestIp(request);
  const userAgent = request.headers.get('user-agent');
  return {
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId,
    ...(ip ? { 'x-forwarded-for': ip } : {}),
    ...(userAgent ? { 'user-agent': userAgent } : {}),
    ...(options.deliveryKey ? { 'x-registration-delivery-key': options.deliveryKey } : {}),
    ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
  };
}

export function accountHash(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 16);
}

export function safeLocale(value: unknown): 'ru' | 'en' | 'zh' {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

export function validEmail(value: string): boolean {
  return value.length <= 254 && /^\S+@\S+\.\S+$/u.test(value);
}
