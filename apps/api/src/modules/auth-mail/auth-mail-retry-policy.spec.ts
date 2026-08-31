import { isRetryableAuthMailFailure } from './auth-mail-retry-policy';

describe('auth-mail retry policy', () => {
  it.each([
    'SMTP_TRANSIENT_421',
    'SMTP_TRANSIENT_450',
    'SMTP_TRANSIENT_451',
    'SMTP_TRANSIENT_452',
    'SMTP_SOCKET_ERROR',
    'SMTP_TIMEOUT',
    'SMTP_TLS_CONNECT_FAILED',
    'SMTP_TLS_CONNECT_TIMEOUT',
    'AUTH_MAIL_ERROR',
  ])('retries transient/runtime failure %s', (code) => {
    expect(isRetryableAuthMailFailure(code)).toBe(true);
  });

  it.each([
    'SMTP_PERMANENT_500',
    'SMTP_PERMANENT_535',
    'SMTP_PERMANENT_550',
    'SMTP_PERMANENT_553',
    'SMTP_RECIPIENT_INVALID',
    'SMTP_RECIPIENT_DOMAIN_INVALID',
    'SMTP_MESSAGE_ID_INVALID',
    'SMTPUTF8_REQUIRED_BUT_UNAVAILABLE',
  ])('dead-letters permanent failure %s', (code) => {
    expect(isRetryableAuthMailFailure(code)).toBe(false);
  });
});
