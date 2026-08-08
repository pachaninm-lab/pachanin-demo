// Negative regression matrix: none of these may be reported. Every case is
// deliberately password-named, so none of them passes merely because of an
// identifier — what makes them safe is the CSPRNG entropy they carry.

const { createHmac, randomBytes } = require('crypto');

const SEPARATOR = '';
const VERSION = 'v1';
const KEY = randomBytes(32);

function digest(purpose, rawToken) {
  // `String(x ?? '')` and `.join()` are the shapes the production authority
  // uses. They are reproduced exactly, because a barrier written against a
  // simpler shape passed here and then missed the real one.
  const token = String(rawToken ?? '');
  const canonical = [VERSION, purpose, token].join(SEPARATOR);
  return `${VERSION}:${createHmac('sha256', KEY).update(canonical, 'utf8').digest('base64url')}`;
}

// 1. randomBytes(32) straight into a keyed digest.
function rawRandomDigest() {
  return createHmac('sha256', KEY).update(randomBytes(32).toString('base64url'), 'utf8').digest('hex');
}

// 2. 256-bit opaque bearer token assembled from random parts.
function issueOpaqueBearerToken() {
  const id = `tk_${randomBytes(18).toString('base64url')}`;
  const secret = randomBytes(32).toString('base64url');
  const rawToken = `${id}.${secret}`;
  return { rawToken, storedDigest: createHmac('sha256', KEY).update(rawToken, 'utf8').digest('hex') };
}

// 3-6. Separate server-side key, HKDF domain separation, purpose binding and a
// versioned digest — the full storage shape used in production.
function issuePasswordResetCredential() {
  const rawToken = `pr_${randomBytes(18).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
  return { rawToken, storedDigest: digest('password-reset', rawToken) };
}

// 7. MFA recovery credential.
function issueMfaRecoveryCredential() {
  const rawToken = `mr_${randomBytes(18).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
  return { rawToken, storedDigest: digest('mfa-recovery', rawToken) };
}

// 8. Refresh token.
function issueRefreshCredential() {
  const rawToken = `rt_${randomBytes(18).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
  return { rawToken, storedDigest: digest('refresh-token', rawToken) };
}

// 9. MFA challenge.
function issueMfaChallengeCredential() {
  const rawToken = `mc_${randomBytes(18).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
  return { rawToken, storedDigest: digest('mfa-challenge', rawToken) };
}

// 10. Invitation.
function issueInvitationCredential() {
  const rawToken = `iv_${randomBytes(18).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
  return { rawToken, storedDigest: digest('invitation', rawToken) };
}

// 11. Email verification.
function issueEmailVerificationCredential() {
  const rawToken = `rev_${randomBytes(18).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
  return { rawToken, storedDigest: digest('email-verification', rawToken) };
}

// 12. The password-named wrapper that produced the original false positive.
function issuePasswordResetToken() {
  const minted = issuePasswordResetCredential();
  return { id: minted.rawToken.split('.')[0], token: minted.rawToken, hash: minted.storedDigest };
}

// 13-15. The verification contour, which is where the rule actually misfires.
// A password-named issuer mints from a CSPRNG and returns an *object*; a
// caller takes the token back out; verification receives it from outside as a
// plain string, splits it, reassembles it and digests it again. No CSPRNG call
// appears anywhere on that last path — the randomness is established at the
// mint site, in another function. Cases 1-12 above all keep the random draw
// and the digest in one place, which is why they cannot exercise this.
function issueOpaqueCredential(prefix) {
  const credentialId = `${prefix}_${randomBytes(18).toString('base64url')}`;
  const secret = randomBytes(32).toString('base64url');
  const rawToken = `${credentialId}.${secret}`;
  return { credentialId, rawToken, storedDigest: digest('password-reset', rawToken) };
}

// 13. Password-named wrapper: the name is the whole of the rule's evidence.
function issuePasswordResetTokenLike() {
  const minted = issueOpaqueCredential('pr');
  return { id: minted.credentialId, token: minted.rawToken, hash: minted.storedDigest };
}

// 14. Verification: the token arrives as an opaque string from a request.
function resolvePresentedCredentialLike(presented, prefix) {
  const [credentialId, ...extra] = String(presented ?? '').split('.');
  const secret = extra.join('.');
  if (!credentialId.startsWith(`${prefix}_`) || !secret) return null;
  const rawToken = `${credentialId}.${secret}`;
  return { credentialId, storedDigest: digest('password-reset', rawToken) };
}

// 15. The two joined, which is the flow the analysis reports on the product.
function confirmPasswordResetLike() {
  const issued = issuePasswordResetTokenLike();
  return resolvePresentedCredentialLike(issued.token, 'pr');
}

module.exports = {
  issueOpaqueCredential,
  issuePasswordResetTokenLike,
  resolvePresentedCredentialLike,
  confirmPasswordResetLike,
  rawRandomDigest,
  issueOpaqueBearerToken,
  issuePasswordResetCredential,
  issueMfaRecoveryCredential,
  issueRefreshCredential,
  issueMfaChallengeCredential,
  issueInvitationCredential,
  issueEmailVerificationCredential,
  issuePasswordResetToken,
};
