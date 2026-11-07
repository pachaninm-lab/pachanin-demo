import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditMigrationPlan, migrationSubjects } from './verify-crypto-migration-plan.mjs';

const REAL_PLAN = readFileSync('docs/security/CRYPTO_MIGRATION_PLAN.md', 'utf8');
const REAL_INVENTORY = JSON.parse(readFileSync('docs/security/cryptographic-inventory.json', 'utf8'));
const kinds = (r) => r.problems.map((p) => p.kind);

test('an algorithm present in the tree but absent from the plan fails', () => {
  const inventory = {
    operations: [
      ...REAL_INVENTORY.operations,
      { operation: 'signing', id: 'signing', sites: 1, algorithms: [{ algorithm: 'ed25519', sites: 1 }] },
    ],
  };
  const result = auditMigrationPlan(inventory, REAL_PLAN);
  assert.equal(result.ok, false);
  assert.ok(kinds(result).includes('ALGORITHM_WITHOUT_A_PLAN'));
  assert.ok(result.problems[0].items.includes('ed25519'));
});

test('an operation with zero sites is not a migration subject', () => {
  assert.ok(!migrationSubjects(REAL_INVENTORY).includes('ed25519'));
  const withZero = {
    operations: [{ operation: 'signing', id: 'signing', sites: 0, algorithms: [{ algorithm: 'ed25519', sites: 0 }] }],
  };
  assert.deepEqual(migrationSubjects(withZero), []);
});

test('an unresolved algorithm name is not demanded of the plan', () => {
  const inventory = {
    operations: [{ operation: 'csprng', id: 'csprng', sites: 3, algorithms: [{ algorithm: 'unspecified', sites: 3 }] }],
  };
  assert.deepEqual(migrationSubjects(inventory), ['csprng']);
});

test('a plan missing a trigger, a target, a cost or the post-quantum position fails', () => {
  // Case-insensitively, because the checker lowercases before it looks - and
  // the words also occur in ordinary prose, so removing every occurrence is
  // what actually proves the structural check is load-bearing.
  for (const heading of ['migration trigger', 'target', 'cost', 'post-quantum']) {
    const stripped = REAL_PLAN.replace(new RegExp(heading, 'giu'), 'REMOVED');
    const result = auditMigrationPlan(REAL_INVENTORY, stripped);
    assert.equal(result.ok, false, `removing ${heading} should fail`);
  }
});

test('headings without entries behind them fail rather than counting as a plan', () => {
  const skeleton = '# Plan\n\nMigration trigger Target Cost post-quantum\n'
    + 'aes-256-gcm sha-256 sha-1 scrypt bcrypt csprng webcrypto\n';
  const result = auditMigrationPlan(REAL_INVENTORY, skeleton);
  assert.equal(result.ok, false);
  assert.ok(kinds(result).includes('FEWER_ENTRIES_THAN_ALGORITHMS'));
});

test('the committed plan covers the committed inventory', () => {
  const result = auditMigrationPlan(REAL_INVENTORY, REAL_PLAN);
  assert.deepEqual(result.problems, [], JSON.stringify(result.problems, null, 2));
  assert.ok(result.subjects.length >= 6, `expected the real algorithm set, saw ${result.subjects.join(', ')}`);
});

/**
 * The plan's two load-bearing honesty claims. Both are measured facts elsewhere
 * in this repository, and both would be tempting to quietly drop if they ever
 * became inconvenient.
 */
test('the plan keeps saying what it does not cover', () => {
  const plan = REAL_PLAN.toLowerCase();
  for (const claim of ['v11.1.1', "not in the application's custody", 'does not cover']) {
    assert.ok(plan.includes(claim), `the plan must keep stating: ${claim}`);
  }
});

test('the zero-asymmetric claim is measured, not asserted', () => {
  const zero = ['signing', 'verification', 'keypair', 'key-exchange'];
  for (const id of zero) {
    const operation = REAL_INVENTORY.operations.find((o) => (o.id ?? o.operation) === id);
    assert.ok(operation, `${id} must still be scanned for`);
    assert.equal(operation.sites, 0, `${id} now has sites; the plan's post-quantum section is out of date`);
  }
});
