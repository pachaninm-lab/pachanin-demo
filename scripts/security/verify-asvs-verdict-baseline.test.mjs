import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  BASELINE_PATH,
  BASELINE_SCHEMA,
  buildBaseline,
  compareVerdicts,
  parseCsvRow,
  readMatrixVerdicts,
  rejectionKey,
  validateBaseline,
} from './verify-asvs-verdict-baseline.mjs';

const baselineOf = (verdicts, rejectedDecisions = []) => ({
  schemaVersion: BASELINE_SCHEMA,
  verdicts,
  rejectedDecisions,
});

test('a PASS that quietly became NOT_ASSESSED is reported as a regression, naming the requirement', () => {
  const result = compareVerdicts({
    baseline: baselineOf({ 'V3.7.1': 'APPLICABLE/PASS' }),
    verdicts: { 'V3.7.1': 'PENDING_APPLICABILITY_REVIEW/NOT_ASSESSED' },
    rejected: [],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.drift, [{
    requirementId: 'V3.7.1',
    kind: 'REGRESSION',
    before: 'APPLICABLE/PASS',
    after: 'PENDING_APPLICABILITY_REVIEW/NOT_ASSESSED',
  }]);
});

// This is the V8.2.4 shape exactly: a FAIL is a verdict too, and losing it
// removes the requirement from observation rather than improving anything.
test('a FAIL that fell out of assessment is evidence rot, not an improvement', () => {
  const result = compareVerdicts({
    baseline: baselineOf({ 'V8.2.4': 'APPLICABLE/FAIL' }),
    verdicts: { 'V8.2.4': 'PENDING_APPLICABILITY_REVIEW/NOT_ASSESSED' },
    rejected: [],
  });
  assert.equal(result.drift[0].kind, 'EVIDENCE_ROT');
});

test('a justified NOT_APPLICABLE that lost its justification is a regression', () => {
  const result = compareVerdicts({
    baseline: baselineOf({ 'V1.2.6': 'NOT_APPLICABLE_WITH_JUSTIFICATION/NOT_APPLICABLE' }),
    verdicts: { 'V1.2.6': 'PENDING_APPLICABILITY_REVIEW/NOT_ASSESSED' },
    rejected: [],
  });
  assert.equal(result.drift[0].kind, 'REGRESSION');
});

// An improvement still fails. A verdict that moves without anyone reading it is
// the defect being gated, and "we got better" is a claim somebody should sign.
test('a new PASS also fails the gate, classified as an improvement', () => {
  const result = compareVerdicts({
    baseline: baselineOf({ 'V14.2.8': 'APPLICABLE/FAIL' }),
    verdicts: { 'V14.2.8': 'APPLICABLE/PASS' },
    rejected: [],
  });
  assert.equal(result.ok, false);
  assert.equal(result.drift[0].kind, 'IMPROVEMENT');
});

test('an unchanged matrix passes', () => {
  const verdicts = { 'V1.1.1': 'PENDING_APPLICABILITY_REVIEW/NOT_ASSESSED', 'V1.1.2': 'APPLICABLE/PASS' };
  assert.equal(compareVerdicts({ baseline: baselineOf(verdicts), verdicts, rejected: [] }).ok, true);
});

test('a requirement present in only one of the two is named rather than ignored', () => {
  const result = compareVerdicts({
    baseline: baselineOf({ 'V1.1.1': 'APPLICABLE/PASS', 'V9.9.9': 'APPLICABLE/PASS' }),
    verdicts: { 'V1.1.1': 'APPLICABLE/PASS', 'V2.2.2': 'APPLICABLE/PASS' },
    rejected: [],
  });
  assert.deepEqual(result.added, ['V2.2.2']);
  assert.deepEqual(result.removed, ['V9.9.9']);
  assert.equal(result.ok, false);
});

test('a decision the tree stopped supporting cannot appear silently', () => {
  const result = compareVerdicts({
    baseline: baselineOf({ 'V8.2.4': 'APPLICABLE/FAIL' }),
    verdicts: { 'V8.2.4': 'APPLICABLE/FAIL' },
    rejected: [{ requirementId: 'V8.2.4', problems: ['condition no longer holds: x'] }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.newRejections.length, 1);
});

// Deleting the record is the cheapest way to make a standing rejection stop
// being mentioned. It has to cost the same as adding one.
test('a standing rejection cannot be dropped from the baseline without failing', () => {
  const result = compareVerdicts({
    baseline: baselineOf({ 'V8.2.4': 'APPLICABLE/FAIL' }, [
      { requirementId: 'V8.2.4', problems: ['condition no longer holds: x'], acknowledged: 'open drift' },
    ]),
    verdicts: { 'V8.2.4': 'APPLICABLE/FAIL' },
    rejected: [],
  });
  assert.equal(result.ok, false);
  assert.equal(result.clearedRejections.length, 1);
});

test('a recorded rejection still matching reality is standing, not drift', () => {
  const rejection = { requirementId: 'V8.2.4', problems: ['condition no longer holds: x'] };
  const result = compareVerdicts({
    baseline: baselineOf({ 'V8.2.4': 'APPLICABLE/FAIL' }, [{ ...rejection, acknowledged: 'open drift' }]),
    verdicts: { 'V8.2.4': 'APPLICABLE/FAIL' },
    rejected: [rejection],
  });
  assert.equal(result.ok, true);
  assert.equal(result.standingRejections.length, 1);
});

// Rewording the problem would otherwise let a rejection be swapped for a
// different one under the same requirement id.
test('the reason a decision is rejected is compared, not just which requirement', () => {
  const result = compareVerdicts({
    baseline: baselineOf({ 'V8.2.4': 'APPLICABLE/FAIL' }, [
      { requirementId: 'V8.2.4', problems: ['condition no longer holds: x'], acknowledged: 'open drift' },
    ]),
    verdicts: { 'V8.2.4': 'APPLICABLE/FAIL' },
    rejected: [{ requirementId: 'V8.2.4', problems: ['condition no longer holds: something else'] }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.newRejections.length, 1);
  assert.equal(result.clearedRejections.length, 1);
});

test('problem order does not change a rejection identity', () => {
  assert.equal(
    rejectionKey({ requirementId: 'V1.1.1', problems: ['b', 'a'] }),
    rejectionKey({ requirementId: 'V1.1.1', problems: ['a', 'b'] }),
  );
});

test('an unacknowledged rejection is malformed, so it cannot be parked in the file', () => {
  const problems = validateBaseline(baselineOf({ 'V1.1.1': 'APPLICABLE/PASS' }, [
    { requirementId: 'V8.2.4', problems: ['x'], acknowledged: '   ' },
  ]));
  assert.ok(problems.some((problem) => problem.includes('not acknowledged')));
});

test('an empty or wrong-schema baseline is malformed rather than 345 additions', () => {
  assert.deepEqual(validateBaseline(null), ['baseline is not an object']);
  assert.ok(validateBaseline({ schemaVersion: 'other', verdicts: {}, rejectedDecisions: [] }).length >= 2);
});

test('the committed baseline is well formed', () => {
  assert.deepEqual(validateBaseline(JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))), []);
});

test('a quoted matrix cell containing a comma and an escaped quote round-trips', () => {
  assert.deepEqual(parseCsvRow('"a,b","c""d",""'), ['a,b', 'c"d', '']);
});

test('the matrix is read by column name, not by position', () => {
  const csv = [
    '"status","requirement_id","applicability"',
    '"PASS","V1.1.2","APPLICABLE"',
  ].join('\n');
  assert.deepEqual(readMatrixVerdicts(csv), { 'V1.1.2': 'APPLICABLE/PASS' });
});

test('a matrix missing the columns this gate reads is rejected, not read as empty', () => {
  assert.throws(() => readMatrixVerdicts('"requirement_id"\n"V1.1.1"'), /missing/u);
  assert.throws(() => readMatrixVerdicts(''), /empty/u);
});

test('a repeated requirement in the matrix is rejected rather than last-one-wins', () => {
  const csv = [
    '"requirement_id","applicability","status"',
    '"V1.1.1","APPLICABLE","PASS"',
    '"V1.1.1","APPLICABLE","FAIL"',
  ].join('\n');
  assert.throws(() => readMatrixVerdicts(csv), /repeats V1\.1\.1/u);
});

// Regenerating must not quietly discard the sentence explaining why a rejection
// is open - that sentence is the only thing separating a record from a shrug.
test('regenerating the baseline carries acknowledgements forward', () => {
  const next = buildBaseline({
    verdicts: { 'V8.2.4': 'APPLICABLE/FAIL' },
    rejected: [{ requirementId: 'V8.2.4', problems: ['x'] }],
    summary: { standardVersion: '5.0.0', sourceCommit: 'abc', statusCounts: {}, applicabilityCounts: {} },
    previous: { rejectedDecisions: [{ requirementId: 'V8.2.4', problems: ['x'], acknowledged: 'why it is open' }] },
  });
  assert.equal(next.rejectedDecisions[0].acknowledged, 'why it is open');
});

test('a rejection with no previous acknowledgement is written unacknowledged, so the gate refuses it', () => {
  const next = buildBaseline({
    verdicts: { 'V8.2.4': 'APPLICABLE/FAIL' },
    rejected: [{ requirementId: 'V8.2.4', problems: ['x'] }],
    summary: {},
    previous: null,
  });
  assert.match(next.rejectedDecisions[0].acknowledged, /UNACKNOWLEDGED/u);
  assert.ok(validateBaseline(next).some((problem) => problem.includes('not acknowledged')));
});

test('the committed baseline covers every requirement the standard pins', () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  assert.equal(Object.keys(baseline.verdicts).length, 345);
  assert.equal(baseline.sourceCommit, '5cf9b032440be53ce345ab3c130fda46ba1ce7a2');
  for (const [id, verdict] of Object.entries(baseline.verdicts)) {
    assert.match(id, /^V\d+\.\d+\.\d+$/u);
    assert.match(verdict, /^(?:APPLICABLE|NOT_APPLICABLE_WITH_JUSTIFICATION|PENDING_APPLICABILITY_REVIEW)\/(?:PASS|FAIL|NOT_APPLICABLE|NOT_ASSESSED)$/u);
  }
});
