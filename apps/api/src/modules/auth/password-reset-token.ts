import { randomBytes } from 'crypto';
import { hashAuthMaterial, secureEqual } from './auth-crypto';

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;

export type PasswordResetToken = {
  id: string;
  token: string;
  hash: string;
};

export function issuePasswordResetToken(): PasswordResetToken {
  const id = `pr_${randomBytes(18).toString('base64url')}`;
  const secret = randomBytes(32).toString('base64url');
  const token = `${id}.${secret}`;
  return { id, token, hash: hashAuthMaterial(token) };
}

export function parsePasswordResetToken(raw: string): { id: string; hash: string } | null {
  const [id, secret, extra] = String(raw ?? '').split('.');
  if (extra || !id || !secret || !id.startsWith('pr_') || secret.length < 40) return null;
  return { id, hash: hashAuthMaterial(`${id}.${secret}`) };
}

export function passwordResetHashMatches(stored: string, candidate: string): boolean {
  return secureEqual(stored, candidate);
}
