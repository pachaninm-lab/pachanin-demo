import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  ASVS_SOURCE_COMMIT,
  ASVS_VERSION,
  EXPECTED_REQUIREMENTS,
  buildMatrixCsv,
  buildSummary,
  csvCell,
  validateStandard,
} from './build-asvs-matrix.mjs';

function syntheticStandard(count = EXPECTED_REQUIREMENTS) {
  return {
    requirements: Array.from({ length: count }, (_, index) => ({
      chapter_id: 'V1',
      chapter_name: 'Synthetic',
      section_id: 'V1.1',
      section_name: 'Synthetic section',
      req_id: `V1.1.${index + 1}`,
      req_description: `Synthetic requirement prose ${index + 1}`,
      L: String((index % 3) + 1),
    })),
  };
}

test('validates and deterministically inventories the complete requirement set without prose', () => {
  const source = syntheticStandard();
  const first = validateStandard(source);
  const second = validateStandard(structuredClone(source));
  const firstCsv = buildMatrixCsv(first);
  const secondCsv = buildMatrixCsv(second);

  assert.equal(first.length, EXPECTED_REQUIREMENTS);
  assert.equal(firstCsv, secondCsv);
  assert.match(firstCsv, new RegExp(`"${ASVS_VERSION}"`));
  assert.match(firstCsv, new RegExp(`"${ASVS_SOURCE_COMMIT}"`));
  assert.doesNotMatch(firstCsv, /Synthetic requirement prose/u);
  assert.equal(firstCsv.trimEnd().split('\n').length, EXPECTED_REQUIREMENTS + 1);
});

test('rejects a duplicate requirement id', () => {
  const source = syntheticStandard();
  source.requirements[1].req_id = source.requirements[0].req_id;
  assert.throws(() => validateStandard(source), /duplicate requirement id/u);
});

test('rejects a malformed requirement id', () => {
  const source = syntheticStandard();
  source.requirements[0].req_id = '1.1.1';
  assert.throws(() => validateStandard(source), /requirement id invalid/u);
});

test('rejects an invalid level', () => {
  const source = syntheticStandard();
  source.requirements[0].L = '4';
  assert.throws(() => validateStandard(source), /requirement level invalid/u);
});

test('rejects an incomplete requirement count', () => {
  assert.throws(() => validateStandard(syntheticStandard(EXPECTED_REQUIREMENTS - 1)), /requirement count mismatch/u);
});

test('rejects malformed upstream schema and missing descriptions', () => {
  assert.throws(() => validateStandard({ Requirements: [] }), /top-level requirements array/u);
  const source = syntheticStandard();
  source.requirements[0].req_description = '';
  assert.throws(() => validateStandard(source), /description missing/u);
});

test('escapes CSV cells without leaking structure', () => {
  assert.equal(csvCell('a"b,c'), '"a""b,c"');
});

test('summary is deterministic, source-digested, and cannot claim a final pass', () => {
  const requirements = validateStandard(syntheticStandard());
  const matrix = buildMatrixCsv(requirements);
  const sourceBytes = Buffer.from('{"public":"standard"}', 'utf8');
  const summary = buildSummary(requirements, matrix, {
    sourceBytes,
    repositorySourceSha: 'a'.repeat(40),
  });

  assert.equal(summary.requirements, EXPECTED_REQUIREMENTS);
  assert.equal(summary.statusCounts.NOT_ASSESSED, EXPECTED_REQUIREMENTS);
  assert.equal(summary.proprietarySourceUploaded, false);
  assert.equal(summary.outputContainsRequirementDescriptions, false);
  assert.equal(summary.finalPass, false);
  assert.deepEqual(summary.blockers, [
    `NOT_ASSESSED:${EXPECTED_REQUIREMENTS}`,
    `PENDING_APPLICABILITY_REVIEW:${EXPECTED_REQUIREMENTS}`,
  ]);
  assert.equal(summary.matrixSha256, createHash('sha256').update(matrix, 'utf8').digest('hex'));
  assert.equal(summary.sourceSha256, createHash('sha256').update(sourceBytes).digest('hex'));
});
