import { randomBytes, timingSafeEqual } from 'crypto';
import { CSRF_COOKIE } from './auth-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookies(request: Request, name: string): string[] {
  const raw = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.startsWith(prefix))
    .map((item) => {
      try {
        return decodeURIComponent(item.slice(prefix.length));
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function firstForwardedValue(value: string | null): string {
  return String(value || '').split(',')[0]?.trim() || '';
}

function originFromHost(protocol: string, host: string): string | null {
  if (!host) return null;
  const normalizedProtocol = protocol === 'http:' || protocol === 'https:' ? protocol : 'https:';
  try {
    return new URL(`${normalizedProtocol}//${host}`).origin;
  } catch {
    return null;
  }
}

function allowedRequestOrigins(request: Request): Set<string> {
  const allowed = new Set<string>();
  let requestUrl: URL | null = null;
  try {
    requestUrl = new URL(request.url);
    allowed.add(requestUrl.origin);
  } catch {
    requestUrl = null;
  }

  const forwardedProtoRaw = firstForwardedValue(request.headers.get('x-forwarded-proto')).toLowerCase();
  const forwardedProto = forwardedProtoRaw === 'http' || forwardedProtoRaw === 'https'
    ? `${forwardedProtoRaw}:`
    : requestUrl?.protocol || 'https:';

  for (const host of [
    firstForwardedValue(request.headers.get('x-forwarded-host')),
    firstForwardedValue(request.headers.get('host')),
  ]) {
    const candidate = originFromHost(forwardedProto, host);
    if (candidate) allowed.add(candidate);
  }

  return allowed;
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

  let normalizedOrigin = '';
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return { ok: false as const, reason: 'origin_invalid' };
  }

  if (!allowedRequestOrigins(request).has(normalizedOrigin)) {
    return { ok: false as const, reason: 'origin_mismatch' };
  }
  return { ok: true as const };
}

export function assertCsrfToken(request: Request, suppliedToken: unknown) {
  if (!isUnsafeMethod(request.method)) return { ok: true as const };
  const sameOrigin = assertSameOriginIfPresent(request);
  if (!sameOrigin.ok) return sameOrigin;

  const cookieTokens = readCookies(request, CSRF_COOKIE);
  const token = typeof suppliedToken === 'string' ? suppliedToken : '';
  if (cookieTokens.length === 0 || !token) {
    return { ok: false as const, reason: 'csrf_missing' };
  }
  if (!cookieTokens.some((cookieToken) => constantTimeEqual(cookieToken, token))) {
    return { ok: false as const, reason: 'csrf_mismatch' };
  }
  return { ok: true as const };
}

export function assertCsrf(request: Request) {
  return assertCsrfToken(request, request.headers.get('x-csrf-token') || '');
}
