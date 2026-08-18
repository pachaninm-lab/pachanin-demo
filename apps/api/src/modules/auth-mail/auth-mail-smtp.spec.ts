import { AuthMailTransportError, shouldUseDirectMxFallback } from './auth-mail-smtp';

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
});
