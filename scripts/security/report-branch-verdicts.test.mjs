import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { branchChanges, classify, statusMap } from './report-branch-verdicts.mjs';

const main = statusMap([
  { requirementId: 'V1.1.1', status: 'FAIL' },
  { requirementId: 'V2.2.2', status: 'PASS' },
  { requirementId: 'V3.3.3', status: 'NOT_APPLICABLE' },
]);

test('a branch is credited only for what its own commits changed', () => {
  const base = statusMap([{ requirementId: 'V1.1.1', status: 'FAIL' }, { requirementId: 'V2.2.2', status: 'PASS' }]);
  const head = [{ requirementId: 'V1.1.1', status: 'PASS' }, { requirementId: 'V2.2.2', status: 'PASS' }];
  // V2.2.2 is carried, not authored: identical to the branch's own merge-base.
  assert.deepEqual(branchChanges(base, head), [{ requirementId: 'V1.1.1', from: 'FAIL', to: 'PASS' }]);
});

test('a requirement the branch introduces is credited from NONE', () => {
  assert.deepEqual(
    branchChanges(statusMap([]), [{ requirementId: 'V9.9.9', status: 'PASS' }]),
    [{ requirementId: 'V9.9.9', from: 'NONE', to: 'PASS' }],
  );
});

test('resolving is favourable on the branch and not on main', () => {
  assert.equal(classify({ requirementId: 'V1.1.1', to: 'PASS' }, main), 'would-resolve');
  assert.equal(classify({ requirementId: 'V1.1.1', to: 'NOT_APPLICABLE' }, main), 'would-resolve');
});

test('taking a verdict away is the case that matters most', () => {
  assert.equal(classify({ requirementId: 'V2.2.2', to: 'FAIL' }, main), 'would-downgrade');
  assert.equal(classify({ requirementId: 'V3.3.3', to: 'NOT_ASSESSED' }, main), 'would-downgrade');
});

test('two different favourable verdicts are a disagreement, not progress', () => {
  assert.equal(classify({ requirementId: 'V3.3.3', to: 'PASS' }, main), 'differs');
});

test('agreeing with main is no effect either way', () => {
  assert.equal(classify({ requirementId: 'V2.2.2', to: 'PASS' }, main), 'no-effect');
  assert.equal(classify({ requirementId: 'V1.1.1', to: 'FAIL' }, main), 'no-effect');
});

test('a requirement main has never heard of counts as unfavourable', () => {
  assert.equal(classify({ requirementId: 'V7.7.7', to: 'PASS' }, main), 'would-resolve');
});

test('the report runs against this repository and exits 0', () => {
  const result = spawnSync(process.execPath, ['scripts/security/report-branch-verdicts.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, RECONCILE_MARKER: 'session_01Ht5RMu3AvMTs36zQ8zaCFk' },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /branch verdict reconciliation against/u);
  assert.match(result.stdout, /verdicts a branch would take away/u);
});
