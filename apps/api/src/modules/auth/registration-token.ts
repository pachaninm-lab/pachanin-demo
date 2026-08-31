import { digestOpaqueAuthToken, issueEmailVerificationCredential, opaqueDigestMatches, resolvePresentedCredential } from './opaque-token-authority';

export const REGISTRATION_EMAIL_TTL_MS = 30 * 60 * 1000;
export const REGISTRATION_APPLICATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Email verification and the registration status token both digest through the
 * opaque token authority, so each is bound to its own purpose. A verification
 * token cannot be replayed as a status token, and neither can be replayed as an
 * invitation or a password reset.
 */
export function issueRegistrationEmailToken() {
  const minted = issueEmailVerificationCredential();
  return { id: minted.credentialId, token: minted.rawToken, hash: minted.storedDigest };
}

export function parseRegistrationEmailToken(raw: string): { id: string; hash: string } | null {
  const parsed = resolvePresentedCredential(raw, 'rev');
  return parsed ? { id: parsed.credentialId, hash: parsed.storedDigest } : null;
}

/**
 * The status token is derived rather than random: the same application and
 * idempotency key must always produce the same token so a caller can poll
 * without storing it. It is a proof of submission, not an authentication
 * credential, and the digest below is what the database stores.
 */
export function deriveRegistrationStatusToken(applicationId: string, idempotencyKey: string): string {
  const proof = digestOpaqueAuthToken({
    purpose: 'registration-status',
    rawToken: `derive:${applicationId}:${idempotencyKey}`,
  });
  return `rst_${applicationId}.${proof}`;
}

export function hashRegistrationStatusToken(token: string): string {
  return digestOpaqueAuthToken({ purpose: 'registration-status', rawToken: `present:${token}` });
}

export function registrationTokenHashMatches(stored: string, candidate: string): boolean {
  return opaqueDigestMatches(stored, candidate);
}
