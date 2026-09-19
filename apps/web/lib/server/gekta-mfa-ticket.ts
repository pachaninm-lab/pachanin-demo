import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

export const GEKTA_MFA_PENDING_COOKIE = 'gekta_mfa_pending';
export const GEKTA_MFA_PENDING_TTL_SECONDS = 10 * 60;
export const GEKTA_EMAIL_PENDING_COOKIE = 'gekta_email_pending';
export const GEKTA_EMAIL_PENDING_TTL_SECONDS = 30 * 60;

export type GektaMfaTicket = Readonly<{
  v: 1;
  challengeToken: string;
  email: string;
  enrollment: boolean;
  setupSecret?: string;
  otpAuthUri?: string;
  declaredPhone?: string;
  exp: number;
}>;

const AAD = Buffer.from('gekta-mfa-ticket-v1', 'utf8');
const EMAIL_AAD = Buffer.from('gekta-email-ticket-v1', 'utf8');
const KEY_SALT = Buffer.from('transparent-price/gekta/auth-ticket/v1', 'utf8');

function deriveTicketKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    KEY_SALT,
    Buffer.from(purpose, 'utf8'),
    32,
  ));
}

function key(env: NodeJS.ProcessEnv = process.env): Buffer {
  const secret = String(env.MFA_LOGIN_TICKET_SECRET || '').trim();
  if (secret.length < 32) {
    throw new Error('MFA_LOGIN_TICKET_SECRET must contain at least 32 characters');
  }
  return deriveTicketKey(secret, 'mfa-challenge');
}

function emailKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const secret = String(env.MFA_LOGIN_TICKET_SECRET || '').trim();
  if (secret.length < 32) {
    throw new Error('MFA_LOGIN_TICKET_SECRET must contain at least 32 characters');
  }
  return deriveTicketKey(secret, 'email-verification');
}

function canonicalBase64Url(value: string, expectedBytes?: number): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) return null;
  if (expectedBytes !== undefined && decoded.length !== expectedBytes) return null;
  return decoded;
}

function validInput(input: Omit<GektaMfaTicket, 'v' | 'exp'>): boolean {
  return input.challengeToken.length >= 16
    && input.challengeToken.length <= 1_024
    && /^\S+@\S+\.\S+$/u.test(input.email)
    && input.email.length <= 254
    && (input.enrollment
      ? Boolean(input.setupSecret && input.otpAuthUri)
      : input.setupSecret === undefined && input.otpAuthUri === undefined)
    && (input.setupSecret === undefined || (input.setupSecret.length >= 8 && input.setupSecret.length <= 256))
    && (input.otpAuthUri === undefined || (input.otpAuthUri.startsWith('otpauth://') && input.otpAuthUri.length <= 2_048))
    && (input.declaredPhone === undefined || (input.declaredPhone.length >= 8 && input.declaredPhone.length <= 32));
}

export function sealGektaEmailTicket(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (token.length < 32 || token.length > 1_024) throw new Error('Invalid Gekta email ticket input');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', emailKey(env), iv);
  cipher.setAAD(EMAIL_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ v: 1, token, exp: nowSeconds + GEKTA_EMAIL_PENDING_TTL_SECONDS }), 'utf8'),
    cipher.final(),
  ]);
  return ['e1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function openGektaEmailTicket(
  value: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  try {
    const [version, ivRaw, tagRaw, payloadRaw, extra] = String(value || '').split('.');
    if (version !== 'e1' || !ivRaw || !tagRaw || !payloadRaw || extra || payloadRaw.length > 4_096) return null;
    const iv = canonicalBase64Url(ivRaw, 12);
    const tag = canonicalBase64Url(tagRaw, 16);
    const ciphertext = canonicalBase64Url(payloadRaw);
    if (!iv || !tag || !ciphertext || ciphertext.length === 0) return null;
    const decipher = createDecipheriv('aes-256-gcm', emailKey(env), iv);
    decipher.setAAD(EMAIL_AAD);
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')) as { v?: unknown; token?: unknown; exp?: unknown };
    if (
      payload.v !== 1
      || typeof payload.token !== 'string'
      || payload.token.length < 32
      || payload.token.length > 1_024
      || typeof payload.exp !== 'number'
      || payload.exp <= nowSeconds
      || payload.exp - nowSeconds > GEKTA_EMAIL_PENDING_TTL_SECONDS
    ) return null;
    return payload.token;
  } catch {
    return null;
  }
}

export function sealGektaMfaTicket(
  input: Omit<GektaMfaTicket, 'v' | 'exp'>,
  nowSeconds = Math.floor(Date.now() / 1_000),
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!validInput(input)) throw new Error('Invalid Gekta MFA ticket input');
  const payload: GektaMfaTicket = {
    v: 1,
    ...input,
    exp: nowSeconds + GEKTA_MFA_PENDING_TTL_SECONDS,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(env), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function openGektaMfaTicket(
  value: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
  env: NodeJS.ProcessEnv = process.env,
): GektaMfaTicket | null {
  try {
    const [version, ivRaw, tagRaw, payloadRaw, extra] = String(value || '').split('.');
    if (version !== 'v1' || !ivRaw || !tagRaw || !payloadRaw || extra || payloadRaw.length > 8_192) return null;
    const iv = canonicalBase64Url(ivRaw, 12);
    const tag = canonicalBase64Url(tagRaw, 16);
    const ciphertext = canonicalBase64Url(payloadRaw);
    if (!iv || !tag || !ciphertext || ciphertext.length === 0) return null;

    const decipher = createDecipheriv('aes-256-gcm', key(env), iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')) as Partial<GektaMfaTicket>;

    if (
      payload.v !== 1
      || typeof payload.challengeToken !== 'string'
      || typeof payload.email !== 'string'
      || typeof payload.enrollment !== 'boolean'
      || typeof payload.exp !== 'number'
      || payload.exp <= nowSeconds
      || payload.exp - nowSeconds > GEKTA_MFA_PENDING_TTL_SECONDS
    ) return null;

    const candidate = {
      challengeToken: payload.challengeToken,
      email: payload.email,
      enrollment: payload.enrollment,
      ...(typeof payload.setupSecret === 'string' ? { setupSecret: payload.setupSecret } : {}),
      ...(typeof payload.otpAuthUri === 'string' ? { otpAuthUri: payload.otpAuthUri } : {}),
      ...(typeof payload.declaredPhone === 'string' ? { declaredPhone: payload.declaredPhone } : {}),
    };
    return validInput(candidate) ? payload as GektaMfaTicket : null;
  } catch {
    return null;
  }
}

export function gektaMfaCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/gekta/auth',
    maxAge: GEKTA_MFA_PENDING_TTL_SECONDS,
  };
}

export function clearGektaMfaCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/gekta/auth',
    expires: new Date(0),
    maxAge: 0,
  };
}

export function gektaEmailCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/gekta/auth/email/verify',
    maxAge: GEKTA_EMAIL_PENDING_TTL_SECONDS,
  };
}

export function clearGektaEmailCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/gekta/auth/email/verify',
    expires: new Date(0),
    maxAge: 0,
  };
}
