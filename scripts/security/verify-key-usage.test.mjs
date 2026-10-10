import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditKeyUsage } from './verify-key-usage.mjs';

const inv = (keys) => ({ keyMaterial: keys });
const use = (keys) => ({ keys });
const kinds = (r) => r.problems.map((p) => p.kind);

const FULL = {
  name: 'K', kind: 'secret', usedIn: ['a.ts'],
  mayProtect: ['one thing'], mustNotProtect: ['another thing'],
};

test('a new key with no recorded boundary fails', () => {
  const r = auditKeyUsage(inv([{ name: 'K', files: ['a.ts'] }, { name: 'NEW', files: ['b.ts'] }]), use([FULL]));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('UNDOCUMENTED_KEY'));
  assert.deepEqual(r.problems.find((p) => p.kind === 'UNDOCUMENTED_KEY').keys, ['NEW']);
});

test('a key that spreads to a file the map does not account for fails', () => {
  const r = auditKeyUsage(inv([{ name: 'K', files: ['a.ts', 'somewhere-new.ts'] }]), use([FULL]));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('KEY_USED_SOMEWHERE_UNDECIDED'));
});

test('a key that no longer appears where the map says it does also fails', () => {
  const r = auditKeyUsage(inv([{ name: 'K', files: [] }]), use([FULL]));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('KEY_USED_SOMEWHERE_UNDECIDED'));
});

test('an entry for key material that no longer exists fails, so the map cannot rot', () => {
  const r = auditKeyUsage(inv([]), use([FULL]));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('PHANTOM_KEY'));
});

test('half a boundary is not a boundary', () => {
  for (const half of [{ mayProtect: [] }, { mustNotProtect: [] }]) {
    const r = auditKeyUsage(inv([{ name: 'K', files: ['a.ts'] }]), use([{ ...FULL, ...half }]));
    assert.equal(r.ok, false, JSON.stringify(half));
    assert.ok(kinds(r).includes('UNSTATED_BOUNDARY'));
  }
});

test('a complete map over the same keys passes', () => {
  const r = auditKeyUsage(inv([{ name: 'K', files: ['a.ts'] }]), use([FULL]));
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
});

test('the committed map covers the committed inventory exactly', () => {
  const result = auditKeyUsage(
    JSON.parse(readFileSync('docs/security/cryptographic-inventory.json', 'utf8')),
    JSON.parse(readFileSync('docs/security/cryptographic-key-usage.json', 'utf8')),
  );
  assert.deepEqual(result.problems, [], JSON.stringify(result.problems, null, 2));
  assert.ok(result.inventoryKeys > 20, `expected the real key set, saw ${result.inventoryKeys}`);
});

/**
 * The map is prose, so it can be filled with prose that says nothing. These are
 * the two properties that stop it: every key must name what it may not protect,
 * and the two boundary violations already found must stay named rather than
 * being quietly smoothed over into a clean-looking record.
 */
test('the committed map names the boundary violations it found rather than hiding them', () => {
  const usage = JSON.parse(readFileSync('docs/security/cryptographic-key-usage.json', 'utf8'));
  const byName = new Map(usage.keys.map((k) => [k.name, k]));

  const jwt = byName.get('JWT_SECRET');
  assert.ok(jwt.mustNotProtect.some((line) => line.includes('#4790')), 'the cursor fallback must stay recorded');

  const cursor = byName.get('DEAL_REGISTRY_CURSOR_SECRET');
  assert.ok(cursor.mustNotProtect.some((line) => line.includes('#4790')), 'the fallback must be recorded on both sides');

  for (const key of usage.keys) {
    assert.ok(key.mustNotProtect.every((line) => line.length > 15), `${key.name} has a token boundary line`);
  }
});
