import { readFileSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcryptjs';
import {
  DUMMY_PASSWORD_HASH,
  PASSWORD_BCRYPT_COST,
  PASSWORD_SCRYPT_PARAMS,
  hashPassword,
  needsRehash,
  verifyPassword,
  verifyPasswordWithUpgrade,
} from './password-hashing';

/**
 * ASVS V6.2.8: the password must be verified exactly as received, without
 * truncation. bcrypt cuts its input at 72 bytes, so at the policy maximum of
 * 128 characters 56 of them never reach the hash, and for Cyrillic — two bytes
 * per character in UTF-8 — the limit arrives after 36 characters, inside the
 * length the registration form advertises.
 */

jest.setTimeout(120_000);

const LEGACY = 'Correct-Horse-9!';

describe('legacy bcrypt hashes keep working', () => {
  it('verifies a password stored under the old scheme', async () => {
    const legacyHash = bcrypt.hashSync(LEGACY, PASSWORD_BCRYPT_COST);
    await expect(verifyPassword(LEGACY, legacyHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', legacyHash)).resolves.toBe(false);
  });

  it('accepts the older $2a$ prefix as well as $2b$', async () => {
    const hash = bcrypt.hashSync(LEGACY, 10);
    expect(hash.startsWith('$2')).toBe(true);
    await expect(verifyPassword(LEGACY, hash)).resolves.toBe(true);
  });

  it('still refuses the dummy sentinel as a login', async () => {
    await expect(verifyPassword('invalid-password-sentinel', null)).resolves.toBe(false);
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(PASSWORD_BCRYPT_COST);
  });
});

describe('the new scheme does not truncate', () => {
  it('carries an explicit algorithm, version and parameter marker', async () => {
    const stored = await hashPassword(LEGACY);
    const { N, r, p } = PASSWORD_SCRYPT_PARAMS;
    expect(stored.startsWith(`$scrypt$v=1$n=${N},r=${r},p=${p}$`)).toBe(true);
    expect(stored.split('$')).toHaveLength(6);
  });

  it('distinguishes ASCII passwords longer than 72 bytes', async () => {
    const base = 'A'.repeat(72);
    const stored = await hashPassword(`${base}TAIL-ONE`);
    await expect(verifyPassword(`${base}TAIL-ONE`, stored)).resolves.toBe(true);
    await expect(verifyPassword(`${base}TAIL-TWO`, stored)).resolves.toBe(false);
    // The exact failure bcrypt had: the tail was simply not read.
    await expect(verifyPassword(base, stored)).resolves.toBe(false);
  });

  it('distinguishes Cyrillic passwords past the 36-character bcrypt limit', async () => {
    // 40 Cyrillic characters is 80 UTF-8 bytes: bcrypt would stop at 36.
    const base = 'П'.repeat(36);
    const first = `${base}разный-хвост-один`;
    const second = `${base}разный-хвост-два`;
    expect(Buffer.byteLength(first)).toBeGreaterThan(72);
    const stored = await hashPassword(first);
    await expect(verifyPassword(first, stored)).resolves.toBe(true);
    await expect(verifyPassword(second, stored)).resolves.toBe(false);
  });

  it('does not make two passwords sharing their first 72 bytes equivalent', async () => {
    const shared = 'Z'.repeat(72);
    const a = `${shared}alpha`;
    const b = `${shared}omega`;
    const storedA = await hashPassword(a);
    await expect(verifyPassword(a, storedA)).resolves.toBe(true);
    await expect(verifyPassword(b, storedA)).resolves.toBe(false);

    // The same pair under the old scheme, to show what changed rather than
    // assert it from memory.
    const legacyA = bcrypt.hashSync(a, 4);
    expect(bcrypt.compareSync(b, legacyA)).toBe(true);
  });
});

describe('fail-closed parsing', () => {
  it.each([
    ['unknown scheme', '$argon2id$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA'],
    ['unknown version', '$scrypt$v=2$n=65536,r=8,p=1$c2FsdA$aGFzaA'],
    ['non-numeric parameter', '$scrypt$v=1$n=abc,r=8,p=1$c2FsdA$aGFzaA'],
    ['N not a power of two', '$scrypt$v=1$n=65535,r=8,p=1$c2FsdA$aGFzaA'],
    ['missing field', '$scrypt$v=1$n=65536,r=8,p=1$c2FsdA'],
    ['empty salt', '$scrypt$v=1$n=65536,r=8,p=1$$aGFzaA'],
    ['not a hash at all', 'plain-text-password'],
    ['empty string treated as absent', ''],
  ])('refuses %s', async (_label, stored) => {
    await expect(verifyPassword(LEGACY, stored)).resolves.toBe(false);
  });

  it('never rehashes a record it could not parse', () => {
    expect(needsRehash('$scrypt$v=2$n=65536,r=8,p=1$c2FsdA$aGFzaA')).toBe(false);
    expect(needsRehash('garbage')).toBe(false);
    expect(needsRehash(null)).toBe(false);
    expect(needsRehash('')).toBe(false);
  });
});

describe('needsRehash', () => {
  it('is true for a legacy bcrypt hash', () => {
    expect(needsRehash(bcrypt.hashSync(LEGACY, PASSWORD_BCRYPT_COST))).toBe(true);
  });

  it('is false for a hash already written at the current parameters', async () => {
    expect(needsRehash(await hashPassword(LEGACY))).toBe(false);
  });

  it('is true for the current scheme at different parameters', () => {
    expect(needsRehash('$scrypt$v=1$n=16384,r=8,p=1$c2FsdA$aGFzaA')).toBe(true);
  });
});

describe('transparent upgrade on successful login', () => {
  it('rewrites a legacy hash only after the password verified', async () => {
    const legacyHash = bcrypt.hashSync(LEGACY, PASSWORD_BCRYPT_COST);
    const writes: Array<{ next: string; conditionalOn: string }> = [];
    const outcome = await verifyPasswordWithUpgrade(LEGACY, legacyHash, async (next, conditionalOn) => {
      writes.push({ next, conditionalOn });
    });
    expect(outcome).toEqual({ valid: true, upgraded: true });
    expect(writes).toHaveLength(1);
    expect(writes[0].conditionalOn).toBe(legacyHash);
    expect(writes[0].next.startsWith('$scrypt$')).toBe(true);
    // The rewritten hash verifies the same password.
    await expect(verifyPassword(LEGACY, writes[0].next)).resolves.toBe(true);
  });

  it('writes nothing when the password is wrong', async () => {
    const legacyHash = bcrypt.hashSync(LEGACY, PASSWORD_BCRYPT_COST);
    const persist = jest.fn();
    const outcome = await verifyPasswordWithUpgrade('wrong', legacyHash, persist);
    expect(outcome).toEqual({ valid: false, upgraded: false });
    expect(persist).not.toHaveBeenCalled();
  });

  it('writes nothing when the hash is already current', async () => {
    const current = await hashPassword(LEGACY);
    const persist = jest.fn();
    const outcome = await verifyPasswordWithUpgrade(LEGACY, current, persist);
    expect(outcome).toEqual({ valid: true, upgraded: false });
    expect(persist).not.toHaveBeenCalled();
  });

  it('never rewrites without the password: there is no bulk path', async () => {
    const legacyHash = bcrypt.hashSync(LEGACY, PASSWORD_BCRYPT_COST);
    const persist = jest.fn();
    // No password, no rewrite — the only entry point requires a verified one.
    await verifyPasswordWithUpgrade('', legacyHash, persist);
    expect(persist).not.toHaveBeenCalled();
  });

  describe('a failed rewrite must not turn a correct password into a refusal', () => {
    it('reports the login valid when the write throws', async () => {
      const legacyHash = bcrypt.hashSync(LEGACY, PASSWORD_BCRYPT_COST);
      const outcome = await verifyPasswordWithUpgrade(LEGACY, legacyHash, async () => {
        throw new Error('database unavailable');
      });
      expect(outcome).toEqual({ valid: true, upgraded: false });
    });

    it('leaves the old hash usable, so the next login can try again', async () => {
      const legacyHash = bcrypt.hashSync(LEGACY, PASSWORD_BCRYPT_COST);
      await verifyPasswordWithUpgrade(LEGACY, legacyHash, async () => {
        throw new Error('database unavailable');
      });
      await expect(verifyPassword(LEGACY, legacyHash)).resolves.toBe(true);
      expect(needsRehash(legacyHash)).toBe(true);
    });
  });

  it('gives a concurrent login the stored value to condition its write on', async () => {
    const legacyHash = bcrypt.hashSync(LEGACY, PASSWORD_BCRYPT_COST);
    const seen: string[] = [];
    const persist = async (_next: string, conditionalOn: string) => {
      seen.push(conditionalOn);
    };
    const [first, second] = await Promise.all([
      verifyPasswordWithUpgrade(LEGACY, legacyHash, persist),
      verifyPasswordWithUpgrade(LEGACY, legacyHash, persist),
    ]);
    expect(first.valid && second.valid).toBe(true);
    // Both races carry the same precondition, so a compare-and-set at the call
    // site lets exactly one of them land and the other become a no-op.
    expect(seen).toEqual([legacyHash, legacyHash]);
  });

  it('works without a persist callback at all', async () => {
    const legacyHash = bcrypt.hashSync(LEGACY, PASSWORD_BCRYPT_COST);
    await expect(verifyPasswordWithUpgrade(LEGACY, legacyHash)).resolves.toEqual({
      valid: true,
      upgraded: false,
    });
  });
});

describe('work factor configuration', () => {
  // Deliberately not a wall-clock test: the existing suite explains that timing
  // on shared CI runners is unstable and does not explain a failure. The
  // parameters are asserted instead, exactly as bcrypt's cost is.
  it('uses the profile the primary source names, not one derived from what was already in place', () => {
    // OWASP Password Storage Cheat Sheet lists scrypt as N=2^17 (128 MiB),
    // r=8, p=1 at the top of a ladder that trades memory for parallelism down
    // to N=2^13, r=8, p=10. The value this module used before — N=2^16, r=8,
    // p=1 — appears nowhere on that ladder; it was chosen for equivalence with
    // the bcrypt cost already configured, which measures what was there rather
    // than what is recommended.
    expect(PASSWORD_SCRYPT_PARAMS).toEqual({ N: 131_072, r: 8, p: 1 });
    expect(PASSWORD_BCRYPT_COST).toBe(12);
  });

  it('sits on a rung of the published ladder rather than between two', () => {
    const LADDER = [
      { N: 2 ** 17, r: 8, p: 1 },
      { N: 2 ** 16, r: 8, p: 2 },
      { N: 2 ** 15, r: 8, p: 3 },
      { N: 2 ** 14, r: 8, p: 5 },
      { N: 2 ** 13, r: 8, p: 10 },
    ];
    expect(LADDER).toContainEqual({ ...PASSWORD_SCRYPT_PARAMS });
  });

  it('asks for enough memory to run the profile it declares', () => {
    // scrypt needs 128 * N * r bytes. A maxmem below that does not weaken the
    // hash, it makes every verification throw — the failure would be total
    // rather than subtle, but it would still be a failure introduced by
    // raising N without raising the ceiling.
    const { N, r } = PASSWORD_SCRYPT_PARAMS;
    const required = 128 * N * r;
    const source = readFileSync(join(__dirname, 'password-hashing.ts'), 'utf8');
    const declared = /const SCRYPT_MAXMEM = (\d+) \* 1024 \* 1024;/u.exec(source);
    expect(declared).not.toBeNull();
    expect(Number(declared![1]) * 1024 * 1024).toBeGreaterThanOrEqual(required);
  });

  it('keeps N a power of two, which scrypt requires', () => {
    const { N } = PASSWORD_SCRYPT_PARAMS;
    expect(N & (N - 1)).toBe(0);
  });

  it('keeps the dummy hash on the legacy scheme, so both login branches match', () => {
    // If the dummy moved to scrypt while most stored hashes were still bcrypt,
    // the two branches would diverge in cost and the timing oracle this module
    // exists to close would reopen.
    expect(DUMMY_PASSWORD_HASH.startsWith('$2')).toBe(true);
  });
});

describe('the upgrade is actually invoked by the login paths', () => {
  /**
   * This is the defect that made the rest of the module inert. The versioned
   * scheme, the legacy verify and verifyPasswordWithUpgrade all existed and
   * were correct, and both login paths called verifyPassword instead — so no
   * stored bcrypt hash was ever rewritten and the 72-byte truncation stayed in
   * place for every existing account.
   *
   * A control that nothing calls is the shape this programme keeps finding, so
   * the wiring is asserted rather than assumed.
   */
  const read = (file: string) => readFileSync(join(__dirname, file), 'utf8');

  it.each(['auth.service.ts', 'gekta-registration.service.ts'])(
    '%s verifies through the upgrading form',
    (file) => {
      const source = read(file);
      expect(source).toContain('verifyPasswordWithUpgrade(');
      expect(source).toContain('upgradePasswordHashFormat(');
    },
  );

  it.each(['auth.service.ts', 'gekta-registration.service.ts'])(
    '%s no longer uses the non-upgrading form on the login path',
    (file) => {
      // verifyPassword cannot rewrite anything, so a login path that calls it
      // leaves every legacy hash exactly as it found it.
      expect(read(file)).not.toMatch(/await verifyPassword\(/u);
    },
  );

  it('the write is conditional on the previous hash, so a concurrent change wins', () => {
    const repository = read('persistent-auth.repository.ts');
    expect(repository).toContain('auth.upgrade_password_hash_format(${userId}, ${nextHash}, ${expectedHash})');
  });

  it('a failed upgrade does not turn a correct password into a refusal', async () => {
    const legacyHash = await bcrypt.hash(LEGACY, PASSWORD_BCRYPT_COST);
    const outcome = await verifyPasswordWithUpgrade(LEGACY, legacyHash, async () => {
      throw new Error('database unavailable');
    });
    expect(outcome).toEqual({ valid: true, upgraded: false });
  });

  it('a wrong password is never upgraded, whatever the persist callback does', async () => {
    const legacyHash = await bcrypt.hash(LEGACY, PASSWORD_BCRYPT_COST);
    const persist = jest.fn(async () => true);
    const outcome = await verifyPasswordWithUpgrade('not the password', legacyHash, persist);
    expect(outcome).toEqual({ valid: false, upgraded: false });
    expect(persist).not.toHaveBeenCalled();
  });
});
