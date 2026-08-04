import { hashAuthMaterial, hashPasswordFingerprint } from './auth-crypto';

describe('password fingerprint', () => {
  it('is deterministic, so an idempotent retry that swaps the credential is still caught', async () => {
    const first = await hashPasswordFingerprint('correct horse battery staple');
    const second = await hashPasswordFingerprint('correct horse battery staple');

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('separates two passwords that differ by one character', async () => {
    const [a, b] = await Promise.all([
      hashPasswordFingerprint('correct horse battery staple'),
      hashPasswordFingerprint('correct horse battery stapl3'),
    ]);

    expect(a).not.toBe(b);
  });

  it('never returns the password itself', async () => {
    const password = 'correct horse battery staple';
    const fingerprint = await hashPasswordFingerprint(password);

    expect(fingerprint).not.toContain(password);
  });

  // The defect this replaced: a user-chosen password ran through the keyed
  // hash meant for high-entropy tokens, so the request hash that carries it
  // recovered the password at HMAC-SHA256 speed while the credential beside it
  // cost bcrypt(12). The fingerprint must not be reachable at that speed.
  it('costs materially more than the keyed hash used for high-entropy material', async () => {
    const password = 'correct horse battery staple';

    const keyedStart = process.hrtime.bigint();
    for (let i = 0; i < 100; i += 1) hashAuthMaterial(`${password}:${i}`);
    const keyedNanos = Number(process.hrtime.bigint() - keyedStart) / 100;

    const slowStart = process.hrtime.bigint();
    await hashPasswordFingerprint(password);
    const slowNanos = Number(process.hrtime.bigint() - slowStart);

    // scrypt at N=2^14 is tens of milliseconds against an HMAC's microseconds.
    // A thousandfold floor proves the KDF is actually engaged without pinning
    // the assertion to one machine's clock.
    expect(slowNanos).toBeGreaterThan(keyedNanos * 1000);
  });

  it('does not reuse the keyed-hash output for the same password', async () => {
    const password = 'correct horse battery staple';

    expect(await hashPasswordFingerprint(password)).not.toBe(
      hashAuthMaterial(`registration-password:${password}`),
    );
  });
});
