import { authMailDirectMxInternalsForTests } from './auth-mail-direct-mx';

describe('auth-mail direct MX safety guards', () => {
  const { isPublicIpv4, normalizeMxHostname } = authMailDirectMxInternalsForTests;

  it.each(['1.1.1.1', '8.8.8.8', '93.184.216.34'])('accepts public IPv4 %s', (address) => {
    expect(isPublicIpv4(address)).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.0.0.1',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
  ])('rejects non-public IPv4 %s', (address) => {
    expect(isPublicIpv4(address)).toBe(false);
  });

  it('normalizes a valid MX hostname and strips the DNS root dot', () => {
    expect(normalizeMxHostname('MX.Example.COM.')).toBe('mx.example.com');
  });

  it.each(['', '.', '.example.com', 'example..com', 'bad host.example'])('rejects invalid MX hostname %s', (hostname) => {
    expect(normalizeMxHostname(hostname)).toBeNull();
  });
});
