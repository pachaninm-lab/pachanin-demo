import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { auditDecisionEvidence, evidencePaths } from './verify-decision-evidence.mjs';

const base = (over = {}) => ({
  decisions: [], tracked: [], requirementIds: [], directoryExists: () => true, ...over,
});
const kinds = (r) => r.problems.map((p) => p.kind);

test('a condition pointing at a file that is gone fails, because it can no longer revoke anything', () => {
  const r = auditDecisionEvidence(base({
    decisions: [{
      requirementId: 'V1.1.1',
      conditions: [{ check: 'ABSENT_AT_PATH', paths: ['apps/api/src/deleted.ts'], patterns: ['x'] }],
    }],
    tracked: ['apps/api/src/kept.ts'],
    requirementIds: ['V1.1.1'],
  }));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('CONDITION_PATH_GONE'));
});

test('a condition scanning a directory that is gone fails', () => {
  const r = auditDecisionEvidence(base({
    decisions: [{ requirementId: 'V1.1.1', conditions: [{ roots: ['apps/removed'], patterns: ['x'] }] }],
    requirementIds: ['V1.1.1'],
    directoryExists: () => false,
  }));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('CONDITION_ROOT_GONE'));
});

test('a cited file that is gone fails', () => {
  const r = auditDecisionEvidence(base({
    decisions: [{ requirementId: 'V1.1.1', evidence: ['apps/api/src/deleted.ts'] }],
    tracked: [],
    requirementIds: ['V1.1.1'],
  }));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('EVIDENCE_FILE_GONE'));
});

test('a semantic label is not mistaken for a missing file', () => {
  const r = auditDecisionEvidence(base({
    decisions: [{
      requirementId: 'V1.1.1',
      evidence: [
        'repository-scan:no-ldap-integration',
        'stack-mismatch:jndi-is-java-specific',
        'react-jsx-default-escaping',
      ],
    }],
    tracked: [],
    requirementIds: ['V1.1.1'],
  }));
  assert.deepEqual(r.problems, []);
});

test('the path half of a label:path pair is still checked', () => {
  assert.deepEqual(evidencePaths('unallowlisted:apps/api/src/x.controller.ts'), ['apps/api/src/x.controller.ts']);
  assert.deepEqual(evidencePaths('repository-scan:no-ldap-integration'), []);
  assert.deepEqual(evidencePaths('depends-on:V6.1.3'), []);
  assert.deepEqual(evidencePaths('apps/web/app/staff/[...path]/route.ts'), ['apps/web/app/staff/[...path]/route.ts']);

  const r = auditDecisionEvidence(base({
    decisions: [{ requirementId: 'V1.1.1', evidence: ['unallowlisted:apps/api/src/gone.ts'] }],
    tracked: [], requirementIds: ['V1.1.1'],
  }));
  assert.ok(kinds(r).includes('EVIDENCE_FILE_GONE'));
});

test('a depends-on naming a requirement that does not exist fails', () => {
  const r = auditDecisionEvidence(base({
    decisions: [{ requirementId: 'V1.1.1', evidence: ['depends-on:V99.9.9'] }],
    requirementIds: ['V1.1.1'],
  }));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('DEPENDS_ON_UNKNOWN'));
});

test('the same requirement decided twice fails, because order would decide which applies', () => {
  const r = auditDecisionEvidence(base({
    decisions: [{ requirementId: 'V1.1.1' }, { requirementId: 'V1.1.1' }],
    requirementIds: ['V1.1.1'],
  }));
  assert.equal(r.ok, false);
  assert.ok(kinds(r).includes('DUPLICATE_REQUIREMENT'));
});

test('the committed decisions cite nothing that is gone', () => {
  const doc = JSON.parse(readFileSync('docs/security/asvs-applicability-decisions.json', 'utf8'));
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean);
  const result = auditDecisionEvidence({
    decisions: doc.decisions,
    tracked,
    requirementIds: doc.decisions.map((d) => d.requirementId),
    directoryExists: (root) => existsSync(root),
  });
  assert.deepEqual(result.problems, [], JSON.stringify(result.problems, null, 2).slice(0, 3000));
  assert.ok(result.decisions > 300, `expected the real decision set, saw ${result.decisions}`);
});
