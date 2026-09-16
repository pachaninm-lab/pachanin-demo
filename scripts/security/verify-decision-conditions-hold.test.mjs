import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rejectedDecisions, report } from './verify-decision-conditions-hold.mjs';

const REGISTER = 'docs/security/asvs-applicability-decisions.json';

/** A tree of exactly the files a test names, and nothing else. */
const treeOf = (files) => ({
  tracked: Object.keys(files),
  readFile: (path) => files[path] ?? null,
});

const passing = (over = {}) => ({
  requirementId: 'V1.1.1',
  applicability: 'APPLICABLE',
  status: 'PASS',
  evidence: ['apps/api/src/control.ts'],
  conditions: [{
    condition: 'the control is present',
    check: 'PRESENT_AT_PATH',
    paths: ['apps/api/src/control.ts'],
    patterns: ['thecontrol'],
  }],
  note: 'held by the control module',
  ...over,
});

const TREE = treeOf({ 'apps/api/src/control.ts': 'export const theControl = true;' });

test('a decision whose condition still holds is not rejected', () => {
  assert.deepEqual(rejectedDecisions([passing()], TREE), []);
});

test('a decision whose condition stopped holding is rejected', () => {
  const gone = treeOf({ 'apps/api/src/control.ts': 'export const somethingElse = true;' });
  const rejected = rejectedDecisions([passing()], gone);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].requirementId, 'V1.1.1');
  assert.match(rejected[0].problems[0], /condition no longer holds/u);
});

test('the rejection names what the check actually found, so it can be acted on', () => {
  const tripped = treeOf({ 'apps/web/app/layout.tsx': "const analytics = { geoipLookup: true };" });
  const rejected = rejectedDecisions([{
    requirementId: 'V8.2.4',
    applicability: 'APPLICABLE',
    status: 'FAIL',
    evidence: ['repository-scan:no-adaptive-controls'],
    note: 'no adaptive control exists',
    conditions: [{
      condition: 'no adaptive control reads location as an access input',
      check: 'ABSENT_IN_TREE',
      patterns: ['geoiplookup'],
      roots: ['apps'],
    }],
  }], tripped);
  assert.equal(rejected.length, 1);
  // Without the path, a maintainer is told a condition broke and left to find
  // the file by hand - which is how a gate gets switched off.
  assert.match(rejected[0].problems[0], /apps\/web\/app\/layout\.tsx/u);
});

test('a PASS with no conditions at all is rejected, because it can never revoke itself', () => {
  const rejected = rejectedDecisions([passing({ conditions: [] })], TREE);
  assert.equal(rejected.length, 1);
  // Structural validation catches this one before the conditions are consulted:
  // a PASS is required to carry at least one. The test below covers the case
  // where only the conditionsHold rule stands between a decision and the matrix.
  assert.ok(rejected[0].problems.some((problem) => /at least one re-verifiable condition/u.test(problem)));
});

test('a structurally valid decision with no conditions is still rejected', () => {
  // PENDING/NOT_ASSESSED passes every structural rule, so nothing but the
  // conditionsHold rule refuses it. A mutation that skipped that rule survived
  // the test above, which is why this one exists.
  const rejected = rejectedDecisions([{
    requirementId: 'V1.1.1',
    applicability: 'PENDING_APPLICABILITY_REVIEW',
    status: 'NOT_ASSESSED',
    evidence: [],
    conditions: [],
    note: '',
  }], TREE);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].problems[0], /condition no longer holds/u);
});

test('a structurally invalid decision is rejected before its conditions are consulted', () => {
  const rejected = rejectedDecisions([passing({ evidence: [] })], TREE);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].problems.some((problem) => /PASS requires evidence/u.test(problem)));
});

test('two decisions for one requirement are rejected rather than silently resolved', () => {
  const rejected = rejectedDecisions([passing(), passing({ note: 'a second opinion' })], TREE);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].problems[0], /duplicate/u);
});

test('the report says nothing is wrong only when nothing is', () => {
  const clean = report([], 332);
  assert.equal(clean.ok, true);
  assert.match(clean.text, /332 decisions/u);

  const dirty = report([{ requirementId: 'V8.2.4', problems: ['condition no longer holds: x'] }], 332);
  assert.equal(dirty.ok, false);
  assert.match(dirty.text, /V8\.2\.4/u);
  assert.match(dirty.text, /silently un-assesses/u);
});

/**
 * The defect this gate was written for, and the shape of its repair.
 *
 * V8.2.4's condition says no adaptive control reads location as an access
 * input. It searches for the substring "geoip", and an analytics option that
 * turns geolocation enrichment OFF began matching it - so the condition read a
 * disabling as a use, and the decision was rejected with nothing going red.
 *
 * The repair excepts the two benign files by name rather than blunting the
 * pattern, and this test holds it to that. A future maintainer looking at a red
 * gate has a quicker way out - delete the pattern - and that way out is what
 * this refuses.
 */
test('the V8.2.4 condition is repaired by exception rather than by weakening its pattern', () => {
  const register = JSON.parse(readFileSync(REGISTER, 'utf8')).decisions;
  const absence = register.find((row) => row.requirementId === 'V8.2.4').conditions[0];

  assert.ok(absence.patterns.includes('geoip'), 'the broad pattern must keep protecting the rest of the tree');
  assert.deepEqual(absence.exceptPaths, [
    'apps/web/app/layout.tsx',
    'apps/web/tests/unit/publicAnalyticsBoundary.test.ts',
  ]);
  assert.ok(String(absence.exceptReason ?? '').trim().length >= 20, 'an exception without a reason is a hole');
});

/**
 * The ratchet. Everything above tests the mechanism on fixtures; this one runs
 * it against the register and the tree as they actually are, so the suite fails
 * for the same reason the gate does rather than only proving the gate could.
 */
test('every decision in the register currently rests on conditions that hold', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean);
  const cache = new Map();
  const readFile = (path) => {
    if (!cache.has(path)) {
      try {
        cache.set(path, readFileSync(path, 'utf8'));
      } catch {
        cache.set(path, null);
      }
    }
    return cache.get(path);
  };

  const decisions = JSON.parse(readFileSync(REGISTER, 'utf8')).decisions ?? [];
  const rejected = rejectedDecisions(decisions, { tracked, readFile });
  assert.deepEqual(rejected.map((entry) => `${entry.requirementId}: ${entry.problems.join(' ')}`), []);
});
