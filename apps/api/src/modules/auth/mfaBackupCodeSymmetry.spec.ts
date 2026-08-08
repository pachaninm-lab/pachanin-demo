import { generateBackupCodes, hashAuthMaterial } from './auth-crypto';
import { digestMfaBackupCode, digestOpaqueAuthToken } from './opaque-token-authority';

/**
 * The regression this pins.
 *
 * Backup codes were minted through the opaque token authority but still
 * verified with the generic keyed hash, so the two sides produced different
 * values and no backup code could ever match. Nothing failed at the digest —
 * the only symptom was a login rejected as "Invalid or expired MFA challenge",
 * several layers away from the cause.
 *
 * A mint/verify pair is exactly the shape of defect a unit test that exercises
 * only one side cannot see, so these assert the round trip itself.
 */
describe('MFA backup code mint and verify symmetry', () => {
  it('verifies a freshly minted code against its stored digest', () => {
    const { codes, hashes } = generateBackupCodes();

    expect(codes).toHaveLength(8);
    expect(hashes).toHaveLength(8);
    codes.forEach((code, index) => {
      expect(digestMfaBackupCode(code)).toBe(hashes[index]);
    });
  });

  it('stores the versioned authority digest, never the generic keyed hash', () => {
    const { codes, hashes } = generateBackupCodes(1);

    expect(hashes[0]).toMatch(/^v1:[A-Za-z0-9_-]+$/);
    expect(hashes[0]).not.toBe(hashAuthMaterial(codes[0]));
    expect(hashes[0]).not.toBe(hashAuthMaterial(codes[0].trim().toUpperCase()));
  });

  it('normalizes on both sides, so a user retyping a code still matches', () => {
    const { codes, hashes } = generateBackupCodes(1);
    const typed = `  ${codes[0].toLowerCase()}  `;

    expect(digestMfaBackupCode(typed)).toBe(hashes[0]);
  });

  it('binds the code to its own purpose', () => {
    const { codes, hashes } = generateBackupCodes(1);

    expect(digestOpaqueAuthToken({ purpose: 'password-reset', rawToken: codes[0] }))
      .not.toBe(hashes[0]);
    expect(digestOpaqueAuthToken({ purpose: 'mfa-recovery', rawToken: codes[0] }))
      .not.toBe(hashes[0]);
  });

  it('never returns the same digest for two different codes', () => {
    const { hashes } = generateBackupCodes(8);

    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
