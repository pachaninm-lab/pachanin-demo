import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  auditKeyUsage,
  auditRotation,
  ROTATION_CADENCES,
  ROTATION_CRITICALITY,
  ROTATION_SUPPORT,
} from './verify-key-usage.mjs';

const inv = (keys) => ({ keyMaterial: keys });
const use = (keys) => ({ keys });
const kinds = (r) => r.problems.map((p) => p.kind);

const ROTATION = {
  criticality: 'HIGH',
  cadence: 'CALENDAR',
  intervalDays: 90,
  rotationSupport: 'COORDINATED_CUTOVER',
  blastRadius: 'forgery of the thing this key signs',
  rationale: 'stated so the interval is a decision rather than a default',
};

const FULL = {
  name: 'K', kind: 'secret', usedIn: ['a.ts'],
  mayProtect: ['one thing'], mustNotProtect: ['another thing'],
  rotation: ROTATION,
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

/**
 * V13.1.4 asks for the secrets critical to the application AND a schedule for
 * rotating them. An inventory without a schedule answers half the requirement,
 * and a schedule nobody can carry out answers none of it.
 */
test('a secret with no rotation schedule fails', () => {
  const { rotation, ...noSchedule } = FULL;
  const r = auditKeyUsage(inv([{ name: 'K', files: ['a.ts'] }]), use([noSchedule]));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('UNSCHEDULED_SECRET'));
});

test('configuration has nothing to rotate, and a schedule on it fails', () => {
  const config = { name: 'K', kind: 'configuration', usedIn: ['a.ts'], mayProtect: ['x'], mustNotProtect: ['y'], rotation: ROTATION };
  assert.deepEqual(auditRotation([config]).map((p) => p.kind), ['ROTATION_ON_NON_SECRET']);
  // Without a schedule it is simply fine: configuration is not a secret.
  const { rotation, ...plain } = config;
  assert.deepEqual(auditRotation([plain]), []);
});

test('a calendar cadence must carry an interval, and only a calendar cadence may', () => {
  // A number attached to a cadence that cannot honour it is a schedule nobody runs.
  const cases = [
    { ...ROTATION, cadence: 'CALENDAR', intervalDays: null },
    { ...ROTATION, cadence: 'CALENDAR', intervalDays: 0 },
    { ...ROTATION, cadence: 'CALENDAR', intervalDays: -30 },
    { ...ROTATION, cadence: 'CALENDAR', intervalDays: 90.5 },
    { ...ROTATION, cadence: 'EVENT_DRIVEN', intervalDays: 90 },
    { ...ROTATION, cadence: 'PER_RUN', intervalDays: 1 },
  ];
  for (const rotation of cases) {
    assert.deepEqual(
      auditRotation([{ ...FULL, rotation }]).map((p) => p.kind),
      ['UNUSABLE_ROTATION_RECORD'],
      JSON.stringify(rotation),
    );
  }

  // Event-driven and per-run records are valid precisely when they claim no interval.
  for (const cadence of ['EVENT_DRIVEN', 'PER_RUN']) {
    assert.deepEqual(auditRotation([{ ...FULL, rotation: { ...ROTATION, cadence, intervalDays: null } }]), []);
  }
});

test('a rotation record that states no criticality, blast radius or reasoning is not a schedule', () => {
  const cases = [
    { ...ROTATION, criticality: 'SOMEWHAT' },
    { ...ROTATION, criticality: undefined },
    { ...ROTATION, rotationSupport: 'MAGIC' },
    { ...ROTATION, cadence: 'WHENEVER' },
    { ...ROTATION, blastRadius: 'bad' },
    { ...ROTATION, blastRadius: '' },
    { ...ROTATION, rationale: 'because' },
    { ...ROTATION, rationale: '   ' },
  ];
  for (const rotation of cases) {
    assert.deepEqual(
      auditRotation([{ ...FULL, rotation }]).map((p) => p.kind),
      ['UNUSABLE_ROTATION_RECORD'],
      JSON.stringify(rotation),
    );
  }
});

test('the committed register schedules every real secret, and says how each can actually be rotated', () => {
  const usage = JSON.parse(readFileSync('docs/security/cryptographic-key-usage.json', 'utf8'));
  const secrets = usage.keys.filter((entry) => entry.kind === 'secret');
  assert.ok(secrets.length > 20, `expected the real secret set, saw ${secrets.length}`);
  assert.deepEqual(auditRotation(usage.keys), []);

  for (const entry of secrets) {
    assert.ok(ROTATION_CRITICALITY.has(entry.rotation.criticality), entry.name);
    assert.ok(ROTATION_CADENCES.has(entry.rotation.cadence), entry.name);
    assert.ok(ROTATION_SUPPORT.has(entry.rotation.rotationSupport), entry.name);
  }

  // The register must not flatten into one interval for everything. Material whose
  // rotation needs a data migration cannot carry a calendar date, and a token the
  // provider revokes on demand should not be given the same period as a signing
  // secret whose rotation logs every user out.
  const migration = secrets.filter((entry) => entry.rotation.rotationSupport === 'DATA_MIGRATION_REQUIRED');
  assert.ok(migration.length > 0, 'the blind-index pepper and the phone key cannot be rotated on a calendar');
  for (const entry of migration) {
    assert.equal(entry.rotation.cadence, 'EVENT_DRIVEN', `${entry.name} must not claim a calendar it cannot keep`);
  }

  const intervals = new Set(
    secrets.filter((entry) => entry.rotation.cadence === 'CALENDAR').map((entry) => entry.rotation.intervalDays),
  );
  assert.ok(intervals.size > 1, 'one interval written across every secret is a default, not a schedule');
});
