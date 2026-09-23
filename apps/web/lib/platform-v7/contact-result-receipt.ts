import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type ContactResult = 'delivered' | 'failed';

export const CONTACT_RESULT_COOKIE = 'pc_contact_result_v1';
export const CONTACT_RESULT_TTL_SECONDS = 5 * 60;

const NONCE_PATTERN = /^[A-Za-z0-9_-]{24}$/u;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/u;
const MAX_TOKEN_LENGTH = 256;
const MAX_CLOCK_SKEW_SECONDS = 30;

function rootSecret(environment: NodeJS.ProcessEnv = process.env): string | null {
  const configured = environment === process.env
    ? process.env.CONTACT_RESULT_HMAC_SECRET
    : environment.CONTACT_RESULT_HMAC_SECRET;
  const secret = String(configured || '').trim();
  return /^[A-Za-z0-9_-]{43,128}$/u.test(secret) ? secret : null;
}

function unsigned(result: ContactResult, issuedAt: number, expiresAt: number, nonce: string): string {
  return ['v1', result, String(issuedAt), String(expiresAt), nonce].join('.');
}

function signature(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

export function createContactResultReceipt(
  result: ContactResult,
  nowSeconds = Math.floor(Date.now() / 1000),
  environment: NodeJS.ProcessEnv = process.env,
  nonce = randomBytes(18).toString('base64url'),
): string | null {
  const secret = rootSecret(environment);
  if (!secret || !Number.isSafeInteger(nowSeconds) || nowSeconds < 0 || !NONCE_PATTERN.test(nonce)) return null;
  const expiresAt = nowSeconds + CONTACT_RESULT_TTL_SECONDS;
  const value = unsigned(result, nowSeconds, expiresAt, nonce);
  return `${value}.${signature(value, secret)}`;
}

export function verifyContactResultReceipt(
  token: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  environment: NodeJS.ProcessEnv = process.env,
): ContactResult | null {
  const secret = rootSecret(environment);
  if (!secret || typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) return null;

  const parts = token.split('.');
  if (parts.length !== 6) return null;
  const [version, resultRaw, issuedRaw, expiresRaw, nonce, provided] = parts;
  if (version !== 'v1' || (resultRaw !== 'delivered' && resultRaw !== 'failed')) return null;
  if (!/^(?:0|[1-9][0-9]{0,12})$/u.test(issuedRaw) || !/^(?:0|[1-9][0-9]{0,12})$/u.test(expiresRaw)) return null;
  if (!NONCE_PATTERN.test(nonce) || !SIGNATURE_PATTERN.test(provided)) return null;

  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) return null;
  if (expiresAt - issuedAt !== CONTACT_RESULT_TTL_SECONDS) return null;
  if (issuedAt > nowSeconds + MAX_CLOCK_SKEW_SECONDS || expiresAt <= nowSeconds) return null;

  const value = parts.slice(0, 5).join('.');
  const expected = signature(value, secret);
  const actualBuffer = Buffer.from(provided, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  return resultRaw;
}

export function contactResultFromRequest(
  query: Readonly<Record<string, unknown>>,
  cookieValue: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
  environment: NodeJS.ProcessEnv = process.env,
): ContactResult | null {
  // User-controlled sent/error values have no result authority. The marker only
  // asks the server to inspect a short-lived HttpOnly receipt from this browser.
  if (query.receipt !== '1') return null;
  return verifyContactResultReceipt(cookieValue, nowSeconds, environment);
}

export function contactResultCookieOptions(environment: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: environment.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/platform-v7/contact',
    maxAge: CONTACT_RESULT_TTL_SECONDS,
  };
}
