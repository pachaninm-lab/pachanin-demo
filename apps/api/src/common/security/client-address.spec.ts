import {
  buildTrustedProxyPredicate,
  parseTrustedProxyCidrs,
  resolveClientAddress,
} from './client-address';

describe('trusted client address boundary', () => {
  it('ignores spoofed X-Forwarded-For from an untrusted peer', () => {
    const request = {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.8' },
      socket: { remoteAddress: '198.51.100.20' },
      ip: '198.51.100.20',
    } as any;
    expect(resolveClientAddress(request, parseTrustedProxyCidrs('10.0.0.0/8')))
      .toBe('198.51.100.20');
  });

  it('walks a trusted proxy chain from right to left and stops at the first untrusted hop', () => {
    const request = {
      headers: { 'x-forwarded-for': '203.0.113.44, 172.16.0.5, 10.0.0.8' },
      socket: { remoteAddress: '10.0.0.9' },
      ip: '10.0.0.9',
    } as any;
    expect(resolveClientAddress(request, parseTrustedProxyCidrs('10.0.0.0/8,172.16.0.0/12')))
      .toBe('203.0.113.44');
  });

  it('normalizes IPv4-mapped addresses and supports IPv6 CIDRs', () => {
    const mapped = {
      headers: { 'x-forwarded-for': '203.0.113.7' },
      socket: { remoteAddress: '::ffff:10.1.2.3' },
      ip: '::ffff:10.1.2.3',
    } as any;
    expect(resolveClientAddress(mapped, parseTrustedProxyCidrs('10.0.0.0/8')))
      .toBe('203.0.113.7');

    const ipv6 = {
      headers: { 'x-forwarded-for': '2001:db8:ffff::7' },
      socket: { remoteAddress: '2001:db8:1::2' },
      ip: '2001:db8:1::2',
    } as any;
    expect(resolveClientAddress(ipv6, parseTrustedProxyCidrs('2001:db8:1::/48')))
      .toBe('2001:db8:ffff::7');
  });

  it('rejects trust-all proxy CIDRs in production', () => {
    expect(() => buildTrustedProxyPredicate('0.0.0.0/0', true)).toThrow(/forbidden/i);
    expect(() => buildTrustedProxyPredicate('::/0', true)).toThrow(/forbidden/i);
  });
});
