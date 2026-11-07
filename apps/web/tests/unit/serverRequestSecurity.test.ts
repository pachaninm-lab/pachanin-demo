import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertCsrf,
  assertSameOriginIfPresent,
  resolveRequestTargetOrigin,
  resolveSameOriginRedirectTarget,
  toPathAbsoluteReference,
} from '../../lib/server-request-security';

const TOKEN = 'a'.repeat(48);
const PRIMARY_HOST = 'xn----8sbjf4befbjgs9b.xn--p1ai';
const CONTROL_HOST = `control.${PRIMARY_HOST}`;

function clearConfiguredOrigin() {
  vi.stubEnv('PC_PUBLIC_ORIGIN', '');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
}

function configurePrimaryOrigin() {
  vi.stubEnv('PC_PUBLIC_ORIGIN', 'https://процент-агро.рф');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
}

function request(options: {
  url?: string;
  origin?: string;
  host?: string;
  forwardedHost?: string;
  forwardedProto?: string;
  token?: string;
  headerToken?: string;
} = {}) {
  const token = options.token ?? TOKEN;
  const headerValues = new Map<string, string>([
    ['host', options.host ?? 'web:3000'],
    ['cookie', `pc_csrf_token=${token}`],
    ['x-csrf-token', options.headerToken ?? token],
  ]);
  if (options.origin) headerValues.set('origin', options.origin);
  if (options.forwardedHost) headerValues.set('x-forwarded-host', options.forwardedHost);
  if (options.forwardedProto) headerValues.set('x-forwarded-proto', options.forwardedProto);

  // These helpers execute on the server. Browser-like test environments may
  // strip forbidden request headers such as Host/Cookie/Origin, so use a
  // minimal server Request contract instead of the browser Fetch constructor.
  return {
    url: options.url ?? 'http://web:3000/api/auth/forgot-password',
    method: 'POST',
    headers: {
      get(name: string) {
        return headerValues.get(name.toLowerCase()) ?? null;
      },
    },
  } as unknown as Request;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server request security target-origin resolution', () => {
  it('accepts a same-origin POST behind the production TLS-terminating reverse proxy', () => {
    clearConfiguredOrigin();
    const req = request({
      origin: `https://${PRIMARY_HOST}`,
      host: PRIMARY_HOST,
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe(`https://${PRIMARY_HOST}`);
    expect(assertSameOriginIfPresent(req)).toEqual({ ok: true });
    expect(assertCsrf(req)).toEqual({ ok: true });
  });

  it('accepts the exact control origin when the canonical primary origin is configured', () => {
    configurePrimaryOrigin();
    const req = request({
      origin: `https://${CONTROL_HOST}`,
      host: CONTROL_HOST,
      forwardedHost: 'attacker.example',
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe(`https://${CONTROL_HOST}`);
    expect(assertSameOriginIfPresent(req)).toEqual({ ok: true });
    expect(assertCsrf(req)).toEqual({ ok: true });
  });

  it('does not promote X-Forwarded-Host into the exact control origin', () => {
    configurePrimaryOrigin();
    const req = request({
      origin: `https://${CONTROL_HOST}`,
      host: PRIMARY_HOST,
      forwardedHost: CONTROL_HOST,
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe(`https://${PRIMARY_HOST}`);
    expect(assertSameOriginIfPresent(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('does not treat platform subdomains as a wildcard control origin', () => {
    configurePrimaryOrigin();
    const wildcardLikeHost = `nested.${CONTROL_HOST}`;
    const req = request({
      origin: `https://${wildcardLikeHost}`,
      host: wildcardLikeHost,
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe(`https://${PRIMARY_HOST}`);
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('rejects an attacker subdomain even when Host is the exact control authority', () => {
    configurePrimaryOrigin();
    const req = request({
      origin: `https://attacker.${CONTROL_HOST}`,
      host: CONTROL_HOST,
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe(`https://${CONTROL_HOST}`);
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('does not trust X-Forwarded-Host when the proxy contract does not overwrite it', () => {
    clearConfiguredOrigin();
    const req = request({
      origin: 'https://attacker.example',
      host: PRIMARY_HOST,
      forwardedHost: 'attacker.example',
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe(`https://${PRIMARY_HOST}`);
    expect(assertSameOriginIfPresent(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('fails closed if Host is internal and no configured public origin is available', () => {
    clearConfiguredOrigin();
    const req = request({
      origin: `https://${PRIMARY_HOST}`,
      host: 'web:3000',
      forwardedHost: PRIMARY_HOST,
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe('https://web:3000');
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('still rejects a cross-origin request even when the CSRF token matches', () => {
    clearConfiguredOrigin();
    const req = request({
      origin: 'https://attacker.example',
      host: PRIMARY_HOST,
      forwardedProto: 'https',
    });

    expect(assertSameOriginIfPresent(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('still rejects a mismatched double-submit token after origin validation passes', () => {
    clearConfiguredOrigin();
    const req = request({
      origin: `https://${PRIMARY_HOST}`,
      host: PRIMARY_HOST,
      forwardedProto: 'https',
      headerToken: 'b'.repeat(48),
    });

    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'csrf_mismatch' });
  });

  it('still rejects a mismatched double-submit token on the exact control origin', () => {
    configurePrimaryOrigin();
    const req = request({
      origin: `https://${CONTROL_HOST}`,
      host: CONTROL_HOST,
      forwardedProto: 'https',
      headerToken: 'b'.repeat(48),
    });

    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'csrf_mismatch' });
  });

  it('prefers an explicitly configured trusted public origin over proxy headers', () => {
    configurePrimaryOrigin();

    const legitimate = request({
      origin: `https://${PRIMARY_HOST}`,
      host: 'untrusted.example',
      forwardedProto: 'https',
    });
    const forged = request({
      origin: 'https://untrusted.example',
      host: 'untrusted.example',
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(legitimate)).toBe(`https://${PRIMARY_HOST}`);
    expect(assertCsrf(legitimate)).toEqual({ ok: true });
    expect(assertCsrf(forged)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('does not derive the production control origin from a non-platform configured origin', () => {
    vi.stubEnv('PC_PUBLIC_ORIGIN', 'https://staging.example');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const req = request({
      origin: `https://${CONTROL_HOST}`,
      host: CONTROL_HOST,
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe('https://staging.example');
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('fails closed when an explicitly configured public origin is malformed', () => {
    vi.stubEnv('PC_PUBLIC_ORIGIN', 'not-a-valid-origin');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const req = request({
      origin: `https://${PRIMARY_HOST}`,
      host: PRIMARY_HOST,
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe('');
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });
});

// A "to"/"next" query parameter is exactly the kind of request-supplied input an
// open-redirect exploit steers. These routes previously trusted `raw.startsWith('/')`,
// which a protocol-relative or backslash form defeats: both start with one slash and
// both resolve to a foreign origin under the WHATWG URL algorithm every browser
// implements. Every case here is the concrete shape such an exploit takes, checked
// against the actual resolver rather than against the string prefix that let it
// through before.
describe('resolveSameOriginRedirectTarget', () => {
  const BASE_URL = 'https://web.example/api/auth/demo';
  const req = () => request({ url: BASE_URL });

  it('keeps a same-origin path, including its query and fragment', () => {
    const target = resolveSameOriginRedirectTarget('/lots?campaign=1#top', '/', req());
    expect(target.toString()).toBe('https://web.example/lots?campaign=1#top');
  });

  it('falls back for a missing destination', () => {
    const target = resolveSameOriginRedirectTarget(null, '/cabinet', req());
    expect(target.toString()).toBe('https://web.example/cabinet');
  });

  it('falls back for an empty-string destination', () => {
    const target = resolveSameOriginRedirectTarget('', '/cabinet', req());
    expect(target.toString()).toBe('https://web.example/cabinet');
  });

  // The load-bearing case: a single leading slash is not evidence of a same-origin
  // path. `//evil.com` is a protocol-relative network-path reference and resolves
  // to https://evil.com under the same request.
  it('rejects a protocol-relative destination and falls back', () => {
    const target = resolveSameOriginRedirectTarget('//evil.example/steal', '/', req());
    expect(target.toString()).toBe('https://web.example/');
  });

  // A backslash is normalized to a forward slash for special schemes (http, https)
  // by the URL parser, so `/\evil.com` is the protocol-relative form in disguise.
  it('rejects a backslash-prefixed destination and falls back', () => {
    const target = resolveSameOriginRedirectTarget('/\\evil.example/steal', '/', req());
    expect(target.toString()).toBe('https://web.example/');
  });

  it('rejects an absolute cross-origin destination and falls back', () => {
    const target = resolveSameOriginRedirectTarget('https://evil.example/steal', '/', req());
    expect(target.toString()).toBe('https://web.example/');
  });

  it('rejects a same-hostname destination on a different scheme and falls back', () => {
    const target = resolveSameOriginRedirectTarget('http://web.example/lots', '/', req());
    expect(target.toString()).toBe('https://web.example/');
  });

  it('rejects a non-http destination (opaque origin) and falls back', () => {
    const target = resolveSameOriginRedirectTarget('javascript:alert(1)', '/', req());
    expect(target.toString()).toBe('https://web.example/');
  });

  it('rejects an unparseable destination and falls back', () => {
    const target = resolveSameOriginRedirectTarget('https://[::not-an-address', '/', req());
    expect(target.toString()).toBe('https://web.example/');
  });
});

// A same-origin URL is safe as an absolute Location header, but a client-side
// navigation resolves a relative reference against the current page. The
// serialized reference must therefore itself be path-absolute (exactly one
// leading slash), which dot-segment removal can silently break.
describe('toPathAbsoluteReference', () => {
  const BASE_URL = 'https://web.example/api/auth/demo';

  it('keeps the path, query and fragment of a same-origin target', () => {
    const target = new URL('/lots?campaign=1&b=2#top', BASE_URL);
    expect(toPathAbsoluteReference(target, '/')).toBe('/lots?campaign=1&b=2#top');
  });

  it('falls back when dot-segment removal leaves a protocol-relative pathname', () => {
    const target = new URL('/.//evil.example/steal', BASE_URL);
    expect(target.origin).toBe('https://web.example');
    expect(target.pathname).toBe('//evil.example/steal');
    expect(toPathAbsoluteReference(target, '/lots')).toBe('/lots');
  });

  it('falls back for a percent-encoded dot segment with the same effect', () => {
    const target = new URL('/%2e//evil.example/steal', BASE_URL);
    expect(toPathAbsoluteReference(target, '/lots')).toBe('/lots');
  });
});
