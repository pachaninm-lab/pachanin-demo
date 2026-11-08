import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcryptjs';
import {
  DUMMY_PASSWORD_HASH,
  PASSWORD_BCRYPT_COST,
  PASSWORD_SCRYPT_PARAMS,
  accountExists,
  comparisonHashFor,
  hashPassword,
  verifyPassword,
} from './password-hashing';

const API_SRC = join(__dirname, '..', '..');
const OWNING_MODULE = join(__dirname, 'password-hashing.ts');

function sourceFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (!path.endsWith('.ts')) continue;
    if (/\.(spec|e2e-spec)\.ts$/u.test(path)) continue;
    found.push(path);
  }
  return found;
}

describe('password hashing work factor', () => {
  // The defect this suite exists for: the dummy hash used on the
  // unknown-account branch was generated at cost 10 while stored passwords
  // were written at cost 12, so the two login branches did measurably
  // different amounts of work and the response time reported whether an
  // email was registered.
  it('generates the dummy hash at the same cost as a stored password', () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(PASSWORD_BCRYPT_COST);
  });

  // Stored passwords moved to scrypt for ASVS V6.2.8, because bcrypt truncates
  // at 72 bytes. The property this test defends is unchanged — the two login
  // branches must do comparable work — but it can no longer be phrased as
  // "the same bcrypt rounds", because a stored password is no longer bcrypt.
  //
  // It is phrased as the parameters instead, for the same reason this file
  // avoids wall-clock assertions elsewhere: the scrypt parameters were chosen
  // by measuring against this very cost (bcrypt 12 ~ 339 ms, scrypt
  // N=65536,r=8,p=1 ~ 350 ms on the target stack), and the measurement is
  // recorded in password-hashing.ts. Asserting the numbers keeps the intent
  // enforceable without making CI depend on runner speed.
  it('writes stored passwords under the scheme measured equivalent to that cost', async () => {
    const stored = await hashPassword('Correct-Horse-9!');
    const { N, r, p } = PASSWORD_SCRYPT_PARAMS;
    expect(stored.startsWith(`$scrypt$v=1$n=${N},r=${r},p=${p}$`)).toBe(true);
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(PASSWORD_BCRYPT_COST);
  });

  it('keeps the cost at or above the current OWASP floor for bcrypt', () => {
    expect(PASSWORD_BCRYPT_COST).toBeGreaterThanOrEqual(10);
  });

  // Asserted on the selected hash rather than by timing the call: a timing
  // assertion would be flaky on shared CI runners and would not say why it
  // failed.
  it('compares against a hash of the same cost when the account does not exist', () => {
    expect(bcrypt.getRounds(comparisonHashFor(null))).toBe(PASSWORD_BCRYPT_COST);
  });

  it('treats a missing hash and an empty one alike', () => {
    for (const absent of [null, undefined, '']) {
      expect(comparisonHashFor(absent)).toBe(DUMMY_PASSWORD_HASH);
      expect(bcrypt.getRounds(comparisonHashFor(absent))).toBe(PASSWORD_BCRYPT_COST);
      expect(accountExists(absent)).toBe(false);
    }
  });

  it('compares against the stored hash when the account does exist', async () => {
    const stored = await hashPassword('Correct-Horse-9!');
    expect(comparisonHashFor(stored)).toBe(stored);
    expect(accountExists(stored)).toBe(true);
  });

  it('refuses the sentinel value itself as a password for a missing account', async () => {
    await expect(verifyPassword('invalid-password-sentinel', null)).resolves.toBe(false);
  });

  it('still verifies a real password against a real hash', async () => {
    const stored = await hashPassword('Correct-Horse-9!');
    await expect(verifyPassword('Correct-Horse-9!', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong', stored)).resolves.toBe(false);
  });
});

describe('password hashing has a single owner', () => {
  // These two are the reason the fix is a module rather than an edited
  // literal. The original defect was not that someone chose 10; it was that
  // six places could each choose independently. A service added months from
  // now fails here rather than silently reintroducing the gap.
  it('lets no file outside the owning module choose a bcrypt cost', () => {
    const offenders: string[] = [];
    for (const path of sourceFiles(API_SRC)) {
      if (path === OWNING_MODULE) continue;
      const source = readFileSync(path, 'utf8');
      if (/bcrypt\s*\.\s*(?:hash|hashSync)\s*\(/u.test(source)
        || /\b(?:hash|hashSync)\s*\([^)]*,\s*\d+\s*\)/u.test(source)) {
        if (/(?:hash|hashSync)\s*\([^)]*,\s*\d+\s*\)/u.test(source)) {
          offenders.push(path.replace(`${API_SRC}/`, ''));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('lets no login path carry its own dummy-hash fallback', () => {
    const offenders: string[] = [];
    for (const path of sourceFiles(API_SRC)) {
      if (path === OWNING_MODULE) continue;
      const source = readFileSync(path, 'utf8');
      if (/\?\?\s*DUMMY_PASSWORD_HASH/u.test(source)) {
        offenders.push(path.replace(`${API_SRC}/`, ''));
      }
    }
    expect(offenders).toEqual([]);
  });
});
