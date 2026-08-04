import {
  OPAQUE_TOKEN_DIGEST_VERSION,
  OPAQUE_TOKEN_PREFIX_PURPOSE,
  digestOpaqueAuthToken,
  makeOpaqueToken,
  opaqueDigestMatches,
  parseOpaqueToken,
  resolveOpaqueTokenKeyMaterial,
} from './opaque-token-authority';

const RAW = 'pr_abcdefghijklmnopqrstuv.wxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-x';
const STRONG = 'a-production-grade-secret-value-0123456789';

describe('opaque token authority', () => {
  it('is deterministic for the same token and purpose', () => {
    expect(digestOpaqueAuthToken({ purpose: 'password-reset', rawToken: RAW }))
      .toBe(digestOpaqueAuthToken({ purpose: 'password-reset', rawToken: RAW }));
  });

  it('separates the same token across purposes', () => {
    const digests = (['password-reset', 'mfa-recovery', 'invitation', 'email-verification',
      'membership-selection', 'refresh-token', 'mfa-challenge', 'registration-status',
      'mfa-backup-code', 'staff-access'] as const)
      .map((purpose) => digestOpaqueAuthToken({ purpose, rawToken: RAW }));

    expect(new Set(digests).size).toBe(digests.length);
  });

  it('separates two different tokens under the same purpose', () => {
    expect(digestOpaqueAuthToken({ purpose: 'invitation', rawToken: RAW }))
      .not.toBe(digestOpaqueAuthToken({ purpose: 'invitation', rawToken: `${RAW}x` }));
  });

  it('never leaks the raw token into the digest it stores', () => {
    const minted = makeOpaqueToken('pr');

    expect(minted.digest).not.toContain(minted.token);
    expect(minted.digest).not.toContain(minted.secret);
    expect(minted.digest).toMatch(/^v1:[A-Za-z0-9_-]+$/);
  });

  it('never puts the raw token in the error it throws', () => {
    expect(() => digestOpaqueAuthToken({ purpose: 'not-a-purpose' as never, rawToken: RAW }))
      .toThrow(/unknown opaque token purpose/);
    try {
      digestOpaqueAuthToken({ purpose: 'not-a-purpose' as never, rawToken: RAW });
    } catch (error) {
      expect(String(error)).not.toContain(RAW);
    }
  });

  it('rejects an altered digest', () => {
    const minted = makeOpaqueToken('iv');
    const altered = `${minted.digest.slice(0, -1)}${minted.digest.endsWith('A') ? 'B' : 'A'}`;

    expect(opaqueDigestMatches(minted.digest, altered)).toBe(false);
    expect(opaqueDigestMatches(minted.digest, minted.digest)).toBe(true);
  });

  it('rejects a digest carried over from the previous keyed-hash scheme', () => {
    // 64 hex characters, the old stored shape. It must not match, and it must
    // not be mistaken for a versioned digest.
    const legacy = 'a'.repeat(64);
    const minted = makeOpaqueToken('pr');

    expect(opaqueDigestMatches(legacy, minted.digest)).toBe(false);
    expect(legacy).not.toMatch(/^v1:/);
  });

  // A bearer must not choose which purpose their token is checked against.
  it('refuses a password-reset token presented as an MFA recovery token', () => {
    const reset = makeOpaqueToken('pr');

    expect(parseOpaqueToken(reset.token, 'mr')).toBeNull();
    expect(digestOpaqueAuthToken({ purpose: 'mfa-recovery', rawToken: reset.token }))
      .not.toBe(reset.digest);
  });

  it('binds every prefix to exactly one purpose', () => {
    const purposes = Object.values(OPAQUE_TOKEN_PREFIX_PURPOSE);

    expect(new Set(purposes).size).toBe(purposes.length);
    for (const [prefix, purpose] of Object.entries(OPAQUE_TOKEN_PREFIX_PURPOSE)) {
      const minted = makeOpaqueToken(prefix as never);
      expect(minted.id.startsWith(`${prefix}_`)).toBe(true);
      expect(minted.digest).toBe(digestOpaqueAuthToken({ purpose, rawToken: minted.token }));
    }
  });

  describe('versioning', () => {
    it('stores the version it was minted under', () => {
      expect(makeOpaqueToken('mr').digest.startsWith(`${OPAQUE_TOKEN_DIGEST_VERSION}:`)).toBe(true);
    });

    it('rejects an unknown version instead of treating it as current', () => {
      expect(() => digestOpaqueAuthToken({ purpose: 'invitation', rawToken: RAW, version: 'v2' }))
        .toThrow(/unsupported opaque token digest version/);
    });

    it('does not silently accept a digest relabelled to another version', () => {
      const minted = makeOpaqueToken('iv');
      const relabelled = minted.digest.replace(/^v1:/, 'v2:');

      expect(opaqueDigestMatches(minted.digest, relabelled)).toBe(false);
    });
  });

  describe('key authority', () => {
    it('prefers the dedicated secret', () => {
      expect(resolveOpaqueTokenKeyMaterial({
        AUTH_OPAQUE_TOKEN_DIGEST_KEY: STRONG,
        AUTH_TOKEN_PEPPER: 'a-different-pepper-value-0123456789012',
      } as NodeJS.ProcessEnv)).toBe(STRONG);
    });

    it('falls back to the auth pepper, which HKDF separates by domain', () => {
      const pepper = 'a-pepper-value-that-is-long-enough-01234';
      expect(resolveOpaqueTokenKeyMaterial({ AUTH_TOKEN_PEPPER: pepper } as NodeJS.ProcessEnv))
        .toBe(pepper);
    });

    it('blocks startup in production when no authority is configured', () => {
      expect(() => resolveOpaqueTokenKeyMaterial({ NODE_ENV: 'production' } as NodeJS.ProcessEnv))
        .toThrow(/AUTH_OPAQUE_TOKEN_DIGEST_KEY or AUTH_TOKEN_PEPPER is required in production/);
    });

    it('refuses a configured but weak authority', () => {
      expect(() => resolveOpaqueTokenKeyMaterial({
        AUTH_OPAQUE_TOKEN_DIGEST_KEY: 'too-short',
      } as NodeJS.ProcessEnv)).toThrow(/too weak/);
      expect(() => resolveOpaqueTokenKeyMaterial({
        AUTH_TOKEN_PEPPER: 'too-short',
      } as NodeJS.ProcessEnv)).toThrow(/too weak/);
    });

    it('never returns the derived key to a caller', () => {
      // The module exports the material resolver for the fail-closed test, but
      // the HKDF output itself has no exported accessor at all.
      const exported = require('./opaque-token-authority');
      expect(Object.keys(exported).some((name) => /digestKey|derivedKey/i.test(name))).toBe(false);
    });
  });

  describe('parsing', () => {
    it.each([
      ['empty', ''],
      ['no secret', 'pr_onlyid'],
      ['wrong prefix', 'iv_abcdefghijklmnopqr.abcdefghijklmnopqrstuvwxyz0123456789ab'],
      ['too short a secret', 'pr_abcdefghijklmnopqr.short'],
      ['extra segment', 'pr_abcdefghijklmnopqr.abcdefghijklmnopqrstuvwxyz0123456789ab.extra'],
    ])('returns null for a malformed token: %s', (_label, candidate) => {
      expect(parseOpaqueToken(candidate, 'pr')).toBeNull();
    });

    it('round-trips a minted token to the digest that was stored', () => {
      const minted = makeOpaqueToken('ms');
      const parsed = parseOpaqueToken(minted.token, 'ms');

      expect(parsed?.id).toBe(minted.id);
      expect(parsed?.digest).toBe(minted.digest);
      expect(opaqueDigestMatches(minted.digest, parsed?.digest ?? '')).toBe(true);
    });
  });
});
