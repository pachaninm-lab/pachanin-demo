import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findPrototypeKeyWrites, reconcile } from './verify-prototype-key-writes.mjs';

/** Scan literal sources without touching the filesystem. */
function scan(sources) {
  const files = Object.keys(sources);
  return findPrototypeKeyWrites(files, (file) => sources[file]);
}

test('finds the numeric accumulator that loses __proto__', () => {
  const hits = scan({
    'a.ts': 'byCulture[culture] = (byCulture[culture] ?? 0) + (deal.volumeTons ?? 0);',
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].target, 'byCulture');
  assert.equal(hits[0].key, 'culture');
  assert.equal(hits[0].line, 1);
});

test('finds the || 0 spelling as well as ?? 0', () => {
  const hits = scan({ 'a.ts': 'acc[k] = (acc[k] || 0) + 1;' });
  assert.equal(hits.length, 1);
});

test('finds lazy container initialisation', () => {
  const hits = scan({
    'a.ts': '(groups[bucket] ||= []).push(sample);',
    'b.ts': '(acc[item.category] ??= []).push(item);',
  });
  assert.deepEqual(hits.map((hit) => hit.key), ['bucket', 'item.category']);
});

test('ignores a literal key, which data cannot supply', () => {
  assert.deepEqual(
    scan({
      'a.ts': "counts['UNKNOWN'] = (counts['UNKNOWN'] ?? 0) + 1;",
      'b.ts': 'counts[0] = (counts[0] ?? 0) + 1;',
    }),
    [],
  );
});

test('ignores a Map, which is the prescribed fix', () => {
  assert.deepEqual(
    scan({ 'a.ts': 'counts.set(culture, (counts.get(culture) ?? 0) + volume);' }),
    [],
  );
});

test('ignores the pattern inside a comment', () => {
  assert.deepEqual(
    scan({ 'a.ts': '// acc[key] = (acc[key] ?? 0) + 1 is the defect this gate finds\n' }),
    [],
  );
});

test('does not confuse two different accumulators on one line', () => {
  // The back-reference requires the read and the write to name the same target.
  assert.deepEqual(scan({ 'a.ts': 'left[k] = (right[k] ?? 0) + 1;' }), []);
});

test('skips test and spec files, which carry the pattern as a fixture', () => {
  const defect = 'acc[k] = (acc[k] ?? 0) + 1;';
  assert.deepEqual(
    scan({ 'a.test.mjs': defect, 'b.spec.ts': defect, 'c.test.tsx': defect }),
    [],
  );
  assert.equal(scan({ 'a.ts': defect }).length, 1, 'but still scans ordinary sources');
});

test('an unregistered site fails reconciliation', () => {
  const hits = scan({ 'a.ts': 'acc[k] = (acc[k] ?? 0) + 1;' });
  const { unregistered, stale } = reconcile(hits, []);
  assert.equal(unregistered.length, 1);
  assert.equal(stale.length, 0);
});

test('a registration matching file and key clears the site', () => {
  const hits = scan({ 'a.ts': 'acc[k] = (acc[k] ?? 0) + 1;' });
  const { unregistered, stale } = reconcile(hits, [{ file: 'a.ts', key: 'k' }]);
  assert.deepEqual(unregistered, []);
  assert.deepEqual(stale, []);
});

test('a registration for code that is gone is reported stale', () => {
  const { unregistered, stale } = reconcile([], [{ file: 'gone.ts', key: 'k' }]);
  assert.deepEqual(unregistered, []);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].file, 'gone.ts');
});

test('a registration for the right file but the wrong key does not clear the site', () => {
  const hits = scan({ 'a.ts': 'acc[k] = (acc[k] ?? 0) + 1;' });
  const { unregistered, stale } = reconcile(hits, [{ file: 'a.ts', key: 'other' }]);
  assert.equal(unregistered.length, 1, 'the real site is still unregistered');
  assert.equal(stale.length, 1, 'and the wrong registration is reported stale');
});

test('the shipped allowlist accounts for every site in the working tree', async () => {
  const { execFileSync } = await import('node:child_process');
  const { readFileSync } = await import('node:fs');
  const files = execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.mjs', '*.js', '*.cjs'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const allowlist = JSON.parse(
    readFileSync('docs/security/prototype-key-write-allowlist.json', 'utf8'),
  ).sites;
  const { unregistered, stale } = reconcile(findPrototypeKeyWrites(files), allowlist);
  assert.deepEqual(unregistered.map((hit) => `${hit.file}:${hit.line}`), []);
  assert.deepEqual(stale.map((entry) => entry.file), []);
  for (const entry of allowlist) {
    assert.ok(entry.measurement && entry.measurement.length > 80, `${entry.file} needs a real measurement`);
    assert.ok(entry.verdict, `${entry.file} needs a verdict`);
  }
});
