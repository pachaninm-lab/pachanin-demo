import { randomBytes, timingSafeEqual } from 'crypto';
import { CSRF_COOKIE } from './auth-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function readCookie(request: Request, name: string) {
  const raw = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  const part = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

function firstForwardedValue(value: string | null) {
  return String(value || '').split(',')[0]?.trim() || '';
}

function normalizeHttpOrigin(value: string) {
  try {
    const url = new URL(value);
    return HTTP_PROTOCOLS.has(url.protocol) ? url.origin : '';
  } catch {
    return '';
  }
}

/**
 * Resolve the browser-facing target origin rather than the internal Node URL.
 *
 * Production is behind a TLS-terminating reverse proxy. OWASP and Next.js both
 * require Origin checks to compare against the public Host/X-Forwarded-Host
 * boundary in that topology. A configured site URL, when present, remains the
 * strongest authority; otherwise we use the proxy-preserved host/proto pair.
 */
export function resolveRequestTargetOrigin(request: Request) {
  const configured = String(process.env.PC_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) return normalizeHttpOrigin(configured);

  const forwardedHost = firstForwardedValue(request.headers.get('x-forwarded-host'));
  const host = forwardedHost || firstForwardedValue(request.headers.get('host'));
  const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto')).toLowerCase();

  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return '';
  }

  const protocol = forwardedProto === 'http' || forwardedProto === 'https'
    ? `${forwardedProto}:`
    : requestUrl.protocol;

  if (host && HTTP_PROTOCOLS.has(protocol)) {
    const proxiedOrigin = normalizeHttpOrigin(`${protocol}//${host}`);
    if (proxiedOrigin) return proxiedOrigin;
  }

  return HTTP_PROTOCOLS.has(requestUrl.protocol) ? requestUrl.origin : '';
}

export function isUnsafeMethod(method?: string | null) {
  return !SAFE_METHODS.has(String(method || 'GET').toUpperCase());
}

export function generateCsrfToken() {
  return randomBytes(24).toString('hex');
}

export function assertSameOriginIfPresent(request: Request) {
  const originHeader = request.headers.get('origin');
  if (!originHeader) return { ok: true as const };

  const sourceOrigin = normalizeHttpOrigin(originHeader);
  const targetOrigin = resolveRequestTargetOrigin(request);
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
