import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MINIMUM_RATIONALE_LENGTH,
  parseAdjudications,
  tokens,
  verifyAdjudication,
} from './similarity-adjudication.mjs';

const BARREL = [
  "export * from './types';",
  "export * from './state-machine';",
  '',
].join('\n');

function entry(overrides = {}) {
  return {
    sourcePath: 'packages/domain-core/src/execution-simulation/index.ts',
    determination: 'RE_EXPORT_BARREL_NO_EXPRESSION',
    scope: 'ALL_MATCHES_FOR_SOURCE',
    reviewedAt: '2026-09-20',
    rationale: 'x'.repeat(MINIMUM_RATIONALE_LENGTH),
    ...overrides,
  };
}
const NOW = Date.parse('2026-09-20T12:00:00Z');

test('a re-export barrel normalizes to the idiom and its finding resolves', () => {
  assert.deepEqual([...new Set(tokens(BARREL))].sort(), ['*', ';', '<STRING>', 'export', 'from']);
  const result = verifyAdjudication(entry(), BARREL, 'WINNOWING_SIGNATURE');
  assert.equal(result.resolved, true);
  assert.equal(result.decision, 'RESOLVED_RE_EXPORT_BARREL_NO_EXPRESSION');
});

// The gate that matters: an adjudication written for a file that is NOT a barrel
// must not resolve anything. This is what stops a real copied implementation from
// being silenced by attaching an idiom determination to it.
test('the determination does not resolve a file that carries real logic', () => {
  const copied = [
    "export * from './types';",
    'export function settle(amountKopecks, rate) {',
    '  return Math.trunc(amountKopecks * rate);',
    '}',
    '',
  ].join('\n');
  const result = verifyAdjudication(entry(), copied, 'WINNOWING_SIGNATURE');
  assert.equal(result.resolved, false);
  assert.equal(result.decision, 'ADJUDICATION_NO_LONGER_HOLDS');
  assert.match(result.evidence, /non-idiom tokens/u);
});

test('one added declaration is enough to withdraw the determination', () => {
  const almost = `${BARREL}export const SIMULATION_SCHEMA_VERSION = 3;\n`;
  assert.equal(verifyAdjudication(entry(), almost, 'WINNOWING_SIGNATURE').resolved, false);
});

test('an exact byte-identical match is never adjudicable, even for a pure barrel', () => {
  const result = verifyAdjudication(entry(), BARREL, 'EXACT_SHA256');
  assert.equal(result.resolved, false);
  assert.equal(result.decision, 'ADJUDICATION_REFUSED_FOR_EXACT_MATCH');
});

test('an empty file is not covered by the determination', () => {
  assert.equal(verifyAdjudication(entry(), '', 'WINNOWING_SIGNATURE').resolved, false);
});

test('an unknown determination is never verifiable', () => {
  const result = verifyAdjudication(entry({ determination: 'TRUST_ME' }), BARREL, 'WINNOWING_SIGNATURE');
  assert.equal(result.resolved, false);
  assert.equal(result.decision, 'ADJUDICATION_NOT_VERIFIABLE');
});

test('no adjudication means no result at all', () => {
  assert.equal(verifyAdjudication(null, BARREL, 'WINNOWING_SIGNATURE'), null);
});

test('each register defect drops the entry rather than admitting it', () => {
  const cases = [
    ['UNSUPPORTED_DETERMINATION', entry({ determination: 'TRUST_ME' })],
    ['UNSUPPORTED_SCOPE', entry({ scope: 'EVERYTHING_FOREVER' })],
    ['RATIONALE_TOO_SHORT', entry({ rationale: 'too short' })],
    ['INVALID_REVIEWED_AT', entry({ reviewedAt: '2099-01-01' })],
    ['INVALID_REVIEWED_AT', entry({ reviewedAt: '2026-02-30' })],
    ['INVALID_REVIEWED_AT', entry({ reviewedAt: 'yesterday' })],
    ['MISSING_SOURCE_PATH', entry({ sourcePath: '   ' })],
  ];
  for (const [expected, candidate] of cases) {
    const { adjudications, defects } = parseAdjudications(
      { schemaVersion: 1, adjudications: [candidate] }, NOW,
    );
    assert.equal(adjudications.size, 0, `${expected} was admitted`);
    assert.equal(defects.length, 1);
    assert.match(defects[0], new RegExp(`^${expected}`, 'u'));
  }
});

test('a duplicate source path is recorded as a defect and does not override the first entry', () => {
  const { adjudications, defects } = parseAdjudications({
    schemaVersion: 1,
    adjudications: [entry({ rationale: `first ${'x'.repeat(MINIMUM_RATIONALE_LENGTH)}` }), entry({ rationale: `second ${'x'.repeat(MINIMUM_RATIONALE_LENGTH)}` })],
  }, NOW);
  assert.equal(adjudications.size, 1);
  assert.match(adjudications.values().next().value.rationale, /^first/u);
  assert.deepEqual(defects, ['DUPLICATE:packages/domain-core/src/execution-simulation/index.ts']);
});

test('a register with the wrong shape admits nothing', () => {
  for (const document of [null, 'text', { schemaVersion: 2, adjudications: [entry()] }]) {
    const { adjudications, defects } = parseAdjudications(document, NOW);
    assert.equal(adjudications.size, 0);
    assert.equal(defects.length, 1);
  }
});

test('the committed register parses with no defects and only supported determinations', async () => {
  const { readFileSync } = await import('node:fs');
  const document = JSON.parse(readFileSync('docs/ip/similarity-adjudications.json', 'utf8'));
  const { adjudications, defects } = parseAdjudications(document);
  assert.deepEqual(defects, []);
  assert(adjudications.size > 0);
  for (const [sourcePath, record] of adjudications) {
    const result = verifyAdjudication(record, readFileSync(sourcePath, 'utf8'), 'WINNOWING_SIGNATURE');
    assert.equal(result.resolved, true, `${sourcePath} no longer satisfies its determination`);
  }
});
