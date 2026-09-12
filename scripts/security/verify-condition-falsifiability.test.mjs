import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { alternativesOnly, auditCondition, mutationsFor, strip } from './verify-condition-falsifiability.mjs';

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  .split('\n').filter(Boolean);
const cache = new Map();
const readFile = (path) => {
  if (!cache.has(path)) {
    try { cache.set(path, readFileSync(path, 'utf8')); } catch { cache.set(path, null); }
  }
  return cache.get(path);
};
const context = { tracked, readFile };

test('strip removes every case variant of a pattern, and nothing else', () => {
  assert.equal(strip('aXbXc', 'x'), 'abc');
  assert.equal(strip('useGlobalPipes(new ValidationPipe())', 'validationpipe'), 'useGlobalPipes(new ())');
  assert.equal(strip('untouched', 'absent'), 'untouched');
  assert.equal(strip('anything', ''), 'anything');
});

test('every check kind yields at least one mutation, so no condition is silently unaudited', () => {
  const shapes = [
    { check: 'PRESENT_AT_PATH', paths: ['a.ts'], patterns: ['x'] },
    { check: 'PRESENT_ALL_AT_PATH', paths: ['a.ts'], patterns: ['x', 'y'] },
    { check: 'ABSENT_AT_PATH', paths: ['a.ts'], patterns: ['x'] },
    { check: 'ABSENT_IN_TREE', roots: ['apps/api/src'], patterns: ['x'] },
    { check: 'NO_RUNTIME_CALLER', roots: ['apps/api/src'], patterns: ['x'] },
    { check: 'ABSENT_IN_MANIFESTS', patterns: ['x'] },
  ];
  for (const shape of shapes) {
    assert.ok(mutationsFor(shape).length > 0, `${shape.check} must be auditable`);
  }
});

// PRESENT_ALL_AT_PATH exists to express a conjunction, so each pattern has to be
// destroyable on its own - that is the difference from PRESENT_AT_PATH.
test('PRESENT_ALL_AT_PATH is mutated once per pattern per path', () => {
  const mutations = mutationsFor({
    check: 'PRESENT_ALL_AT_PATH', paths: ['a.ts', 'b.ts'], patterns: ['x', 'y'],
  });
  assert.equal(mutations.length, 4);
});

test('a real condition stops holding when the evidence it names is destroyed', () => {
  const audit = auditCondition({
    condition: 'the global validation pipe is installed',
    check: 'PRESENT_AT_PATH',
    paths: ['apps/api/src/main.ts'],
    patterns: ['useglobalpipes', 'validationpipe'],
  }, context);
  assert.equal(audit.holds, true);
  assert.deepEqual(audit.survived, []);
});

// The harness has to refuse something, or it proves nothing about anything.
// An earlier version of this test used an empty pattern and asserted it would
// survive; it does not - every string contains the empty string, so injecting
// it flips an ABSENT check. The premise was wrong, not the harness.
test('a condition the harness cannot destroy is reported as unaudited, not as passing', () => {
  // ABSENT_IN_TREE with no root: there is nowhere to put a probe file, so the
  // harness produces no mutation and main() reports NO_MUTATION rather than
  // counting it as audited.
  assert.deepEqual(mutationsFor({ check: 'ABSENT_IN_TREE', roots: [], patterns: ['x'] }), []);
  assert.deepEqual(mutationsFor({ check: 'SOMETHING_NEW', patterns: ['x'] }), []);
  assert.equal(auditCondition({ check: 'ABSENT_IN_TREE', roots: [], patterns: ['x'] }, context).mutations, 0);
});

test('alternativesOnly separates spellings of one control from a conjunction', () => {
  // Two spellings of the same pipe: neither alone is load-bearing, and that is
  // correct for PRESENT_AT_PATH.
  assert.equal(alternativesOnly({
    check: 'PRESENT_AT_PATH',
    paths: ['apps/api/src/main.ts'],
    patterns: ['useglobalpipes', 'validationpipe'],
  }, context), true);

  // One pattern that is genuinely load-bearing: removing it flips the condition.
  assert.equal(alternativesOnly({
    check: 'PRESENT_AT_PATH',
    paths: ['apps/api/src/main.ts'],
    patterns: ['useglobalpipes', '__pattern_that_is_not_in_the_file__'],
  }, context), false);

  assert.equal(alternativesOnly({
    check: 'PRESENT_ALL_AT_PATH', paths: ['apps/api/src/main.ts'], patterns: ['a', 'b'],
  }, context), false, 'only PRESENT_AT_PATH can be alternatives-only');
});

test('every committed condition revokes, and the alternatives-only set is exactly the reviewed one', () => {
  const doc = JSON.parse(readFileSync('docs/security/asvs-applicability-decisions.json', 'utf8'));
  const surviving = [];
  const alternatives = [];
  for (const decision of doc.decisions) {
    for (const condition of decision.conditions ?? []) {
      const audit = auditCondition(condition, context);
      if (audit.mutations === 0) surviving.push(`${decision.requirementId}: ${audit.check} unauditable`);
      if (audit.survived.length > 0) surviving.push(`${decision.requirementId}: ${audit.survived[0]}`);
      if (audit.alternativesOnly) alternatives.push(decision.requirementId);
    }
  }
  assert.deepEqual(surviving, [], 'a condition that survives its own destruction is a decision standing on nothing');

  // Pinned, not capped: a new entry has to be read and either justified as
  // spellings of one control or moved to PRESENT_ALL_AT_PATH.
  assert.deepEqual(alternatives.sort(), [
    'V2.2.1', 'V2.2.2', 'V2.2.3', 'V2.3.5', 'V4.1.5', 'V5.4.3', 'V7.1.3', 'V7.5.1', 'V7.6.1',
  ]);

  // None of them is a PASS: an alternatives-only condition under a PASS would be
  // a claim standing on whichever pattern happened to survive.
  const byId = new Map(doc.decisions.map((d) => [d.requirementId, d.status]));
  for (const id of alternatives) assert.notEqual(byId.get(id), 'PASS', `${id} is a PASS on alternatives`);
});
