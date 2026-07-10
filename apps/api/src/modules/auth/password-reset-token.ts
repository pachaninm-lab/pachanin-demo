import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const PASSWORD_RESET_TTL_SECONDS = 15 * 60;

export type PasswordResetTokenPayload = {
  v: 1;
  cid: string;
  sub: string;
  nonce: string;
  iat: number;
  exp: number;
};

function secret(env: NodeJS.ProcessEnv = process.env): string {
  const value = String(env.PASSWORD_RESET_TOKEN_SECRET || env.JWT_SECRET || '').trim();
  if (value.length < 32) throw new Error('PASSWORD_RESET_TOKEN_SECRET must contain at least 32 characters');
  return value;
}

function signature(encodedPayload: string, env: NodeJS.ProcessEnv = process.env): string {
  return createHmac('sha256', secret(env)).update(encodedPayload).digest('base64url');
}

export function issuePasswordResetToken(
  challengeId: string,
  userId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const payload: PasswordResetTokenPayload = {
    v: 1,
    cid: challengeId,
    sub: userId,
    nonce: randomBytes(24).toString('base64url'),
    iat: nowSeconds,
    exp: nowSeconds + PASSWORD_RESET_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signature(encoded, env)}`;
}

export function verifyPasswordResetToken(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  env: NodeJS.ProcessEnv = process.env,
): PasswordResetTokenPayload | null {
  const [encoded, suppliedSignature, extra] = String(token || '').split('.');
  if (!encoded || !suppliedSignature || extra) return null;

  let expectedSignature: string;
  try {
    expectedSignature = signature(encoded, env);
  } catch {
    return null;
  }

  const supplied = Buffer.from(suppliedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<PasswordResetTokenPayload>;
    if (
      payload.v !== 1 ||
      typeof payload.cid !== 'string' || !payload.cid ||
      typeof payload.sub !== 'string' || !payload.sub ||
      typeof payload.nonce !== 'string' || payload.nonce.length < 20 ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= nowSeconds ||
      payload.iat > nowSeconds + 60 ||
      payload.exp - payload.iat > PASSWORD_RESET_TTL_SECONDS
    ) {
      return null;
    }
    return payload as PasswordResetTokenPayload;
  } catch {
    return null;
  }
}
