import {
  hashRateLimitKey,
  resolveRateLimitHmacKey,
} from './rate-limit.service';

describe('rate-limit bucket key protection', () => {
  it('requires a dedicated strong pepper in production', () => {
    expect(() => resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: '',
      AUTH_TOKEN_PEPPER: 'auth-secret-that-must-not-be-reused-for-rate-limits',
    })).toThrow(/RATE_LIMIT_KEY_PEPPER/i);

    expect(() => resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: 'too-short',
    })).toThrow(/at least 32/i);
  });

  it('uses only the dedicated production pepper', () => {
    const dedicated = resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: 'rate-limit-secret-that-is-long-enough',
      AUTH_TOKEN_PEPPER: 'auth-secret-that-must-not-affect-the-domain-key',
    });
    const sameDedicatedDifferentAuth = resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: 'rate-limit-secret-that-is-long-enough',
      AUTH_TOKEN_PEPPER: 'different-auth-secret',
    });
    expect(dedicated.equals(sameDedicatedDifferentAuth)).toBe(true);
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
