// Negative regression matrix: none of these may be reported. Every case is
// deliberately password-named, so none of them passes merely because of an
// identifier — what makes them safe is the CSPRNG entropy they carry.

const { createHmac, randomBytes } = require('crypto');

const SEPARATOR = '';
const VERSION = 'v1';
const KEY = randomBytes(32);

function digest(purpose, rawToken) {
  const canonical = [VERSION, purpose, rawToken].join(SEPARATOR);
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

module.exports = {
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
