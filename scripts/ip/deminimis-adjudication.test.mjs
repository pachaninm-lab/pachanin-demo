import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  expressionIn,
  parseDeminimisRegister,
  verifyDeminimis,
} from './deminimis-adjudication.mjs';

const CI_COMMENT = '# Exact-head CI trigger: identity RLS acceptance.';

function adjudication(lines) {
  return {
    path: 'scripts/example.sh',
    identityEmail: 'root@example.local',
    determination: 'NON_EXPRESSIVE_CI_TRIGGER_RESIDUE',
    rationale: 'A no-op comment appended solely to change the commit hash.',
    lines,
  };
}

test('a blank line carries no expression', () => {
  assert.equal(expressionIn(''), null);
  assert.equal(expressionIn('   \t '), null);
});

test('a short no-op CI comment carries no expression', () => {
  assert.equal(expressionIn(CI_COMMENT), null);
});

test('a line of code is never de minimis', () => {
  assert.match(expressionIn('echo "identity isolation gate: PASS"'), /not blank and not a comment/);
  assert.match(expressionIn('RLS_URL=$1'), /not blank and not a comment/);
});

test('a comment carrying executable content is never de minimis', () => {
  assert.match(expressionIn('# psql "$URL" -f checks.sql'), /code-bearing/);
  assert.match(expressionIn('// const threshold = 0.65;'), /code-bearing/);
});

test('a comment long enough to express something is never de minimis', () => {
  const explanation =
    '# the check does SET ROLE itself, which exercises the same enforcement path '
    + 'because the role is NOBYPASSRLS and both tables are FORCE ROW LEVEL SECURITY';
  const reason = expressionIn(explanation);
  assert.ok(reason, 'a substantive design comment must not be adjudicable');
  assert.match(reason, /ceiling/);
});

test('a comment just over the word ceiling is refused', () => {
  const eleven = '# one two three four five six seven eight nine ten eleven';
  assert.match(expressionIn(eleven), /11 words/);
});

// The load-bearing test. If the quoted content and the real content diverge,
// the adjudication must not resolve anything.
test('an adjudication does not excuse a line whose content has changed', () => {
  const result = verifyDeminimis(adjudication([{ line: 826, content: CI_COMMENT }]), [
    { line: 826, content: '# Exact-head CI trigger: now with a real behavioural note about RLS' },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /has changed since it was adjudicated/);
});

test('an adjudication does not excuse surviving lines it failed to quote', () => {
  const result = verifyDeminimis(adjudication([{ line: 826, content: CI_COMMENT }]), [
    { line: 826, content: CI_COMMENT },
    { line: 400, content: 'psql "$RLS_INTEGRATION_ADMIN_URL" -v ON_ERROR_STOP=1' },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /line 400 survives but is not quoted/);
});

test('an adjudication whose quoted lines no longer survive is stale, not passing', () => {
  const result = verifyDeminimis(adjudication([{ line: 826, content: CI_COMMENT }]), []);
  assert.equal(result.ok, false);
  assert.match(result.reason, /stale/);
});

test('a real de minimis residue verifies', () => {
  const result = verifyDeminimis(
    adjudication([
      { line: 825, content: '' },
      { line: 826, content: CI_COMMENT },
    ]),
    [
      { line: 825, content: '' },
      { line: 826, content: CI_COMMENT },
    ],
  );
  assert.equal(result.ok, true);
});

test('the register rejects a determination it does not support', () => {
  const { defects } = parseDeminimisRegister(
    JSON.stringify({
      schemaVersion: 1,
      adjudications: [{ ...adjudication([{ line: 1, content: '' }]), determination: 'OWNER_SAYS_SO' }],
    }),
  );
  assert.ok(defects.some((defect) => /unsupported determination/.test(defect)));
});

test('the register rejects an entry that quotes no lines', () => {
  const { defects } = parseDeminimisRegister(
    JSON.stringify({ schemaVersion: 1, adjudications: [adjudication([])] }),
  );
  assert.ok(defects.some((defect) => /quotes no lines/.test(defect)));
});

test('the register rejects an entry with no substantive rationale', () => {
  const entry = { ...adjudication([{ line: 1, content: '' }]), rationale: 'de minimis' };
  const { defects } = parseDeminimisRegister(
    JSON.stringify({ schemaVersion: 1, adjudications: [entry] }),
  );
  assert.ok(defects.some((defect) => /no substantive rationale/.test(defect)));
});

test('the register rejects an unsupported schema version', () => {
  const { defects } = parseDeminimisRegister(JSON.stringify({ schemaVersion: 2, adjudications: [] }));
  assert.ok(defects.some((defect) => /unsupported schemaVersion/.test(defect)));
});

// A register that parses but excuses nothing real would be a silent no-op.
test('the committed register parses cleanly and is not vacuous', () => {
  const raw = readFileSync(new URL('../../docs/ip/deminimis-line-adjudications.json', import.meta.url), 'utf8');
  const { adjudications, defects } = parseDeminimisRegister(raw);
  assert.deepEqual(defects, [], `committed register has defects: ${defects.join('; ')}`);
  assert.ok(adjudications.length > 0, 'committed register adjudicates nothing');
  for (const entry of adjudications) {
    for (const line of entry.lines) {
      assert.equal(
        expressionIn(line.content),
        null,
        `committed register quotes an expressive line in ${entry.path}:${line.line}`,
      );
    }
  }
});
