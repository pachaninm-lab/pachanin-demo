import { afterEach, describe, expect, it, vi } from 'vitest';
import { CSRF_COOKIE } from '@/lib/auth-cookies';
import { assertCsrf, assertSameOriginIfPresent } from '@/lib/server-request-security';

const PUBLIC_ORIGIN = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const TOKEN = 'csrf-test-token-value-for-double-submit-check-0001';

function postRequest({
  origin = PUBLIC_ORIGIN,
  host = 'xn----8sbjf4befbjgs9b.xn--p1ai',
  forwardedProto = 'https',
  forwardedHost,
  cookieToken = TOKEN,
  headerToken = TOKEN,
}: {
  origin?: string | null;
  host?: string;
  forwardedProto?: string | null;
  forwardedHost?: string;
  cookieToken?: string;
  headerToken?: string;
} = {}) {
  const headers = new Headers({
    Host: host,
    Cookie: `${CSRF_COOKIE}=${encodeURIComponent(cookieToken)}`,
    'x-csrf-token': headerToken,
  });
  if (origin) headers.set('Origin', origin);
  if (forwardedProto) headers.set('X-Forwarded-Proto', forwardedProto);
  if (forwardedHost) headers.set('X-Forwarded-Host', forwardedHost);

  return new Request('http://web:3000/api/auth/forgot-password', {
    method: 'POST',
    headers,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server request CSRF origin authority', () => {
  it('uses configured public origin ahead of the internal runtime URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', PUBLIC_ORIGIN);

    expect(assertSameOriginIfPresent(postRequest({ host: 'web:3000', forwardedProto: 'http' }))).toEqual({ ok: true });
  });

  it('uses proxy-controlled Host and X-Forwarded-Proto when no public origin is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');

    expect(assertSameOriginIfPresent(postRequest())).toEqual({ ok: true });
    expect(assertCsrf(postRequest())).toEqual({ ok: true });
  });

  it('rejects a foreign browser Origin even when the double-submit token matches', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');

    expect(assertCsrf(postRequest({ origin: 'https://attacker.example' }))).toEqual({
      ok: false,
      reason: 'origin_mismatch',
    });
  });

  it('does not trust client-supplied X-Forwarded-Host as target-origin authority', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');

    expect(assertSameOriginIfPresent(postRequest({
      origin: 'https://attacker.example',
      forwardedHost: 'attacker.example',
    }))).toEqual({
      ok: false,
      reason: 'origin_mismatch',
    });
  });

  it('fails closed when an explicitly configured public origin is malformed', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'not-a-valid-origin');

    expect(assertSameOriginIfPresent(postRequest())).toEqual({
      ok: false,
      reason: 'origin_mismatch',
    });
  });

  it('still requires the double-submit token when Origin is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');

    expect(assertCsrf(postRequest({ origin: null, headerToken: `${TOKEN}-different` }))).toEqual({
      ok: false,
      reason: 'csrf_mismatch',
    });
  });
});
