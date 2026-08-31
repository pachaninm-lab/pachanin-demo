const PERMANENT_AUTH_MAIL_CODES = new Set([
  'SMTP_RECIPIENT_INVALID',
  'SMTP_RECIPIENT_DOMAIN_INVALID',
  'SMTP_MESSAGE_ID_INVALID',
  'SMTPUTF8_REQUIRED_BUT_UNAVAILABLE',
]);

/**
 * SMTP 4xx and transport failures are retryable. SMTP 5xx means the server has
 * rejected the current delivery permanently; invalid recipient/message shapes
 * are also terminal. Unknown/internal failures remain retryable so a transient
 * runtime/key/database condition does not destroy queued bearer-bearing mail.
 */
export function isRetryableAuthMailFailure(errorCodeInput: string): boolean {
  const errorCode = String(errorCodeInput ?? '').trim().toUpperCase();
  if (!errorCode) return true;
  if (/^SMTP_PERMANENT_5\d\d$/.test(errorCode)) return false;
  if (PERMANENT_AUTH_MAIL_CODES.has(errorCode)) return false;
  return true;
}
