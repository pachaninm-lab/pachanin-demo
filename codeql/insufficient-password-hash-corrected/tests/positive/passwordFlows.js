// Positive regression matrix: every flow below MUST still be reported by the
// corrected query. If the barrier is ever widened until one of these stops
// alerting, `codeql test run` fails on the .expected file.

const { createHash, createHmac, randomBytes } = require('crypto');

// 1. password -> SHA-1
function sha1Password(password) {
  return createHash('sha1').update(password, 'utf8').digest('hex');
}

// 2. password -> SHA-256
function sha256Password(password) {
  return createHash('sha256').update(password, 'utf8').digest('hex');
}

// 3. password -> HMAC-SHA-256
function hmacPassword(password, key) {
  return createHmac('sha256', key).update(password, 'utf8').digest('hex');
}

// 4. password-derived material -> fast deterministic digest
function derivedPassword(password) {
  const derived = `${password}:normalized`;
  return createHash('sha256').update(derived, 'utf8').digest('hex');
}

// 5. password fingerprint folded into a request/audit hash
function requestFingerprint(email, password, key) {
  const canonical = JSON.stringify({ email, passwordFingerprint: password });
  return createHmac('sha256', key).update(canonical, 'utf8').digest('hex');
}

// 6. password through intermediate functions and objects
function normalize(value) {
  return String(value).trim();
}
function wrap(value) {
  return { credential: normalize(value) };
}
function throughObjects(password) {
  const wrapped = wrap(password);
  return createHash('sha256').update(wrapped.credential, 'utf8').digest('hex');
}

// 7. several alias and data-flow hops
function multiHop(password) {
  const first = password;
  const second = first;
  const third = [second].join('');
  const fourth = `${third}`;
  return createHmac('sha256', 'k').update(fourth, 'utf8').digest('hex');
}

// 8. The mirror of the opaque-credential contour, with a password in place of
//    the token. Every step below is one the barrier tolerates for a credential
//    — argument to parameter, `?? ''`, String(), array, join, keyed HMAC — so
//    if the correction ever keyed on the shape rather than on the entropy,
//    this is the flow that would vanish.
const MIRROR_VERSION = 'v1';
const MIRROR_PURPOSE = 'password-reset';
const MIRROR_SEPARATOR = '';
const MIRROR_KEY = createHash('sha256').update('static').digest();

function mirrorDigest(purpose, secret) {
  const value = String(secret ?? '');
  const canonical = [MIRROR_VERSION, purpose, value].join(MIRROR_SEPARATOR);
  return createHmac('sha256', MIRROR_KEY).update(canonical, 'utf8').digest('hex');
}

function mirrorPasswordThroughAuthority(password) {
  return mirrorDigest(MIRROR_PURPOSE, password);
}

// 9-15. Mutations of the opaque-credential contour.
//
//    Each keeps the password-named issuer, so the rule still has a source to
//    report from, and breaks exactly one condition of the barrier. Breaking two
//    at once would prove nothing about which condition is load-bearing: the
//    case would be reported either way.
const MUTATION_KEY = randomBytes(32);

function issuePasswordResetTokenMutant(secret) {
  return { id: 'pr', token: `pr_${secret}`, issuedAt: 0 };
}

// 9. The token is not minted at all: it arrives from the request.
function tokenFromRequestBody(req) {
  const issued = issuePasswordResetTokenMutant(req.body.token);
  return mirrorDigest(MIRROR_PURPOSE, issued.token);
}

// 10. The draw is narrower than the authority's minimum width.
function narrowDraw() {
  const issued = issuePasswordResetTokenMutant(randomBytes(8).toString('hex'));
  return mirrorDigest(MIRROR_PURPOSE, issued.token);
}

// 11. The key is the credential it is meant to protect.
function keyIsTheToken() {
  const issued = issuePasswordResetTokenMutant(randomBytes(32).toString('base64url'));
  const canonical = [MIRROR_VERSION, MIRROR_PURPOSE, String(issued.token ?? '')].join(MIRROR_SEPARATOR);
  return createHmac('sha256', canonical).update(canonical, 'utf8').digest('hex');
}

// 12. The purpose is chosen by the caller rather than fixed.
function unfixedPurpose(req) {
  const issued = issuePasswordResetTokenMutant(randomBytes(32).toString('base64url'));
  return mirrorDigest(req.query.purpose, issued.token);
}

// 13. The version is chosen by the caller rather than fixed.
function unfixedVersion(req) {
  const issued = issuePasswordResetTokenMutant(randomBytes(32).toString('base64url'));
  const canonical = [req.query.version, MIRROR_PURPOSE, String(issued.token ?? '')].join(MIRROR_SEPARATOR);
  return createHmac('sha256', MUTATION_KEY).update(canonical, 'utf8').digest('hex');
}

// 14. A bare hash instead of a keyed HMAC.
function bareHashInsteadOfHmac() {
  const issued = issuePasswordResetTokenMutant(randomBytes(32).toString('base64url'));
  const canonical = [MIRROR_VERSION, MIRROR_PURPOSE, String(issued.token ?? '')].join(MIRROR_SEPARATOR);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// 15. A real token, with a password mixed into the same pre-image. The token is
//    genuinely opaque; the password beside it is not, and is what must keep
//    this reported.
function tokenMixedWithPassword(password) {
  const issued = issuePasswordResetTokenMutant(randomBytes(32).toString('base64url'));
  const canonical = [MIRROR_VERSION, MIRROR_PURPOSE, issued.token, String(password ?? '')]
    .join(MIRROR_SEPARATOR);
  return createHmac('sha256', MUTATION_KEY).update(canonical, 'utf8').digest('hex');
}

module.exports = {
  sha1Password,
  sha256Password,
  hmacPassword,
  derivedPassword,
  requestFingerprint,
  throughObjects,
  multiHop,
  mirrorPasswordThroughAuthority,
  tokenFromRequestBody,
  narrowDraw,
  keyIsTheToken,
  unfixedPurpose,
  unfixedVersion,
  bareHashInsteadOfHmac,
  tokenMixedWithPassword,
};
