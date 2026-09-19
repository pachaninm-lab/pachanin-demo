import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { BACKUP_CODE_ENTROPY_BYTES, generateBackupCodes } from './auth-crypto';
import { digestMfaBackupCode, issueMfaBackupCodeCredential } from './opaque-token-authority';

/**
 * ASVS 5.0 V6.5.2 sets one threshold and offers two ways to sit on the right
 * side of it: a lookup secret under 112 bits of entropy must be kept under a
 * salted password-storage hash, or it must carry 112 bits or more and may then
 * be kept under a standard hash. Backup codes are stored under a keyed HMAC, so
 * the entropy is the half that has to hold — and it is a property of the
 * generated value, not of a comment about it.
 *
 * Every assertion here is therefore made against codes the live generator
 * actually produces. Lowering the draw back to six bytes fails the length and
 * entropy cases rather than merely disagreeing with a constant.
 */

/** RFC 4648 base32: no 0, 1, 8 or 9, so no O/0 or I/1 to mistype. */
const BASE32_ALPHABET = /^[A-Z2-7]+$/;
const REQUIRED_BITS = 112;

/** Sources only. Spec files are excluded, so no pattern here matches itself. */
function authSources(): Array<{ path: string; source: string }> {
  const directory = join(__dirname);
  return readdirSync(directory, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts'))
    .map((e) => ({ path: e.name, source: readFileSync(join(directory, e.name), 'utf8') }));
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

describe('MFA backup code entropy (ASVS V6.5.2)', () => {
  it('draws at least 112 bits from the CSPRNG', () => {
    expect(BACKUP_CODE_ENTROPY_BYTES * 8).toBeGreaterThanOrEqual(REQUIRED_BITS);
  });

  it('carries at least 112 bits in the code the user is given', () => {
    const { codes } = generateBackupCodes(16);
    for (const code of codes) {
      const characters = code.replace(/-/g, '');
      expect(characters).toMatch(BASE32_ALPHABET);
      // Entropy the transcribed value can carry: log2(alphabet) per character.
      expect(characters.length * Math.log2(32)).toBeGreaterThanOrEqual(REQUIRED_BITS);
    }
  });

  it('encodes the drawn bytes exactly, with nothing padded and nothing dropped', () => {
    const { codes } = generateBackupCodes(8);
    // 15 bytes is 120 bits, which is 24 base32 characters and no remainder.
    const expected = Math.ceil((BACKUP_CODE_ENTROPY_BYTES * 8) / 5);
    for (const code of codes) {
      expect(code.replace(/-/g, '')).toHaveLength(expected);
      expect(code).not.toContain('=');
    }
  });

  it('groups the code for transcription without changing what it carries', () => {
    const { codes } = generateBackupCodes(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-7]{6}(?:-[A-Z2-7]{6})+$/);
    }
  });

  it('draws each code independently', () => {
    const { codes, hashes } = generateBackupCodes(64);
    expect(new Set(codes).size).toBe(64);
    expect(new Set(hashes).size).toBe(64);
    // A generator stuck on one byte value would still be unique per position;
    // this fails it. Across 64 codes every alphabet symbol should appear.
    const observed = new Set(codes.join('').replace(/-/g, ''));
    expect(observed.size).toBeGreaterThan(24);
  });

  it('stores the digest of the code, never the code', () => {
    const { codes, hashes } = generateBackupCodes(4);
    codes.forEach((code, index) => {
      expect(hashes[index]).toBe(digestMfaBackupCode(code));
      expect(hashes[index]).not.toContain(code);
    });
  });

  /**
   * Raising entropy changes what is minted, never what verifies. Codes handed
   * out before this change are stored as digests and cannot be re-derived, so
   * the verifier has to keep matching them; a format check on input would lock
   * those users out of their own recovery path.
   */
  it('still verifies a code minted under the previous 48-bit format', () => {
    const legacy = 'ABCD-1234-EF56';
    expect(digestMfaBackupCode(legacy)).toBe(issueMfaBackupCodeCredential(legacy).storedDigest);
    expect(digestMfaBackupCode(legacy.toLowerCase())).toBe(digestMfaBackupCode(legacy));
  });

  /**
   * The authority owns the digest and the purpose binding; it must not also own
   * a second entropy decision. It used to mint its own 48-bit code beside the
   * live generator, with no caller — which is how a stale number waits to be
   * inherited.
   */
  it('leaves the entropy decision to one generator', () => {
    const supplied = 'ZZZZZZ-ZZZZZZ-ZZZZZZ-ZZZZZZ';
    const credential = issueMfaBackupCodeCredential(supplied);
    expect(credential.rawToken).toBe(supplied);
    expect(credential.purpose).toBe('mfa-backup-code');

    const sixByteDraw = new RegExp(`randomBytes\\(\\s*6\\s*\\)`);
    const offenders = authSources()
      .filter((f) => sixByteDraw.test(stripComments(f.source)))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
