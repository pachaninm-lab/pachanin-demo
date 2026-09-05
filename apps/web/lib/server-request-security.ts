import { randomBytes, timingSafeEqual } from 'crypto';
import { CSRF_COOKIE } from './auth-cookies';
import {
  CONTROL_PLATFORM_HOST,
  PRIMARY_PLATFORM_HOST,
  requestAuthorityHost,
} from './platform-v7/control-host';

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

function resolveConfiguredTargetOrigin(request: Request, configured: string) {
  const configuredOrigin = normalizeHttpOrigin(configured);
  if (!configuredOrigin) return '';

  const configuredUrl = new URL(configuredOrigin);
  const authorityHost = requestAuthorityHost(request);

  // The staff/control realm is a second exact browser origin of the same
  // platform. Derive it only when both sides of that relationship are exact:
  // the configured origin is the canonical primary platform host and the
  // application boundary received the canonical control Host. No wildcard or
  // X-Forwarded-Host value participates in this decision.
  if (
    configuredUrl.hostname === PRIMARY_PLATFORM_HOST
    && authorityHost === CONTROL_PLATFORM_HOST
  ) {
    configuredUrl.hostname = CONTROL_PLATFORM_HOST;
    return configuredUrl.origin;
  }

  return configuredOrigin;
}

/**
 * Resolve the browser-facing target origin rather than the internal Node URL.
 *
 * An explicitly configured public origin is the strongest authority. The exact
 * control host is the only additional platform origin derived from it. Otherwise
 * the production reverse proxy contract overwrites Host and X-Forwarded-Proto,
 * so only that pair is trusted to reconstruct the public target origin. Do not
 * trust X-Forwarded-Host here: the current proxy contract does not overwrite it.
 */
export function resolveRequestTargetOrigin(request: Request) {
  const configured = String(process.env.PC_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) return resolveConfiguredTargetOrigin(request, configured);

  const host = firstForwardedValue(request.headers.get('host'));
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
