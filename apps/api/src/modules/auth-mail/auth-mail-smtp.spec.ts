import { AuthMailTransportError, isPublicIpv4, shouldUseDirectMxFallback } from './auth-mail-smtp';

describe('auth-mail SMTP direct-MX fallback boundary', () => {
  it('allows fallback only for the proven relay RCPT 451 class', () => {
    expect(shouldUseDirectMxFallback(new AuthMailTransportError('SMTP_TRANSIENT_451'))).toBe(true);
  });

  it.each([
    'SMTP_TRANSIENT_421',
    'SMTP_TRANSIENT_450',
    'SMTP_TRANSIENT_452',
    'SMTP_PERMANENT_550',
    'SMTP_AUTH_NOT_ADVERTISED',
    'SMTP_TLS_CONNECT_FAILED',
    'SMTPUTF8_REQUIRED_BUT_UNAVAILABLE',
  ])('does not widen fallback to %s', (code) => {
    expect(shouldUseDirectMxFallback(new AuthMailTransportError(code))).toBe(false);
  });

  it('does not fallback for non-transport failures', () => {
    expect(shouldUseDirectMxFallback(new Error('SMTP_TRANSIENT_451'))).toBe(false);
    expect(shouldUseDirectMxFallback(null)).toBe(false);
  });

  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.254',
    '192.0.0.10',
    '192.168.1.1',
    '198.18.0.1',
    '192.0.2.10',
    '198.51.100.10',
    '203.0.113.10',
    '224.0.0.1',
    '255.255.255.255',
    'not-an-ip',
  ])('rejects non-public direct-MX target %s', (address) => {
    expect(isPublicIpv4(address)).toBe(false);
  });

  it.each(['1.1.1.1', '8.8.8.8', '195.19.12.120'])('allows globally routable IPv4 target %s', (address) => {
    expect(isPublicIpv4(address)).toBe(true);
  });
});
