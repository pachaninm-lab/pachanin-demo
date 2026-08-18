import { authMailSmtpInternalsForTests } from './auth-mail-smtp';

describe('auth-mail SMTP fallback boundary', () => {
  const { shouldUseDirectMxFallback } = authMailSmtpInternalsForTests;

  it('allows direct MX fallback only for relay RCPT TO transient 451', () => {
    expect(shouldUseDirectMxFallback('RCPT_TO', 'SMTP_TRANSIENT_451')).toBe(true);
  });

  it.each([
    ['AUTH', 'SMTP_TRANSIENT_451'],
    ['MAIL_FROM', 'SMTP_TRANSIENT_451'],
    ['DATA', 'SMTP_TRANSIENT_451'],
    ['RCPT_TO', 'SMTP_TRANSIENT_450'],
    ['RCPT_TO', 'SMTP_TRANSIENT_452'],
    ['RCPT_TO', 'SMTP_PERMANENT_550'],
    ['RCPT_TO', 'SMTP_SOCKET_ERROR'],
  ] as const)('does not widen fallback for %s / %s', (stage, code) => {
    expect(shouldUseDirectMxFallback(stage, code)).toBe(false);
  });
});
