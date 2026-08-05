// Characterization fixtures for the repository-owned password-hashing model
// correction. CodeQL analyses this file; nothing here is executed.
//
// POSITIVE — must still be reported as insufficient password hashing.
// NEGATIVE — must not be reported: full-entropy opaque bearer tokens.

const { createHmac, createHash, randomBytes } = require('crypto');

const FIELD_SEPARATOR = '';

// POSITIVE 1: a user-chosen password through a fast hash.
function storePasswordSha256(password) {
  return createHash('sha256').update(password, 'utf8').digest('hex');
}

// POSITIVE 2: a user-chosen password through a keyed hash.
function storePasswordHmac(password, key) {
  return createHmac('sha256', key).update(password, 'utf8').digest('hex');
}

// POSITIVE 3: a password-derived request fingerprint. The password is folded
// into a wider structure, but that structure is still an offline oracle for it.
function requestFingerprint(email, password, key) {
  const canonical = JSON.stringify({ email, passwordFingerprint: password });
  return createHmac('sha256', key).update(canonical, 'utf8').digest('hex');
}

// NEGATIVE 1: an opaque bearer token minted by a password-named function.
// 256 bits of CSPRNG entropy, so the digest's cost does not bound a search.
function issuePasswordResetToken(key) {
  const id = `pr_${randomBytes(18).toString('base64url')}`;
  const secret = randomBytes(32).toString('base64url');
  const token = `${id}.${secret}`;
  return { token, digest: createHmac('sha256', key).update(token, 'utf8').digest('base64url') };
}

// NEGATIVE 2: the same, purpose-bound and versioned.
function issuePasswordResetCredential(key) {
  const rawToken = `pr_${randomBytes(18).toString('base64url')}.${randomBytes(32).toString('base64url')}`;
  const canonical = ['v1', 'password-reset', rawToken].join(FIELD_SEPARATOR);
  return {
    rawToken,
    storedDigest: `v1:${createHmac('sha256', key).update(canonical, 'utf8').digest('base64url')}`,
  };
}

// NEGATIVE 3: an MFA backup code — shorter, still entirely CSPRNG-derived.
function issueMfaBackupCode(key) {
  const raw = randomBytes(6).toString('hex').toUpperCase();
  const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  return createHmac('sha256', key).update(code, 'utf8').digest('base64url');
}

module.exports = {
  storePasswordSha256,
  storePasswordHmac,
  requestFingerprint,
  issuePasswordResetToken,
  issuePasswordResetCredential,
  issueMfaBackupCode,
};
