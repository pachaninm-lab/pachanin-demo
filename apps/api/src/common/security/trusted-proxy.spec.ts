import { createTrustedProxyPolicy } from './trusted-proxy';

describe('trusted proxy policy', () => {
  it('fails closed when production proxy mode is not explicit', () => {
    expect(() => createTrustedProxyPolicy({ NODE_ENV: 'production' })).toThrow(/TRUST_PROXY_MODE/i);
  });

  it('ignores forwarded headers in direct mode', () => {
    const policy = createTrustedProxyPolicy({ NODE_ENV: 'test', TRUST_PROXY_MODE: 'direct' });
    expect(policy.resolve('203.0.113.7', '198.51.100.10')).toBe('203.0.113.7');
    expect(policy.expressSetting).toBe(false);
  });

  it('ignores spoofed XFF from an untrusted immediate peer', () => {
    const policy = createTrustedProxyPolicy({
      NODE_ENV: 'production',
      TRUST_PROXY_MODE: 'cidr',
      TRUSTED_PROXY_CIDRS: '10.0.0.0/8,2001:db8:100::/48',
    });
    expect(policy.resolve('203.0.113.7', '1.1.1.1')).toBe('203.0.113.7');
  });

  it('walks a trusted proxy chain from right to left', () => {
    const policy = createTrustedProxyPolicy({
      NODE_ENV: 'production',
      TRUST_PROXY_MODE: 'cidr',
      TRUSTED_PROXY_CIDRS: '10.0.0.0/8,192.168.0.0/16',
    });
    expect(policy.resolve('10.0.0.5', '198.51.100.25, 192.168.4.9')).toBe('198.51.100.25');
    expect(policy.trust('10.200.1.2')).toBe(true);
    expect(policy.trust('198.51.100.25')).toBe(false);
  });

  it('supports IPv6 CIDR and IPv4-mapped remote addresses', () => {
    const policy = createTrustedProxyPolicy({
      NODE_ENV: 'production',
      TRUST_PROXY_MODE: 'cidr',
      TRUSTED_PROXY_CIDRS: '2001:db8:abcd::/48,127.0.0.0/8',
    });
    expect(policy.trust('2001:db8:abcd::ff')).toBe(true);
    expect(policy.resolve('::ffff:127.0.0.1', '198.51.100.99')).toBe('198.51.100.99');
  });

  it('falls back to the immediate trusted peer for malformed or excessive chains', () => {
    const policy = createTrustedProxyPolicy({
      NODE_ENV: 'production',
      TRUST_PROXY_MODE: 'cidr',
      TRUSTED_PROXY_CIDRS: '10.0.0.0/8',
    });
    expect(policy.resolve('10.0.0.5', 'not-an-ip')).toBe('10.0.0.5');
    expect(policy.resolve('10.0.0.5', Array.from({ length: 21 }, (_, index) => `192.0.2.${index + 1}`).join(','))).toBe('10.0.0.5');
  });
});
