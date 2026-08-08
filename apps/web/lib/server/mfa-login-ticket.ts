import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// This encrypted ticket module is part of the canonical authentication boundary.
// Changes to controlled single-login access are reviewed under the same auth scope.
export const MFA_PENDING_COOKIE = 'pc_mfa_pending';
export const MFA_PENDING_TTL_SECONDS = 10 * 60;

export type MfaLoginTicket = {
  v: 1;
  challengeToken: string;
  user: {
    email: string;
    role: string;
    surfaceRole?: string;
  };
  exp: number;
};

function key(env: NodeJS.ProcessEnv = process.env) {
  const secret = String(env.MFA_LOGIN_TICKET_SECRET || '').trim();
  if (secret.length < 32) throw new Error('MFA_LOGIN_TICKET_SECRET must contain at least 32 characters');
  return createHash('sha256').update(secret, 'utf8').digest();
}

function decodeCanonicalBase64Url(value: string, expectedBytes?: number): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) return null;
  if (expectedBytes !== undefined && decoded.length !== expectedBytes) return null;
  return decoded;
}

export function sealMfaLoginTicket(
  input: Omit<MfaLoginTicket, 'v' | 'exp'>,
  nowSeconds = Math.floor(Date.now() / 1000),
  env: NodeJS.ProcessEnv = process.env,
) {
  const payload: MfaLoginTicket = {
    v: 1,
    ...input,
    exp: nowSeconds + MFA_PENDING_TTL_SECONDS,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(env), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function openMfaLoginTicket(
  value: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  env: NodeJS.ProcessEnv = process.env,
): MfaLoginTicket | null {
  try {
    const [version, ivRaw, tagRaw, payloadRaw, extra] = String(value || '').split('.');
    if (version !== 'v1' || !ivRaw || !tagRaw || !payloadRaw || extra) return null;
    if (payloadRaw.length > 4_096) return null;
    const iv = decodeCanonicalBase64Url(ivRaw, 12);
    const tag = decodeCanonicalBase64Url(tagRaw, 16);
    const ciphertext = decodeCanonicalBase64Url(payloadRaw);
    if (!iv || !tag || !ciphertext || ciphertext.length === 0) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(env), iv);
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')) as Partial<MfaLoginTicket>;

    if (
      payload.v !== 1 ||
      typeof payload.challengeToken !== 'string' || !payload.challengeToken ||
      !payload.user || typeof payload.user.email !== 'string' || typeof payload.user.role !== 'string' ||
      typeof payload.exp !== 'number' || payload.exp <= nowSeconds ||
      payload.exp - nowSeconds > MFA_PENDING_TTL_SECONDS
    ) {
      return null;
    }
    return payload as MfaLoginTicket;
  } catch {
    return null;
  }
}

export function mfaPendingCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: MFA_PENDING_TTL_SECONDS,
  };
}

export function clearMfaPendingCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth',
    expires: new Date(0),
    maxAge: 0,
  };
}
