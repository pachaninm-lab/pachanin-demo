import { readFileSync } from 'node:fs';

const smtpPath = 'apps/api/src/modules/auth-mail/auth-mail-smtp.ts';
const directPath = 'apps/api/src/modules/auth-mail/auth-mail-direct-mx.ts';
const errorPath = 'apps/api/src/modules/auth-mail/auth-mail-transport-error.ts';
const smtp = readFileSync(smtpPath, 'utf8');
const direct = readFileSync(directPath, 'utf8');
const error = readFileSync(errorPath, 'utf8');

const requireText = (source, token, code) => {
  if (!source.includes(token)) throw new Error(code);
};
const requireOnce = (source, token, code) => {
  const count = source.split(token).length - 1;
  if (count !== 1) throw new Error(`${code}:${count}`);
};

requireText(
  smtp,
  "return stage === 'RCPT_TO' && errorCode === 'SMTP_TRANSIENT_451';",
  'EXACT_RCPT451_FALLBACK_GUARD_MISSING',
);
requireOnce(smtp, 'await sendAuthMailDirectMx({', 'DIRECT_MX_FALLBACK_CALL_CARDINALITY');
requireText(smtp, "stage = 'RCPT_TO';", 'RCPT_STAGE_MISSING');
requireText(smtp, "stage = 'DATA';", 'DATA_STAGE_MISSING');
requireText(smtp, "if (!(error instanceof RelayRecipientTemporaryFailure)) throw error;", 'FAIL_CLOSED_RELAY_ERROR_GUARD_MISSING');
requireText(smtp, "Message-ID: ${deterministicMessageId(outboxId)}", 'DETERMINISTIC_MESSAGE_ID_MISSING');
requireText(smtp, "export { AuthMailTransportError } from './auth-mail-transport-error';", 'TRANSPORT_ERROR_COMPAT_EXPORT_MISSING');

requireText(direct, "const DIRECT_MX_LIMIT = 2;", 'BOUNDED_MX_LIMIT_MISSING');
requireText(direct, "resolve4(hostname)", 'PINNED_PUBLIC_IPV4_RESOLUTION_MISSING');
requireText(direct, "if (!isPublicIpv4(address)) continue;", 'PUBLIC_IP_GUARD_MISSING');
requireText(direct, "plain.command('STARTTLS', [220])", 'STARTTLS_COMMAND_MISSING');
requireText(direct, 'rejectUnauthorized: true', 'TLS_CERTIFICATE_VERIFICATION_MISSING');
requireText(direct, "minVersion: 'TLSv1.2'", 'TLS_MINIMUM_VERSION_MISSING');
requireText(direct, "await session.command('DATA', [354]);", 'DIRECT_DATA_STAGE_MISSING');
requireText(direct, 'if (dataStarted) throw new DirectPostDataFailure(error);', 'POST_DATA_DUPLICATION_GUARD_MISSING');
requireText(direct, 'if (isPermanentSmtpError(error)) throw error;', 'PERMANENT_FAILURE_FAIL_CLOSED_GUARD_MISSING');
if (direct.includes('AUTH PLAIN') || direct.includes("command('AUTH")) {
  throw new Error('DIRECT_MX_AUTH_FORBIDDEN');
}
const startTlsIndex = direct.indexOf("plain.command('STARTTLS', [220])");
const dataIndex = direct.indexOf("await session.command('DATA', [354]);");
if (startTlsIndex < 0 || dataIndex < 0 || startTlsIndex >= dataIndex) {
  throw new Error('STARTTLS_MUST_PRECEDE_DATA');
}

requireText(error, 'export class AuthMailTransportError extends Error', 'SHARED_TRANSPORT_ERROR_MISSING');
requireText(error, "this.name = 'AuthMailTransportError';", 'SHARED_TRANSPORT_ERROR_NAME_MISSING');

console.log('PASS: exact RCPT451 direct-MX fallback remains bounded, TLS-only, public-address-only and fail-closed');
