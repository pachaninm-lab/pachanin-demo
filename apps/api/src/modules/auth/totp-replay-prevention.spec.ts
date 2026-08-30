import { Prisma } from '@prisma/client';
import { matchTotpCounter, verifyTotp } from './auth-crypto';
import { PersistentAuthRepository } from './persistent-auth.repository';

/**
 * ASVS 5.0 V6.5.1: a one-time code must be usable exactly once. RFC 6238
 * section 5.2 states the verifier's side of it — an implementation MUST NOT
 * accept a second attempt for a time step it has already accepted.
 *
 * verifyTotp returned a boolean, and that is what made the control impossible:
 * a verifier that knows a code is valid but not which time step it belongs to
 * has nothing to record, so the same six digits verified again for as long as
 * the acceptance window held.
 *
 * The consume is a single conditional UPDATE rather than a read followed by a
 * write, because the API and the workers are separate processes and a
 * read-then-write leaves a window where both see the old value and both accept
 * the same code. The cases below assert the predicate that closes it.
 */

const STEP_MS = 30_000;

/**
 * A fake client that behaves like the row does under PostgreSQL: the predicate
 * is evaluated against the value at the moment the statement runs, and each
 * statement runs to completion before the next observes anything.
 */
function credentialRow(initial: number | null = null) {
  const state = { counter: initial };
  const statements: string[] = [];
  const client = {
    $executeRaw: async (query: Prisma.Sql) => {
      statements.push(query.sql);
      // Parameter order follows the statement: SET counter, WHERE user_id,
      // AND predicate counter.
      const [counter] = query.values as [number, string, number];
      if (state.counter === null || state.counter < counter) {
        state.counter = counter;
        return 1;
      }
      return 0;
    },
    $queryRaw: async () => [],
  };
  return { client, state, statements };
}

const repository = new PersistentAuthRepository(undefined as never);

describe('a TOTP time step is consumed exactly once', () => {
  it('accepts a counter never seen before', async () => {
    const { client } = credentialRow(null);
    await expect(repository.consumeTotpCounter(client as never, 'u-1', 100)).resolves.toBe(true);
  });

  it('refuses the same counter a second time — the replay this requirement is about', async () => {
    const { client } = credentialRow(null);
    await expect(repository.consumeTotpCounter(client as never, 'u-1', 100)).resolves.toBe(true);
    await expect(repository.consumeTotpCounter(client as never, 'u-1', 100)).resolves.toBe(false);
  });

  it('refuses an older counter still inside the acceptance window', async () => {
    // The ±1 window means a code for the previous step is still arithmetically
    // valid. Accepting it after a newer one is exactly the shape a replay takes.
    const { client } = credentialRow(null);
    await expect(repository.consumeTotpCounter(client as never, 'u-1', 100)).resolves.toBe(true);
    await expect(repository.consumeTotpCounter(client as never, 'u-1', 99)).resolves.toBe(false);
  });

  it('accepts a newer counter, or the authenticator would stop working after one use', async () => {
    const { client } = credentialRow(null);
    await expect(repository.consumeTotpCounter(client as never, 'u-1', 100)).resolves.toBe(true);
    await expect(repository.consumeTotpCounter(client as never, 'u-1', 101)).resolves.toBe(true);
  });

  it('advances strictly, so a stale counter never becomes the new high-water mark', async () => {
    const { client, state } = credentialRow(null);
    await repository.consumeTotpCounter(client as never, 'u-1', 100);
    await repository.consumeTotpCounter(client as never, 'u-1', 50);
    expect(state.counter).toBe(100);
  });
});

describe('two processes racing on the same code', () => {
  it('lets exactly one through', async () => {
    const { client } = credentialRow(null);

    // Issued together, as two API processes handling the same replayed code
    // would. The statement is atomic, so the second evaluates its predicate
    // against what the first wrote.
    const results = await Promise.all([
      repository.consumeTotpCounter(client as never, 'u-1', 777),
      repository.consumeTotpCounter(client as never, 'u-1', 777),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('lets exactly one through under many concurrent attempts', async () => {
    const { client } = credentialRow(null);
    const results = await Promise.all(
      Array.from({ length: 25 }, () => repository.consumeTotpCounter(client as never, 'u-1', 999)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('decides in one statement, never a read followed by a write', async () => {
    const { client, statements } = credentialRow(null);
    await repository.consumeTotpCounter(client as never, 'u-1', 1);

    expect(statements).toHaveLength(1);
    const sql = statements[0].replace(/\s+/gu, ' ');
    // The predicate is what makes it atomic. Without it the statement would
    // overwrite unconditionally and every replay would be accepted.
    expect(sql).toContain('UPDATE auth.credential_states');
    // Pinned to the exact operator. The fake above implements the comparison
    // itself, so it cannot tell < from <= — and on a real database that
    // difference IS the vulnerability: with <= the predicate 100 <= 100 holds
    // and the same counter is accepted a second time. Verified against
    // PostgreSQL 16 while writing this: strict < refuses the replay, <= accepts
    // it. The string is therefore the regression guard CI can run.
    expect(sql).toMatch(/mfa_last_totp_counter IS NULL OR mfa_last_totp_counter < \?/u);
    expect(sql).not.toMatch(/mfa_last_totp_counter <=/u);
  });

  it('refuses when no credential row matched at all', async () => {
    const client = { $executeRaw: async () => 0, $queryRaw: async () => [] };
    await expect(repository.consumeTotpCounter(client as never, 'missing', 1)).resolves.toBe(false);
  });
});

describe('the match reports which time step it proves', () => {
  const SECRET = 'JBSWY3DPEHPK3PXP';

  function codeFor(offsetSteps: number): { code: string; at: number } {
    const at = Date.now() + offsetSteps * STEP_MS;
    // Derive through the public surface rather than reimplementing the maths.
    for (let candidate = 0; candidate < 1_000_000; candidate += 1) {
      const padded = String(candidate).padStart(6, '0');
      if (matchTotpCounter(SECRET, padded, at) !== null) return { code: padded, at };
    }
    throw new Error('no code found');
  }

  it('returns the counter, not merely true', () => {
    const { code, at } = codeFor(0);
    expect(matchTotpCounter(SECRET, code, at)).toBe(Math.floor(at / STEP_MS));
  });

  it('still accepts the same three time steps as before', () => {
    for (const offset of [-1, 0, 1]) {
      const { code, at } = codeFor(offset);
      expect(matchTotpCounter(SECRET, code, at)).not.toBeNull();
    }
  });

  it('returns null for a malformed code rather than a counter', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56x']) {
      expect(matchTotpCounter(SECRET, bad, Date.now())).toBeNull();
    }
  });

  it('the boolean form is derived from the match, so the two cannot disagree', () => {
    const { code, at } = codeFor(0);
    expect(verifyTotp(SECRET, code, at)).toBe(true);
    expect(verifyTotp(SECRET, '000000', at)).toBe(matchTotpCounter(SECRET, '000000', at) !== null);
  });
});

describe('neither authentication pathway can accept a TOTP without consuming it', () => {
  const read = (file: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    (require('fs') as typeof import('fs')).readFileSync(`${__dirname}/${file}`, 'utf8');

  it.each(['auth.service.ts', 'product-session.service.ts'])(
    '%s consumes the counter it matched',
    (file) => {
      const source = read(file);
      expect(source).toContain('matchTotpCounter(secret, code)');
      expect(source).toContain('consumeTotpCounter(');
      // A boolean verify on an authentication path cannot be consumed, so it
      // would accept the same code twice.
      expect(source).not.toMatch(/verifyTotp\(secret, code\)/u);
    },
  );

  it('the acceptance window is not widened to compensate', () => {
    const crypto = read('auth-crypto.ts');
    expect(crypto).toContain('TOTP_ACCEPTED_STEP_OFFSETS');
    expect(crypto).not.toMatch(/\[-2,|,\s*2\]/u);
  });
});
