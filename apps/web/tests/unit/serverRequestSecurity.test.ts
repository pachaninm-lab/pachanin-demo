import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertCsrf,
  assertSameOriginIfPresent,
  resolveRequestTargetOrigin,
} from '../../lib/server-request-security';

const TOKEN = 'a'.repeat(48);

function clearConfiguredOrigin() {
  vi.stubEnv('PC_PUBLIC_ORIGIN', '');
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
  const headers = new Headers({
    host: options.host ?? 'web:3000',
    cookie: `pc_csrf_token=${token}`,
    'x-csrf-token': options.headerToken ?? token,
  });
  if (options.origin) headers.set('origin', options.origin);
  if (options.forwardedHost) headers.set('x-forwarded-host', options.forwardedHost);
  if (options.forwardedProto) headers.set('x-forwarded-proto', options.forwardedProto);

  return new Request(options.url ?? 'http://web:3000/api/auth/forgot-password', {
    method: 'POST',
    headers,
    body: '{}',
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server request security target-origin resolution', () => {
  it('accepts a same-origin POST behind a TLS-terminating reverse proxy', () => {
    clearConfiguredOrigin();
    const req = request({
      origin: 'https://xn----8sbjf4befbjgs9b.xn--p1ai',
      host: 'xn----8sbjf4befbjgs9b.xn--p1ai',
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe('https://xn----8sbjf4befbjgs9b.xn--p1ai');
    expect(assertSameOriginIfPresent(req)).toEqual({ ok: true });
    expect(assertCsrf(req)).toEqual({ ok: true });
  });

  it('uses X-Forwarded-Host when the proxy rewrites Host internally', () => {
    clearConfiguredOrigin();
    const req = request({
      origin: 'https://xn----8sbjf4befbjgs9b.xn--p1ai',
      host: 'web:3000',
      forwardedHost: 'xn----8sbjf4befbjgs9b.xn--p1ai',
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe('https://xn----8sbjf4befbjgs9b.xn--p1ai');
    expect(assertCsrf(req)).toEqual({ ok: true });
  });

  it('still rejects a cross-origin request even when the CSRF token matches', () => {
    clearConfiguredOrigin();
    const req = request({
      origin: 'https://attacker.example',
      host: 'xn----8sbjf4befbjgs9b.xn--p1ai',
      forwardedProto: 'https',
    });

    expect(assertSameOriginIfPresent(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('still rejects a mismatched double-submit token after origin validation passes', () => {
    clearConfiguredOrigin();
    const req = request({
      origin: 'https://xn----8sbjf4befbjgs9b.xn--p1ai',
      host: 'xn----8sbjf4befbjgs9b.xn--p1ai',
      forwardedProto: 'https',
      headerToken: 'b'.repeat(48),
    });

    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'csrf_mismatch' });
  });

  it('prefers an explicitly configured trusted public origin over proxy headers', () => {
    vi.stubEnv('PC_PUBLIC_ORIGIN', 'https://процент-агро.рф');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');

    const legitimate = request({
      origin: 'https://xn----8sbjf4befbjgs9b.xn--p1ai',
      host: 'untrusted.example',
      forwardedProto: 'https',
    });
    const forged = request({
      origin: 'https://untrusted.example',
      host: 'untrusted.example',
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(legitimate)).toBe('https://xn----8sbjf4befbjgs9b.xn--p1ai');
    expect(assertCsrf(legitimate)).toEqual({ ok: true });
    expect(assertCsrf(forged)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('fails closed when an explicitly configured public origin is malformed', () => {
    vi.stubEnv('PC_PUBLIC_ORIGIN', 'not-a-valid-origin');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const req = request({
      origin: 'https://xn----8sbjf4befbjgs9b.xn--p1ai',
      host: 'xn----8sbjf4befbjgs9b.xn--p1ai',
      forwardedProto: 'https',
    });

    expect(resolveRequestTargetOrigin(req)).toBe('');
    expect(assertCsrf(req)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });
});
