#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, '../../../..');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));

const gapMap = readJson('exact-gap-map.v1.json');
const baseline = readJson('dod-baseline.v1.json');
const state = readJson('execution-state.v1.json');

const allowedClassifications = new Set([
  'KEEP',
  'EXTEND_EXISTING',
  'NEW_REQUIRED',
  'REMOVE_OR_SUPERSEDE',
  'EXTERNAL_BLOCKER',
  'NOT_REQUIRED',
]);
const allowedStatuses = new Set(['PASS', 'PARTIAL', 'FAIL', 'EXTERNAL_BLOCKER', 'NOT_EVIDENCED']);

assert.equal(gapMap.exactMainBaseline, state.observedMainSha);
assert.equal(baseline.exactMainBaseline, state.observedMainSha);
assert.equal(gapMap.specification.sha256, state.specification.sha256);
assert.equal(baseline.specificationSha256, state.specification.sha256);
assert.equal(baseline.criteria.length, 126);
assert.equal(new Set(baseline.criteria.map(({ criterion }) => criterion)).size, 126);

const criteriaPayload = `${baseline.criteria.map(({ criterion }) => criterion).join('\n')}\n`;
const criteriaHash = createHash('sha256').update(criteriaPayload).digest('hex');
assert.equal(criteriaHash, state.specification.dodListSha256);

const gapIds = new Set();
for (const finding of gapMap.findings) {
  assert.ok(!gapIds.has(finding.id), `duplicate gap id: ${finding.id}`);
  gapIds.add(finding.id);
  assert.ok(finding.classification.length > 0, `missing classification: ${finding.id}`);
  for (const classification of finding.classification) {
    assert.ok(allowedClassifications.has(classification), `invalid classification: ${finding.id}/${classification}`);
  }
  assert.ok(finding.evidence.length > 0, `missing evidence: ${finding.id}`);
  for (const evidencePath of finding.evidence) {
    assert.ok(fs.existsSync(path.join(repositoryRoot, evidencePath)), `evidence path does not exist: ${finding.id}/${evidencePath}`);
  }
  assert.ok(finding.finding, `missing finding: ${finding.id}`);
  assert.ok(finding.requiredDelta, `missing required delta: ${finding.id}`);
}

const counts = Object.fromEntries([...allowedStatuses].map((status) => [status, 0]));
for (const item of baseline.criteria) {
  assert.ok(allowedStatuses.has(item.status), `invalid DoD status: ${item.criterion}/${item.status}`);
  counts[item.status] += 1;
  for (const gapRef of item.gapRefs) {
    assert.ok(gapIds.has(gapRef), `unknown gap ref: ${item.criterion}/${gapRef}`);
  }
  if (item.status === 'PASS') {
    assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0, `PASS lacks evidence: ${item.criterion}`);
  }
}

assert.deepEqual(counts, state.dodStatusCounts);
const strictPercent = Math.floor((counts.PASS / baseline.criteria.length) * 1000) / 10;
assert.equal(strictPercent, state.overallProgressPercent);
assert.equal(state.overallProgressPercent, 3.1);
assert.equal(state.invariants.registrationCodeChanged, false);
assert.equal(state.invariants.registrationBehaviorChanged, false);
assert.equal(state.invariants.roleEligibilityRegression, false);
assert.equal(state.invariants.productionMockEvidenceAccepted, false);
assert.equal(state.invariants.newMandatoryPaidDependencies, 0);
assert.equal(state.invariants.externalPartnerMessagesSent, 0);

process.stdout.write(
  `PC-CROP W0 verified: ${baseline.criteria.length} criteria, ${counts.PASS} PASS, ${strictPercent.toFixed(1)}% strict progress, ${gapMap.findings.length} gap findings.\n`,
);
