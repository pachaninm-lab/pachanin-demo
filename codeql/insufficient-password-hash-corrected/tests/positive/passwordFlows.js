// Positive regression matrix: every flow below MUST still be reported by the
// corrected query. If the barrier is ever widened until one of these stops
// alerting, `codeql test run` fails on the .expected file.

const { createHash, createHmac } = require('crypto');

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

module.exports = {
  sha1Password,
  sha256Password,
  hmacPassword,
  derivedPassword,
  requestFingerprint,
  throughObjects,
  multiHop,
};
