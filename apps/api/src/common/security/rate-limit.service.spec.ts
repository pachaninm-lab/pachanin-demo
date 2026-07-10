import {
  hashRateLimitKey,
  resolveRateLimitHmacKey,
} from './rate-limit.service';

describe('rate-limit bucket key protection', () => {
  it('requires a secret source in production', () => {
    expect(() => resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: '',
      AUTH_TOKEN_PEPPER: '',
    })).toThrow(/pepper is required/i);
  });

  it('uses a dedicated pepper when present', () => {
    const dedicated = resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: 'dedicated-secret',
      AUTH_TOKEN_PEPPER: 'auth-secret',
    });
    const authFallback = resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      AUTH_TOKEN_PEPPER: 'auth-secret',
    });
    expect(dedicated.equals(authFallback)).toBe(false);
  });

  it('does not expose or directly hash a low-entropy IP address', () => {
    const key = resolveRateLimitHmacKey({ NODE_ENV: 'test', RATE_LIMIT_KEY_PEPPER: 'test-secret' });
    const first = hashRateLimitKey('ip|203.0.113.5', key);
    const second = hashRateLimitKey('ip|203.0.113.5', key);
    const differentDomainKey = resolveRateLimitHmacKey({ NODE_ENV: 'test', RATE_LIMIT_KEY_PEPPER: 'other-secret' });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toContain('203.0.113.5');
    expect(first).not.toBe(hashRateLimitKey('ip|203.0.113.5', differentDomainKey));
  });
});
