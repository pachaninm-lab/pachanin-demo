import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APPLICABILITY,
  STATUS,
  applyDecisions,
  blocksFinalPass,
  conditionsHold,
  summariseDecisions,
  validateDecision,
} from './asvs-decisions.mjs';

const REQS = [
  { reqId: 'V1.1.1', level: 2 },
  { reqId: 'V6.2.1', level: 1 },
  { reqId: 'V17.1.1', level: 2 },
];

const held = [{ condition: 'no WebRTC in tree', holds: true, evidence: 'scanned' }];

test('a decision without evidence is rejected', () => {
  const { problems } = validateDecision({
    requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_ASSESSED,
    evidence: [], conditions: held,
  });
  assert.ok(problems.some((p) => p.includes('requires evidence')));
});

test('a decision with no conditions is rejected', () => {
  const { problems } = validateDecision({
    requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_ASSESSED,
    evidence: ['scan'], conditions: [],
  });
  assert.ok(problems.some((p) => p.includes('re-verifiable condition')));
});

test('a decision whose condition no longer holds is rejected, not downgraded', () => {
  const { records, rejected } = applyDecisions(REQS, [{
    requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_ASSESSED,
    evidence: ['scan'], conditions: [{ condition: 'no WebRTC', holds: false, evidence: 'RTCPeerConnection appeared' }],
  }]);
  assert.equal(rejected.length, 1);
  const record = records.find((r) => r.reqId === 'V17.1.1');
  assert.equal(record.applicability, APPLICABILITY.PENDING);
  assert.equal(record.status, STATUS.NOT_ASSESSED);
});

test('PASS requires evidence and applicability, never a bare assertion', () => {
  const bare = validateDecision({ requirementId: 'V6.2.1', applicability: APPLICABILITY.APPLICABLE, status: STATUS.PASS, evidence: [], conditions: [] });
  assert.ok(bare.problems.some((p) => p.includes('PASS requires evidence')));
  assert.ok(bare.problems.some((p) => p.includes('re-verifiable condition')));

  const notApplicablePass = validateDecision({ requirementId: 'V6.2.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.PASS, evidence: ['x'], conditions: held });
  assert.ok(notApplicablePass.problems.some((p) => p.includes('PASS requires the requirement to be APPLICABLE')));
});

test('a NOT_APPLICABLE requirement cannot carry an assessment status', () => {
  const { problems } = validateDecision({
    requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.PASS,
    evidence: ['scan'], conditions: held,
  });
  assert.ok(problems.some((p) => p.includes('cannot carry an assessment status')));
});

test('FAIL must describe the gap and remains FAIL', () => {
  assert.ok(validateDecision({ requirementId: 'V6.2.1', applicability: APPLICABILITY.APPLICABLE, status: STATUS.FAIL, evidence: ['x'], conditions: held, note: '' })
    .problems.some((p) => p.includes('FAIL requires a note')));

  const { records } = applyDecisions(REQS, [{
    requirementId: 'V6.2.1', applicability: APPLICABILITY.APPLICABLE, status: STATUS.FAIL,
    evidence: ['audit'], conditions: held, note: 'no rate limit on the reset endpoint',
  }]);
  assert.equal(records.find((r) => r.reqId === 'V6.2.1').status, STATUS.FAIL);
  assert.equal(summariseDecisions(records).finalPass, false);
});

test('a malformed requirement id is rejected rather than silently ignored', () => {
  const { rejected } = applyDecisions(REQS, [{ requirementId: 'V6-2-1', applicability: APPLICABILITY.APPLICABLE, status: STATUS.PASS, evidence: ['x'], conditions: held }]);
  assert.equal(rejected.length, 1);
});

test('a decision for a requirement absent from the pinned standard is rejected', () => {
  const { rejected } = applyDecisions(REQS, [{
    requirementId: 'V99.9.9', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_ASSESSED,
    evidence: ['scan'], conditions: held,
  }]);
  assert.ok(rejected.some((r) => r.problems.some((p) => p.includes('absent from the pinned standard'))));
});

test('duplicate decisions for one requirement are rejected', () => {
  const decision = { requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_ASSESSED, evidence: ['scan'], conditions: held };
  const { rejected } = applyDecisions(REQS, [decision, { ...decision }]);
  assert.ok(rejected.some((r) => r.problems.some((p) => p.includes('duplicate'))));
});

test('anything undecided stays pending and unassessed', () => {
  const { records } = applyDecisions(REQS, []);
  assert.ok(records.every((r) => r.applicability === APPLICABILITY.PENDING && r.status === STATUS.NOT_ASSESSED));
  assert.equal(summariseDecisions(records).finalPass, false);
});

test('a justified NOT_APPLICABLE does not block, an unassessed APPLICABLE does', () => {
  assert.equal(blocksFinalPass({ applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_ASSESSED }), false);
  assert.equal(blocksFinalPass({ applicability: APPLICABILITY.APPLICABLE, status: STATUS.NOT_ASSESSED }), true);
  assert.equal(blocksFinalPass({ applicability: APPLICABILITY.APPLICABLE, status: STATUS.FAIL }), true);
  assert.equal(blocksFinalPass({ applicability: APPLICABILITY.PENDING, status: STATUS.NOT_ASSESSED }), true);
  assert.equal(blocksFinalPass({ applicability: APPLICABILITY.APPLICABLE, status: STATUS.PASS }), false);
});

test('one pending requirement out of hundreds still blocks finalPass', () => {
  const many = Array.from({ length: 344 }, (_, i) => ({
    reqId: `V1.1.${i}`, applicability: APPLICABILITY.APPLICABLE, status: STATUS.PASS,
  }));
  many.push({ reqId: 'V1.2.0', applicability: APPLICABILITY.PENDING, status: STATUS.NOT_ASSESSED });
  const rollup = summariseDecisions(many);
  assert.equal(rollup.finalPass, false);
  assert.ok(rollup.blockers.some((b) => b.startsWith('PENDING_APPLICABILITY_REVIEW:1')));
});

test('conditionsHold requires at least one condition and all of them true', () => {
  assert.equal(conditionsHold({ conditions: [] }), false);
  assert.equal(conditionsHold({ conditions: held }), true);
  assert.equal(conditionsHold({ conditions: [...held, { condition: 'x', holds: false }] }), false);
});
