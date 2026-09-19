import { createHmac } from 'crypto';
import {
  TOTP_ACCEPTED_STEP_OFFSETS,
  TOTP_STEP_SECONDS,
  base32Encode,
  buildOtpAuthUri,
  generateTotpSecret,
  verifyTotp,
} from './auth-crypto';
import { MFA_RECOVERY_TTL_MS } from './organization-invitation.service';

/**
 * ASVS 5.0 V6.5.5 puts a ceiling on how long a one-time credential stays
 * usable: 30 seconds for a TOTP, 10 minutes for an out-of-band request.
 *
 * The window assertions here need to know what the correct code is at an
 * arbitrary instant, and asking the module under test would prove nothing. So
 * the oracle is an independent RFC 6238 implementation, and before it is
 * trusted for anything it is checked against the published vectors in RFC 6238
 * Appendix B - which the production code is then also checked against. If both
 * agree with the RFC, a disagreement between them is a real defect rather than
 * two copies of the same mistake.
 */
const RFC_6238_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_6238_BASE32 = base32Encode(RFC_6238_SECRET);

function rfc6238Code(secret: Buffer, unixSeconds: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(unixSeconds / 30)));
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

/** RFC 6238 Appendix B, SHA-1 rows, truncated from 8 digits to the 6 this app issues. */
const RFC_6238_VECTORS: Array<{ unixSeconds: number; code: string }> = [
  { unixSeconds: 59, code: '287082' },
  { unixSeconds: 1_111_111_109, code: '081804' },
  { unixSeconds: 1_111_111_111, code: '050471' },
  { unixSeconds: 1_234_567_890, code: '005924' },
  { unixSeconds: 2_000_000_000, code: '279037' },
  { unixSeconds: 20_000_000_000, code: '353130' },
];

describe('TOTP acceptance window (ASVS V6.5.5)', () => {
  it('agrees with the RFC 6238 published vectors', () => {
    for (const { unixSeconds, code } of RFC_6238_VECTORS) {
      expect(rfc6238Code(RFC_6238_SECRET, unixSeconds)).toBe(code);
      expect(verifyTotp(RFC_6238_BASE32, code, unixSeconds * 1000)).toBe(true);
    }
  });

  it('accepts only the current step, so no code outlives its 30 seconds', () => {
    expect([...TOTP_ACCEPTED_STEP_OFFSETS]).toEqual([0]);
    expect(TOTP_STEP_SECONDS).toBe(30);
  });

  it('refuses the previous step it used to accept', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const stale = verifyTotpCodeAt(secret, now - 30_000);
    expect(verifyTotp(secret, stale, now - 30_000)).toBe(true);
    expect(verifyTotp(secret, stale, now)).toBe(false);
  });

  it('refuses the next step it used to accept', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const future = verifyTotpCodeAt(secret, now + 30_000);
    expect(verifyTotp(secret, future, now + 30_000)).toBe(true);
    expect(verifyTotp(secret, future, now)).toBe(false);
  });

  it('holds a code for the whole of its own step and not one millisecond past it', () => {
    const secret = generateTotpSecret();
    const stepStart = Math.floor(1_700_000_000_000 / 30_000) * 30_000;
    const code = verifyTotpCodeAt(secret, stepStart);
    expect(verifyTotp(secret, code, stepStart)).toBe(true);
    expect(verifyTotp(secret, code, stepStart + 29_999)).toBe(true);
    expect(verifyTotp(secret, code, stepStart + 30_000)).toBe(false);
    expect(verifyTotp(secret, code, stepStart - 1)).toBe(false);
  });

  it('refuses anything that is not six digits before doing any work', () => {
    const secret = generateTotpSecret();
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56 78', '  ', '000000a']) {
      expect(verifyTotp(secret, bad)).toBe(false);
    }
  });

  it('still tolerates the spacing a user pastes in', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const code = verifyTotpCodeAt(secret, now);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(true);
  });

  it('advertises the same period to the authenticator app that it enforces', () => {
    const uri = buildOtpAuthUri('user@example.com', generateTotpSecret());
    expect(uri).toContain(`period=${TOTP_STEP_SECONDS}`);
  });
});

describe('out-of-band MFA recovery lifetime (ASVS V6.5.5)', () => {
  it('is within the ten-minute ceiling for an out-of-band request', () => {
    expect(MFA_RECOVERY_TTL_MS).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(MFA_RECOVERY_TTL_MS).toBe(10 * 60 * 1000);
  });

  it('is still long enough to be usable', () => {
    expect(MFA_RECOVERY_TTL_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });
});

/**
 * The oracle, bound to the secret encoding the module actually uses. Kept below
 * the suites it serves because it is scaffolding, not a property under test.
 */
function verifyTotpCodeAt(base32Secret: string, unixMs: number): string {
  return rfc6238Code(base32Decode(base32Secret), Math.floor(unixMs / 1000));
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/u, '').toUpperCase();
  const bytes: number[] = [];
  let value = 0;
  let bits = 0;
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error(`unexpected base32 character: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
