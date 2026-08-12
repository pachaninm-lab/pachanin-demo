import { randomBytes, timingSafeEqual } from 'crypto';
import { CSRF_COOKIE } from './auth-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookie(request: Request, name: string) {
  const raw = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  const part = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

function firstForwardedValue(value: string | null) {
  return String(value || '').split(',')[0]?.trim() || '';
}

function parseHttpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function resolveTargetOrigin(request: Request): string | null {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) {
    return parseHttpOrigin(configured);
  }

  // Production terminates TLS at the controlled reverse proxy. The proxy
  // overwrites Host and X-Forwarded-Proto before forwarding to the web runtime,
  // so these two headers describe the public target origin even when request.url
  // contains the internal container address. Do not trust client-supplied
  // X-Forwarded-Host here: the current proxy contract does not overwrite it.
  const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto')).toLowerCase();
  const host = firstForwardedValue(request.headers.get('host'));
  if ((forwardedProto === 'http' || forwardedProto === 'https') && host) {
    const proxyOrigin = parseHttpOrigin(`${forwardedProto}://${host}`);
    if (proxyOrigin) return proxyOrigin;
  }

  return parseHttpOrigin(request.url);
}

export function isUnsafeMethod(method?: string | null) {
  return !SAFE_METHODS.has(String(method || 'GET').toUpperCase());
}

export function generateCsrfToken() {
  return randomBytes(24).toString('hex');
}

export function assertSameOriginIfPresent(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return { ok: true as const };

  const sourceOrigin = parseHttpOrigin(origin);
  const targetOrigin = resolveTargetOrigin(request);
  if (!sourceOrigin || !targetOrigin || sourceOrigin !== targetOrigin) {
    return { ok: false as const, reason: 'origin_mismatch' };
  }
  return { ok: true as const };
}

export function assertCsrf(request: Request) {
  if (!isUnsafeMethod(request.method)) return { ok: true as const };
  const sameOrigin = assertSameOriginIfPresent(request);
  if (!sameOrigin.ok) return sameOrigin;
  const cookieToken = readCookie(request, CSRF_COOKIE);
  const headerToken = String(request.headers.get('x-csrf-token') || '');
  if (!cookieToken || !headerToken) {
    return { ok: false as const, reason: 'csrf_missing' };
  }
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false as const, reason: 'csrf_mismatch' };
  }
  return { ok: true as const };
}
