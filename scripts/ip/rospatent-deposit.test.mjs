import test from 'node:test';
import assert from 'node:assert/strict';

import { abridgeListing, computeFilingReadiness } from './rospatent-deposit.mjs';

const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

function provenance(gitHead, records) {
  return { gitHead, records };
}

test('missing provenance evidence is not readiness', () => {
  const result = computeFilingReadiness(null, ['a.ts'], HEAD);
  assert.equal(result.filingReadiness, 'UNKNOWN_PROVENANCE_EVIDENCE_MISSING');
});

test('evidence from a different commit blocks filing', () => {
  const result = computeFilingReadiness(
    provenance(OTHER, [{ path: 'a.ts', origin_class: 'FIRST_PARTY_PROPRIETARY' }]),
    ['a.ts'],
    HEAD,
  );
  assert.equal(result.filingReadiness, 'BLOCKED');
  assert.match(result.filingBlockers[0], /provenance evidence is for/);
});

// The load-bearing one. A deposit containing unassigned third-party authorship must
// never be described as ready to file.
test('a single file of unknown origin blocks filing', () => {
  const result = computeFilingReadiness(
    provenance(HEAD, [
      { path: 'a.ts', origin_class: 'FIRST_PARTY_PROPRIETARY' },
      { path: 'b.ts', origin_class: 'UNKNOWN' },
    ]),
    ['a.ts', 'b.ts'],
    HEAD,
  );
  assert.equal(result.filingReadiness, 'BLOCKED');
  assert.deepEqual(result.unresolved, ['b.ts']);
});

test('a deposited file absent from the evidence blocks filing', () => {
  const result = computeFilingReadiness(
    provenance(HEAD, [{ path: 'a.ts', origin_class: 'FIRST_PARTY_PROPRIETARY' }]),
    ['a.ts', 'undeclared.ts'],
    HEAD,
  );
  assert.equal(result.filingReadiness, 'BLOCKED');
  assert.deepEqual(result.unresolved, ['undeclared.ts']);
});

test('fully evidenced material reaches legal review, not filing', () => {
  const result = computeFilingReadiness(
    provenance(HEAD, [
      { path: 'a.ts', origin_class: 'FIRST_PARTY_PROPRIETARY' },
      { path: 'b.ts', origin_class: 'AI_ASSISTED_FIRST_PARTY' },
    ]),
    ['a.ts', 'b.ts'],
    HEAD,
  );
  assert.equal(result.filingReadiness, 'READY_FOR_LEGAL_REVIEW');
  assert.deepEqual(result.filingBlockers, []);
});

const notice = (omitted) => ['', `ПРОПУСК: ${omitted} строк`, ''];

test('a listing within the allowance is not abridged', () => {
  const body = Array.from({ length: 10 }, (_, index) => `line ${index}`);
  const result = abridgeListing(body, 20, notice);
  assert.equal(result.abridged, false);
  assert.deepEqual(result.lines, body);
});

test('an abridged listing never exceeds the page allowance', () => {
  const body = Array.from({ length: 5000 }, (_, index) => `line ${index}`);
  const result = abridgeListing(body, 100, notice);
  assert.equal(result.abridged, true);
  assert.equal(result.lines.length, 100);
});

test('an abridged listing keeps the real head and the real tail', () => {
  const body = Array.from({ length: 5000 }, (_, index) => `line ${index}`);
  const result = abridgeListing(body, 100, notice);
  assert.equal(result.lines[0], 'line 0');
  assert.equal(result.lines.at(-1), 'line 4999');
});

test('the omission is declared and counts the lines actually dropped', () => {
  const body = Array.from({ length: 5000 }, (_, index) => `line ${index}`);
  const result = abridgeListing(body, 100, notice);
  assert.equal(result.omittedLines, 5000 - (100 - 3));
  assert.ok(
    result.lines.some((line) => line === `ПРОПУСК: ${result.omittedLines} строк`),
    'the deposited listing must state how much was omitted',
  );
});

test('an allowance too small to carry the notice is an error, not a silent truncation', () => {
  const body = Array.from({ length: 10 }, (_, index) => `line ${index}`);
  assert.throws(() => abridgeListing(body, 4, notice), /too small to abridge/);
});
