import { randomBytes, timingSafeEqual } from 'crypto';
import { CSRF_COOKIE } from './auth-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookie(request: Request, name: string) {
  const raw = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  const part = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
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
  const current = new URL(request.url).origin;
  if (origin !== current) {
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
