import { describe, it, expect } from 'vitest';
import { apiKeyAuth, bearerAuth, noAuth, oauth2ClientCredentials } from './auth';
import type { FetchLike } from './http-integration-client';

describe('auth strategies', () => {
  it('noAuth returns no headers', async () => {
    expect(await noAuth()()).toEqual({});
  });

  it('apiKeyAuth sets the header and rejects empty values', async () => {
    expect(await apiKeyAuth('X-API-Key', 'k1')()).toEqual({ 'x-api-key': 'k1' });
    expect(() => apiKeyAuth('X-API-Key', '')).toThrow();
  });

  it('bearerAuth supports static and dynamic tokens', async () => {
    expect(await bearerAuth('tok')()).toEqual({ authorization: 'Bearer tok' });
    expect(await bearerAuth(async () => 'dyn')()).toEqual({ authorization: 'Bearer dyn' });
  });

  it('oauth2ClientCredentials caches the token and refreshes after expiry', async () => {
    let tokenCalls = 0;
    let seq = 0;
    const fetchImpl: FetchLike = async () => {
      tokenCalls += 1;
      seq += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: `tok-${seq}`, expires_in: 100 }),
      };
    };
    let clock = 0;
    const auth = oauth2ClientCredentials({
      tokenUrl: 'https://auth.sber.example/token',
      clientId: 'cid',
      clientSecret: 'secret',
      scope: 'grainflow',
      refreshSkewSec: 10,
      fetchImpl,
      now: () => clock,
    });

    expect(await auth()).toEqual({ authorization: 'Bearer tok-1' });
    // Cached: second call within TTL must not hit the token endpoint.
    expect(await auth()).toEqual({ authorization: 'Bearer tok-1' });
    expect(tokenCalls).toBe(1);

    // Advance past (ttl - skew) => refresh.
    clock = 95_000;
    expect(await auth()).toEqual({ authorization: 'Bearer tok-2' });
    expect(tokenCalls).toBe(2);
  });

  it('oauth2ClientCredentials validates required config', () => {
    expect(() => oauth2ClientCredentials({ tokenUrl: '', clientId: 'a', clientSecret: 'b' })).toThrow();
    expect(() => oauth2ClientCredentials({ tokenUrl: 'u', clientId: '', clientSecret: 'b' })).toThrow();
  });
});
