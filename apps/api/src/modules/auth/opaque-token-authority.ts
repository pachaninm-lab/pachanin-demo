import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'crypto';
import { requireSecret } from '../../common/config/secrets';

/**
 * The credential/token authority for opaque one-time secrets.
 *
 * This is a separate cryptographic contour from `auth-crypto.ts`. That module
 * keyed-hashes ordinary material — request fingerprints, account and client
 * hashes — where the input is not itself a secret that grants access. A
 * one-time token is different: it *is* the bearer credential, its digest is
 * what the database stores, and a lookup by that digest is what admits the
 * bearer. Mixing the two into one helper meant a single key and a single
 * canonicalisation covered both, so nothing structurally prevented a token
 * minted for one purpose from verifying against another purpose's record.
 *
 * Three properties are enforced here and cannot be bypassed by a caller:
 *
 *  1. **Domain separation from every other key.** The digest key is derived by
 *     HKDF with `info = pc-auth-opaque-token-digest:v1`, so it is not the
 *     session-signing secret, the CSRF secret or any password hash, even when
 *     it is derived from the same master material.
 *  2. **Purpose binding.** The purpose is part of the canonical pre-image, so
 *     a password-reset token and an MFA-recovery token with identical random
 *     bytes produce different digests. Cross-purpose substitution cannot
 *     succeed by construction rather than by a caller remembering to check.
 *  3. **Explicit versioning.** The stored form is `v1:<digest>`. An unknown
 *     version is rejected rather than treated as the current one, so rotating
 *     the scheme can never silently accept a digest it did not produce.
 */

export const OPAQUE_TOKEN_DIGEST_VERSION = 'v1';

const SUPPORTED_DIGEST_VERSIONS = new Set([OPAQUE_TOKEN_DIGEST_VERSION]);

/**
 * Domain-separation label. Changing it changes every digest, which is why it
 * carries its own version independent of the stored digest version.
 */
const HKDF_INFO = 'pc-auth-opaque-token-digest:v1';
const HKDF_SALT = 'pc-auth-opaque-token-digest-salt';

/** Unit separator: not producible inside a base64url token id or secret, so
 *  the three canonical fields cannot be made to run together. */
const FIELD_SEPARATOR = '\u001f';

const MIN_KEY_MATERIAL_LENGTH = 32;

export const OPAQUE_TOKEN_PURPOSES = [
  'password-reset',
  'mfa-recovery',
  'invitation',
  'email-verification',
  'membership-selection',
  'refresh-token',
  'mfa-challenge',
  'registration-status',
  'mfa-backup-code',
  'staff-access',
] as const;

export type OpaqueTokenPurpose = typeof OPAQUE_TOKEN_PURPOSES[number];

const PURPOSES = new Set<string>(OPAQUE_TOKEN_PURPOSES);

/**
 * Token id prefix to purpose. One canonical mapping, so a call site chooses a
 * token *shape* and gets the matching purpose automatically — a caller cannot
 * mint an `iv` token under the `mr` purpose by passing the wrong argument.
 *
 * `mr` is the recovery token that the `resetMembershipMfa` operation mints and
 * `confirmMfaRecovery` consumes: one contour, one purpose. The domain method
 * names are unchanged.
 */
export const OPAQUE_TOKEN_PREFIX_PURPOSE = {
  rt: 'refresh-token',
  mc: 'mfa-challenge',
  ms: 'membership-selection',
  iv: 'invitation',
  mr: 'mfa-recovery',
  pr: 'password-reset',
  rev: 'email-verification',
  rst: 'registration-status',
} as const satisfies Record<string, OpaqueTokenPurpose>;

export type OpaqueTokenPrefix = keyof typeof OPAQUE_TOKEN_PREFIX_PURPOSE;

function isProduction(): boolean {
  return String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

/**
 * Resolve the master key material this contour derives from.
 *
 * A dedicated secret is preferred. Failing that, the auth pepper is acceptable
 * because HKDF's `info` separates this key from every other use of the same
 * material. In production one of the two must be present: there is no fallback,
 * so a deployment without a configured authority fails at startup instead of
 * silently minting digests nobody can reproduce after the next restart.
 *
 * Takes the environment as an argument so the production fail-closed path is
 * directly testable without mutating the real process environment.
 */
export function resolveOpaqueTokenKeyMaterial(source: NodeJS.ProcessEnv = process.env): string {
  const dedicated = String(source.AUTH_OPAQUE_TOKEN_DIGEST_KEY ?? '').trim();
  if (dedicated) {
    if (dedicated.length < MIN_KEY_MATERIAL_LENGTH) {
      throw new Error(
        `[auth] AUTH_OPAQUE_TOKEN_DIGEST_KEY is set but too weak (< ${MIN_KEY_MATERIAL_LENGTH} chars). Refusing to start.`,
      );
    }
    return dedicated;
  }

  const pepper = String(source.AUTH_TOKEN_PEPPER ?? '').trim();
  if (pepper) {
    if (pepper.length < MIN_KEY_MATERIAL_LENGTH) {
      throw new Error(
        `[auth] AUTH_TOKEN_PEPPER is set but too weak (< ${MIN_KEY_MATERIAL_LENGTH} chars). Refusing to start.`,
      );
    }
    return pepper;
  }

  if (String(source.NODE_ENV ?? '').toLowerCase() === 'production') {
    throw new Error(
      '[auth] AUTH_OPAQUE_TOKEN_DIGEST_KEY or AUTH_TOKEN_PEPPER is required in production. Refusing to start.',
    );
  }

  // Test and CI only. requireSecret yields a stable per-process value outside
  // production and refuses to invent one inside it.
  return requireSecret('JWT_SECRET');
}

let cachedDigestKey: Buffer | null = null;

/** The derived digest key. Never logged, never returned to a caller. */
function digestKey(): Buffer {
  if (!cachedDigestKey) {
    cachedDigestKey = Buffer.from(
      hkdfSync('sha256', resolveOpaqueTokenKeyMaterial(), HKDF_SALT, HKDF_INFO, 32),
    );
  }
  return cachedDigestKey;
}

// Resolve at module load so a production process without an authority fails to
// start, rather than failing on the first login of the day.
if (isProduction()) digestKey();

export type OpaqueTokenDigestInput = {
  purpose: OpaqueTokenPurpose;
  rawToken: string;
  version?: string;
};

/**
 * The stored digest of an opaque one-time token: `v1:<base64url>`.
 *
 * The pre-image is `version ␟ purpose ␟ rawToken`, so a digest is only ever
 * valid for the version and purpose it was minted under.
 */
export function digestOpaqueAuthToken({
  purpose,
  rawToken,
  version = OPAQUE_TOKEN_DIGEST_VERSION,
}: OpaqueTokenDigestInput): string {
  if (!PURPOSES.has(purpose)) {
    throw new Error(`[auth] unknown opaque token purpose: ${purpose}`);
  }
  if (!SUPPORTED_DIGEST_VERSIONS.has(version)) {
    throw new Error(`[auth] unsupported opaque token digest version: ${version}`);
  }
  const token = String(rawToken ?? '');
  if (!token) {
    throw new Error('[auth] refusing to digest an empty opaque token');
  }
  const canonical = [version, purpose, token].join(FIELD_SEPARATOR);
  const mac = createHmac('sha256', digestKey()).update(canonical, 'utf8').digest('base64url');
  return `${version}:${mac}`;
}

/**
 * Constant-time comparison of a stored digest against a freshly computed one.
 *
 * Length is compared first because `timingSafeEqual` throws on a mismatch; a
 * differing length already means a differing version or a corrupt record, and
 * neither is a secret worth protecting with constant time.
 */
export function opaqueDigestMatches(stored: string, candidate: string): boolean {
  const left = Buffer.from(String(stored ?? ''), 'utf8');
  const right = Buffer.from(String(candidate ?? ''), 'utf8');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

/**
 * An MFA backup code, normalised and digested together.
 *
 * These two steps must never live apart. When minting normalised-and-digested
 * in one module while verification normalised-and-digested in another, the two
 * silently diverged and no backup code could match — the failure surfaced only
 * as "Invalid or expired MFA challenge", with nothing pointing at the digest.
 * Keeping the normalisation inside the authority makes that divergence
 * impossible: there is one function, and both sides call it.
 */
export function digestMfaBackupCode(code: string): string {
  return digestOpaqueAuthToken({
    purpose: 'mfa-backup-code',
    rawToken: String(code ?? '').trim().toUpperCase(),
  });
}

/**
 * A credential issued by the authority.
 *
 * `rawToken` is the bearer secret and exists exactly once, on its way to a
 * delivery or response boundary. `storedDigest` is the only value a caller may
 * persist. `purpose` and `version` travel with them so a reader of the call
 * site can see which contour a record belongs to without inferring it from an
 * id prefix.
 */
export type IssuedCredential = {
  credentialId: string;
  rawToken: string;
  storedDigest: string;
  purpose: OpaqueTokenPurpose;
  version: string;
};

/**
 * The single place a credential comes into existence.
 *
 * Random generation, purpose binding, version selection, the canonical
 * pre-image, the HMAC and the stored formatting all happen here, in one step.
 * A call site never assembles a token out of parts and never reaches a crypto
 * primitive: it asks for a credential and receives one.
 */
function issueCredential(prefix: OpaqueTokenPrefix): IssuedCredential {
  const credentialId = `${prefix}_${randomBytes(18).toString('base64url')}`;
  const secret = randomBytes(32).toString('base64url');
  const rawToken = `${credentialId}.${secret}`;
  const purpose = OPAQUE_TOKEN_PREFIX_PURPOSE[prefix];
  return {
    credentialId,
    rawToken,
    purpose,
    version: OPAQUE_TOKEN_DIGEST_VERSION,
    storedDigest: digestOpaqueAuthToken({ purpose, rawToken }),
  };
}

// One typed entry point per contour. The purpose is chosen by the function the
// caller picks, so it cannot be passed wrongly, and a reviewer can see at the
// call site which credential is being minted.
export const issuePasswordResetCredential = (): IssuedCredential => issueCredential('pr');
export const issueMfaRecoveryCredential = (): IssuedCredential => issueCredential('mr');
export const issueInvitationCredential = (): IssuedCredential => issueCredential('iv');
export const issueEmailVerificationCredential = (): IssuedCredential => issueCredential('rev');
export const issueMembershipSelectionCredential = (): IssuedCredential => issueCredential('ms');
export const issueRefreshCredential = (): IssuedCredential => issueCredential('rt');
export const issueMfaChallengeCredential = (): IssuedCredential => issueCredential('mc');

/**
 * The registration status credential is derived, not random: the same
 * application and idempotency key must always yield the same value so a caller
 * can poll without storing it.
 */
export function issueRegistrationStatusCredential(
  applicationId: string,
  idempotencyKey: string,
): IssuedCredential {
  const proof = digestOpaqueAuthToken({
    purpose: 'registration-status',
    rawToken: `derive:${applicationId}:${idempotencyKey}`,
  });
  const rawToken = `rst_${applicationId}.${proof}`;
  return {
    credentialId: `rst_${applicationId}`,
    rawToken,
    purpose: 'registration-status',
    version: OPAQUE_TOKEN_DIGEST_VERSION,
    storedDigest: digestOpaqueAuthToken({
      purpose: 'registration-status',
      rawToken: `present:${rawToken}`,
    }),
  };
}

/**
 * Wrap an already-minted backup code as a credential.
 *
 * Backup codes are human-transcribed, so their alphabet and grouping are a
 * usability decision, and it belongs beside the base32 alphabet in
 * auth-crypto.ts rather than here. This issuer used to mint its own besides
 * that one, from six bytes - 48 bits - with no runtime caller. Two generators
 * for one purpose is how a stale number survives: raising entropy in the live
 * one leaves the dormant one for whoever calls it next. The entropy decision
 * is now made in exactly one place and this issuer takes its result, so the
 * typed issuer for this purpose is the live path rather than a second one.
 */
export function issueMfaBackupCodeCredential(rawToken: string): IssuedCredential {
  return {
    credentialId: rawToken,
    rawToken,
    purpose: 'mfa-backup-code',
    version: OPAQUE_TOKEN_DIGEST_VERSION,
    storedDigest: digestMfaBackupCode(rawToken),
  };
}

/** Staff access tokens carry their own prefix and are not part of the auth map. */
export function issueStaffAccessCredential(): IssuedCredential {
  const credentialId = `sat_${randomBytes(18).toString('base64url')}`;
  const rawToken = `${credentialId}.${randomBytes(32).toString('base64url')}`;
  return {
    credentialId,
    rawToken,
    purpose: 'staff-access',
    version: OPAQUE_TOKEN_DIGEST_VERSION,
    storedDigest: digestOpaqueAuthToken({ purpose: 'staff-access', rawToken }),
  };
}

/**
 * Resolve a presented token to the digest that would have been stored.
 *
 * Returns `null` for anything malformed, so a caller cannot query with a
 * digest derived from a token of the wrong shape. The purpose comes from the
 * prefix the caller expects, never from the presented token, so a bearer
 * cannot choose which purpose their token is checked against.
 */
export function resolvePresentedCredential(
  rawToken: string,
  prefix: OpaqueTokenPrefix,
): { credentialId: string; storedDigest: string } | null {
  const [credentialId, secret, extra] = String(rawToken ?? '').split('.');
  if (extra || !credentialId || !secret || !credentialId.startsWith(`${prefix}_`) || secret.length < 32) {
    return null;
  }
  return {
    credentialId,
    storedDigest: digestOpaqueAuthToken({
      purpose: OPAQUE_TOKEN_PREFIX_PURPOSE[prefix],
      rawToken: `${credentialId}.${secret}`,
    }),
  };
}

/**
 * Compatibility shape for call sites that store the id and the digest.
 *
 * Kept deliberately thin: it delegates to the typed issuers above so there is
 * still exactly one place a credential is created.
 */
export type OpaqueToken = {
  id: string;
  secret: string;
  token: string;
  digest: string;
};

export function makeOpaqueToken(prefix: OpaqueTokenPrefix): OpaqueToken {
  const issued = issueCredential(prefix);
  return {
    id: issued.credentialId,
    secret: issued.rawToken.slice(issued.credentialId.length + 1),
    token: issued.rawToken,
    digest: issued.storedDigest,
  };
}

export function parseOpaqueToken(
  token: string,
  prefix: OpaqueTokenPrefix,
): { id: string; digest: string } | null {
  const resolved = resolvePresentedCredential(token, prefix);
  return resolved ? { id: resolved.credentialId, digest: resolved.storedDigest } : null;
}
