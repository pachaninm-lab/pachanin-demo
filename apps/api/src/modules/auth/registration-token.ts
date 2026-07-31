import { randomBytes } from 'crypto';
import { hashAuthMaterial, secureEqual } from './auth-crypto';

export const REGISTRATION_EMAIL_TTL_MS = 30 * 60 * 1000;
export const REGISTRATION_APPLICATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function issueRegistrationEmailToken() {
  const id = `rev_${randomBytes(18).toString('base64url')}`;
  const secret = randomBytes(32).toString('base64url');
  const token = `${id}.${secret}`;
  return { id, token, hash: hashAuthMaterial(token) };
}

export function parseRegistrationEmailToken(raw: string): { id: string; hash: string } | null {
  const [id, secret, extra] = String(raw ?? '').split('.');
  if (extra || !id || !secret || !id.startsWith('rev_') || secret.length < 40) return null;
  return { id, hash: hashAuthMaterial(`${id}.${secret}`) };
}

export function deriveRegistrationStatusToken(applicationId: string, idempotencyKey: string): string {
  const proof = hashAuthMaterial(`registration-status:${applicationId}:${idempotencyKey}`);
  return `rst_${applicationId}.${proof}`;
}

export function hashRegistrationStatusToken(token: string): string {
  return hashAuthMaterial(`registration-status-token:${token}`);
}

export function registrationTokenHashMatches(stored: string, candidate: string): boolean {
  return secureEqual(stored, candidate);
}
