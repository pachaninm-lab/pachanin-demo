import { issuePasswordResetCredential, opaqueDigestMatches, resolvePresentedCredential } from './opaque-token-authority';

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;

export type PasswordResetToken = {
  id: string;
  token: string;
  hash: string;
};

/**
 * The stored value is a purpose-bound digest from the opaque token authority,
 * not a generic keyed hash. A reset token and an MFA-recovery token with
 * identical random bytes therefore digest differently, so one can never be
 * presented in place of the other.
 */
export function issuePasswordResetToken(): PasswordResetToken {
  const minted = issuePasswordResetCredential();
  return { id: minted.credentialId, token: minted.rawToken, hash: minted.storedDigest };
}

export function parsePasswordResetToken(raw: string): { id: string; hash: string } | null {
  const parsed = resolvePresentedCredential(raw, 'pr');
  return parsed ? { id: parsed.credentialId, hash: parsed.storedDigest } : null;
}

export function passwordResetHashMatches(stored: string, candidate: string): boolean {
  return opaqueDigestMatches(stored, candidate);
}
