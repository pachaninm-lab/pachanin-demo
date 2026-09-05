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
    requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_APPLICABLE,
    evidence: [], conditions: held,
  });
  assert.ok(problems.some((p) => p.includes('requires evidence')));
});

test('a decision with no conditions is rejected', () => {
  const { problems } = validateDecision({
    requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_APPLICABLE,
    evidence: ['scan'], conditions: [],
  });
  assert.ok(problems.some((p) => p.includes('re-verifiable condition')));
});

test('a decision whose condition no longer holds is rejected, not downgraded', () => {
  const { records, rejected } = applyDecisions(REQS, [{
    requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_APPLICABLE,
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

test('a justified non-applicable requirement must record that outcome, not PASS', () => {
  const { problems } = validateDecision({
    requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.PASS,
    evidence: ['scan'], conditions: held,
  });
  assert.ok(problems.some((p) => p.includes('must carry status NOT_APPLICABLE')));
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
    requirementId: 'V99.9.9', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_APPLICABLE,
    evidence: ['scan'], conditions: held,
  }]);
  assert.ok(rejected.some((r) => r.problems.some((p) => p.includes('absent from the pinned standard'))));
});

test('duplicate decisions for one requirement are rejected', () => {
  const decision = { requirementId: 'V17.1.1', applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_APPLICABLE, evidence: ['scan'], conditions: held };
  const { rejected } = applyDecisions(REQS, [decision, { ...decision }]);
  assert.ok(rejected.some((r) => r.problems.some((p) => p.includes('duplicate'))));
});

test('anything undecided stays pending and unassessed', () => {
  const { records } = applyDecisions(REQS, []);
  assert.ok(records.every((r) => r.applicability === APPLICABILITY.PENDING && r.status === STATUS.NOT_ASSESSED));
  assert.equal(summariseDecisions(records).finalPass, false);
});

test('a justified NOT_APPLICABLE does not block, an unassessed APPLICABLE does', () => {
  assert.equal(blocksFinalPass({ applicability: APPLICABILITY.NOT_APPLICABLE, status: STATUS.NOT_APPLICABLE }), false);
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

test('a FAIL must name where the gap is and carry a re-checked condition', () => {
  // A FAIL held to a lower standard than a PASS would rust: once the gap is
  // fixed, nothing would notice, and the matrix would keep reporting it.
  const bare = validateDecision({
    requirementId: 'V5.2.3', applicability: APPLICABILITY.APPLICABLE, status: STATUS.FAIL,
    note: 'unbounded decompression',
  });
  assert.ok(bare.problems.some((p) => p.includes('FAIL requires evidence')));
  assert.ok(bare.problems.some((p) => p.includes('FAIL requires at least one re-verifiable condition')));

  const complete = validateDecision({
    requirementId: 'V5.2.3', applicability: APPLICABILITY.APPLICABLE, status: STATUS.FAIL,
    evidence: ['upload-route:apps/web/route.ts'], conditions: held, note: 'unbounded decompression',
  });
  assert.equal(complete.valid, true);
});

test('a FAIL whose gap was closed is rejected and returns to assessment', () => {
  const fixed = [{ condition: 'no decompression ceiling', holds: false, evidence: 'gap closed in apps/web/route.ts' }];
  const { records, rejected } = applyDecisions(REQS, [{
    requirementId: 'V6.2.1', applicability: APPLICABILITY.APPLICABLE, status: STATUS.FAIL,
    evidence: ['upload-route:apps/web/route.ts'], conditions: fixed, note: 'unbounded decompression',
  }]);

  assert.equal(rejected.length, 1);
  const record = records.find((r) => r.reqId === 'V6.2.1');
  assert.equal(record.applicability, APPLICABILITY.PENDING);
  assert.equal(record.status, STATUS.NOT_ASSESSED);
});

test('a FAIL blocks finalPass exactly as an unassessed requirement does', () => {
  assert.equal(blocksFinalPass({ applicability: APPLICABILITY.APPLICABLE, status: STATUS.FAIL }), true);
  assert.equal(blocksFinalPass({ applicability: APPLICABILITY.APPLICABLE, status: STATUS.PASS }), false);
});

test('applicability can be decided while the assessment is deliberately withheld', () => {
  // The honest middle ground: we know the requirement applies, and we have
  // looked, but what we saw does not justify claiming the requirement is met.
  // This must remain expressible, and it must still block finalPass - otherwise
  // the only way to record partial work would be to overstate or understate it.
  const decision = {
    requirementId: 'V6.2.1', applicability: APPLICABILITY.APPLICABLE, status: STATUS.NOT_ASSESSED,
    evidence: ['partial-evidence:apps/api/src/one-command.ts'], conditions: held,
    note: 'exemplary on one command; the rest were not examined',
  };
  assert.equal(validateDecision(decision).valid, true);

  const { records, rejected } = applyDecisions(REQS, [decision]);
  assert.equal(rejected.length, 0);
  const record = records.find((r) => r.reqId === 'V6.2.1');
  assert.equal(record.applicability, APPLICABILITY.APPLICABLE);
  assert.equal(record.status, STATUS.NOT_ASSESSED);
  assert.equal(blocksFinalPass(record), true);
});

test('an applicable-but-unassessed requirement is counted apart from an undecided one', () => {
  // These two are not the same state and must not collapse into one number:
  // "nobody has decided whether this applies" is a different debt from
  // "it applies and we have not finished assessing it".
  const summary = summariseDecisions([
    { applicability: APPLICABILITY.APPLICABLE, status: STATUS.NOT_ASSESSED },
    { applicability: APPLICABILITY.PENDING, status: STATUS.NOT_ASSESSED },
  ]);
  assert.equal(summary.finalPass, false);
  assert.ok(summary.blockers.includes('NOT_ASSESSED:1'));
  assert.ok(summary.blockers.includes('PENDING_APPLICABILITY_REVIEW:1'));
});

test('a requirement blocked on evidence we cannot gather is neither PASS nor FAIL', () => {
  // Some requirements can only be verified against a running system. Marking
  // them PASS would assert something unverified; marking them FAIL would assert
  // a defect nobody observed. Both are false statements. The decision records
  // that applicability is settled and the assessment is not, and the condition
  // still watches the fact that makes the evidence unreachable - so if the
  // production edge ever comes under version control, these are revisited.
  const blocked = {
    requirementId: 'V6.2.1', applicability: APPLICABILITY.APPLICABLE, status: STATUS.NOT_ASSESSED,
    evidence: ['hosting-authority:docs/ops/runbook.md'], conditions: held,
    note: 'the terminator configuration is held outside the repository',
  };
  assert.equal(validateDecision(blocked).valid, true);

  const { records, rejected } = applyDecisions(REQS, [blocked]);
  assert.equal(rejected.length, 0);
  const record = records.find((r) => r.reqId === 'V6.2.1');
  assert.equal(record.status, STATUS.NOT_ASSESSED);
  assert.notEqual(record.status, STATUS.PASS);
  assert.notEqual(record.status, STATUS.FAIL);
  assert.equal(blocksFinalPass(record), true);
});
