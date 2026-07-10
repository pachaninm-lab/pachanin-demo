import {
  hashRateLimitKey,
  resolveRateLimitHmacKey,
} from './rate-limit.service';

describe('rate-limit bucket key protection', () => {
  it('requires an independent strong pepper in production', () => {
    expect(() => resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: '',
      AUTH_TOKEN_PEPPER: 'a'.repeat(64),
    })).toThrow(/RATE_LIMIT_KEY_PEPPER/i);

    expect(() => resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: 'too-short',
    })).toThrow(/at least 32/i);
  });

  it('accepts a dedicated strong production pepper and ignores auth secrets', () => {
    const dedicated = resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: 'r'.repeat(64),
      AUTH_TOKEN_PEPPER: 'a'.repeat(64),
    });
    const sameDedicatedDifferentAuth = resolveRateLimitHmacKey({
      NODE_ENV: 'production',
      RATE_LIMIT_KEY_PEPPER: 'r'.repeat(64),
      AUTH_TOKEN_PEPPER: 'b'.repeat(64),
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
