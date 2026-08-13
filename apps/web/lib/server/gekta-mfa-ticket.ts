import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

export const GEKTA_MFA_TICKET_COOKIE = 'pc_gekta_mfa_pending';
export const GEKTA_EMAIL_TICKET_COOKIE = 'pc_gekta_email_pending';
const VERSION = 'v1';
const MAX_TICKET_TTL_MS = 10 * 60 * 1000;
const MAX_EMAIL_TICKET_TTL_MS = 30 * 60 * 1000;

export type GektaMfaTicket = {
  challengeToken: string;
  enrollmentRequired: boolean;
  expiresAt: string;
};

function encryptionKey(purpose: 'mfa' | 'email'): Buffer | null {
  const secret = String(process.env.MFA_LOGIN_TICKET_SECRET || process.env.JWT_SECRET || '').trim();
  if (secret.length < 32) return null;
  return createHash('sha256').update(`pc:gekta:${purpose}-ticket:v1\0`).update(secret).digest();
}

export function sealGektaMfaTicket(ticket: GektaMfaTicket): string | null {
  const key = encryptionKey('mfa');
  const expiresAtMs = Date.parse(ticket.expiresAt);
  if (!key || !ticket.challengeToken || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(VERSION));
  const plaintext = Buffer.from(JSON.stringify({
    challengeToken: ticket.challengeToken,
    enrollmentRequired: ticket.enrollmentRequired === true,
    expiresAt: new Date(Math.min(expiresAtMs, Date.now() + MAX_TICKET_TTL_MS)).toISOString(),
  }), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join('.');
}

export function openGektaMfaTicket(value: string | undefined, now = Date.now()): GektaMfaTicket | null {
  const key = encryptionKey('mfa');
  if (!key || !value || value.length > 4_096) return null;
  const [version, ivValue, bodyValue, tagValue, extra] = value.split('.');
  if (version !== VERSION || !ivValue || !bodyValue || !tagValue || extra !== undefined) return null;

  try {
    const iv = Buffer.from(ivValue, 'base64url');
    const ciphertext = Buffer.from(bodyValue, 'base64url');
    const tag = Buffer.from(tagValue, 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > 3_072) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(VERSION));
    decipher.setAuthTag(tag);
    const parsed = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as Record<string, unknown>;
    const expiresAtMs = typeof parsed.expiresAt === 'string' ? Date.parse(parsed.expiresAt) : Number.NaN;
    if (
      typeof parsed.challengeToken !== 'string'
      || parsed.challengeToken.length < 20
      || typeof parsed.enrollmentRequired !== 'boolean'
      || !Number.isFinite(expiresAtMs)
      || expiresAtMs <= now
      || expiresAtMs > now + MAX_TICKET_TTL_MS + 5_000
    ) return null;
    return {
      challengeToken: parsed.challengeToken,
      enrollmentRequired: parsed.enrollmentRequired,
      expiresAt: parsed.expiresAt as string,
    };
  } catch {
    return null;
  }
}

export function setGektaMfaTicket(response: NextResponse, value: string, expiresAt: string) {
  const maxAge = Math.max(1, Math.min(
    MAX_TICKET_TTL_MS / 1000,
    Math.floor((Date.parse(expiresAt) - Date.now()) / 1000),
  ));
  response.cookies.set(GEKTA_MFA_TICKET_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/gekta/auth',
    maxAge,
  });
}

export function clearGektaMfaTicket(response: NextResponse) {
  response.cookies.set(GEKTA_MFA_TICKET_COOKIE, '', {
    path: '/api/gekta/auth',
    expires: new Date(0),
    maxAge: 0,
  });
}

export function sealGektaEmailTicket(token: string, now = Date.now()): string | null {
  const key = encryptionKey('email');
  if (!key || token.length < 20 || token.length > 1_024) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${VERSION}:email`));
  const plaintext = Buffer.from(JSON.stringify({
    token,
    expiresAt: new Date(now + MAX_EMAIL_TICKET_TTL_MS).toISOString(),
  }), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [VERSION, iv.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

export function openGektaEmailTicket(value: string | undefined, now = Date.now()): string | null {
  const key = encryptionKey('email');
  if (!key || !value || value.length > 4_096) return null;
  const [version, ivValue, bodyValue, tagValue, extra] = value.split('.');
  if (version !== VERSION || !ivValue || !bodyValue || !tagValue || extra !== undefined) return null;
  try {
    const iv = Buffer.from(ivValue, 'base64url');
    const ciphertext = Buffer.from(bodyValue, 'base64url');
    const tag = Buffer.from(tagValue, 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > 2_048) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(`${VERSION}:email`));
    decipher.setAuthTag(tag);
    const parsed = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as Record<string, unknown>;
    const expiresAtMs = typeof parsed.expiresAt === 'string' ? Date.parse(parsed.expiresAt) : Number.NaN;
    if (
      typeof parsed.token !== 'string'
      || parsed.token.length < 20
      || parsed.token.length > 1_024
      || !Number.isFinite(expiresAtMs)
      || expiresAtMs <= now
      || expiresAtMs > now + MAX_EMAIL_TICKET_TTL_MS + 5_000
    ) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

export function setGektaEmailTicket(response: NextResponse, value: string) {
  response.cookies.set(GEKTA_EMAIL_TICKET_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/gekta/auth/email',
    maxAge: MAX_EMAIL_TICKET_TTL_MS / 1000,
  });
}

export function clearGektaEmailTicket(response: NextResponse) {
  response.cookies.set(GEKTA_EMAIL_TICKET_COOKIE, '', {
    path: '/api/gekta/auth/email',
    expires: new Date(0),
    maxAge: 0,
  });
}
