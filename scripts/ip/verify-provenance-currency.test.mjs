import { strict as assert } from 'node:assert';
import test from 'node:test';

import { SELF_REFERENTIAL, compareClaims, csvDrift, identityTableSum, jsonDrift, readNumber, registerClaims } from './verify-provenance-currency.mjs';

const REGISTER = `# Chain of Title Register

Source SHA: \`0e5fbc7997221d02e2ac57ee7f55295e2c56fdf4\`
History analysed: 23 235 commits, full (non-shallow) history

21 distinct identities. Commit counts sum to 23 235, matching the analysed
history exactly.

Current state: **605 of 605 CROWN_JEWEL files have unproven first-party
origin**, and every identity that touched them is \`UNRESOLVED\`.
`;

/**
 * The register writes its numbers for a reader, with thin spaces, and the builder
 * writes its numbers for a machine. A comparison that does not know they are the
 * same number reports drift on a register that is perfectly current, and then
 * nobody believes the gate.
 */
test('numbers written for a reader parse to the same value as numbers written for a machine', () => {
  assert.equal(readNumber('23 235'), 23235);
  assert.equal(readNumber('23 235'), 23235);
  assert.equal(readNumber('23 235'), 23235);
  assert.equal(readNumber('23235'), 23235);
  assert.equal(readNumber('not a number'), null);
});

test('the register\'s own claims are read out of its prose', () => {
  const claims = registerClaims(REGISTER);
  assert.equal(claims.sourceSha, '0e5fbc7997221d02e2ac57ee7f55295e2c56fdf4');
  assert.equal(claims.commits, 23235);
  assert.equal(claims.crownJewels, 605);
  assert.equal(claims.crownJewelTotal, 605);
  assert.equal(claims.identities, 21);
});

const SUMMARY = { crownJewelFiles: 636, crownJewelUnknownOrigin: 636, distinctContributors: 21 };

/**
 * The drift this gate was written for, reproduced from the numbers that were
 * actually on disk: a register describing a tree that had moved on by 654 files.
 */
test('a register describing a different tree fails on every number that moved', () => {
  const problems = compareClaims(registerClaims(REGISTER), SUMMARY, true, { sum: 23235, rows: 21 });
  assert.equal(problems.length, 2, problems.join(' | '));
  assert.ok(problems.some((problem) => problem.includes('636')), 'the CROWN_JEWEL counts moved and must be reported');
  assert.ok(!problems.some((problem) => problem.includes('identities')), 'the identity count did not move and must not be reported');
  assert.ok(!problems.some((problem) => problem.includes('Source SHA')), 'an ancestor Source SHA is not a failure');
});

/**
 * A record committed into the repository it describes is generated against the
 * parent commit, so its Source SHA can never equal HEAD. Demanding equality makes
 * the gate unsatisfiable, and a gate that can never pass gets disabled. What must
 * hold is that the SHA is on this history at all.
 */
test('a Source SHA that is an ancestor passes, and one that is not fails', () => {
  const current = REGISTER.replaceAll('605 of 605', '636 of 636');
  assert.deepEqual(compareClaims(registerClaims(current), SUMMARY, true, { sum: 23235, rows: 21 }), []);
  const orphaned = compareClaims(registerClaims(current), SUMMARY, false, { sum: 23235, rows: 21 });
  assert.equal(orphaned.length, 1);
  assert.match(orphaned[0], /not an ancestor of HEAD/u);
});

/**
 * The builder counts `rev-list --all`, so creating a branch changes its commit
 * total without changing one fact about the history. The page's own total is
 * checked against the page's own table instead, which holds whatever refs exist.
 */
test('the stated commit total is checked against the identity table, not the builder', () => {
  const current = REGISTER.replaceAll('605 of 605', '636 of 636');
  const problems = compareClaims(registerClaims(current), SUMMARY, true, { sum: 99999, rows: 21 });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /identity table sums to 99999/u);
});

test('the identity table sum is read out of the register\'s own tables', () => {
  const table = ['# R', '', '| Identity | Commits | Rights status |', '|---|---:|---|',
    '| `a#1` | 24 429 | UNRESOLVED |', '| `b#2` | 13 | UNRESOLVED |', '',
    '| # | Document | Files | CROWN_JEWEL |', '| 1 | **Something** | 293 | 26 |'].join('\n');
  assert.deepEqual(identityTableSum(table), { sum: 24442, rows: 2 }, 'only backticked identity rows count');
});

/**
 * "The file differs" is not a finding anybody can act on. A row-level account is.
 */
test('CSV drift is reported per row, split into added, removed and changed', () => {
  const before = 'path,who\na.ts,me\nb.ts,me\nc.ts,me\n';
  const after = 'path,who\na.ts,me\nb.ts,someone else\nd.ts,me\n';
  const drift = csvDrift(before, after);
  assert.deepEqual(drift.added, ['d.ts']);
  assert.deepEqual(drift.removed, ['c.ts']);
  assert.deepEqual(drift.changed, ['b.ts']);
});

test('an identical CSV drifts by nothing', () => {
  const text = 'path,who\na.ts,me\nb.ts,me\n';
  assert.deepEqual(csvDrift(text, text), { added: [], removed: [], changed: [] });
});

/**
 * The committed record, checked as data rather than as a file that exists.
 *
 * 21 files - four of them CROWN_JEWEL in the auth module - had no recorded origin
 * at all, because they entered the mainline through squash merges and `git log`
 * does not diff a merge unless told to. A file with no identity attached cannot be
 * closed by any signature, so the owner's four documents were not sufficient and
 * nothing said so.
 */
test('every file in the committed record has an identity attached', async () => {
  const { readFileSync: read } = await import('node:fs');
  const rows = read('docs/ip/FILE_PROVENANCE.csv', 'utf8').trim().split('\n');
  const header = rows[0].split(',');
  const contributor = header.indexOf('original_contributor');
  const source = header.indexOf('origin_source');
  assert.ok(contributor > 0 && source > 0);
  const unknown = rows.slice(1).filter((row) => row.split(',')[contributor] === 'UNKNOWN#b23a6a8439c0dde5');
  assert.deepEqual(unknown.map((row) => row.split(',')[0]), [], 'no file may be left without an origin');
});

test('a file attributed through a merge says so, and names the merge', async () => {
  const { readFileSync: read } = await import('node:fs');
  const rows = read('docs/ip/FILE_PROVENANCE.csv', 'utf8').trim().split('\n');
  const source = rows[0].split(',').indexOf('origin_source');
  const merged = rows.slice(1).map((row) => row.split(',')[source]).filter((value) => value.includes('MERGE_INTRODUCED'));
  assert.ok(merged.length > 0, 'the merge-aware lookup must still be reaching these files');
  for (const value of merged) {
    assert.match(value, /MERGE_INTRODUCED=[0-9a-f]{40}$/u, 'a merge attribution must name the merge commit');
  }
});


/**
 * FILE_PROVENANCE.csv carries a blob hash for every tracked file, itself included,
 * so demanding it match a fresh build would demand it contain its own hash. Not
 * strict - unsatisfiable.
 */
test('the record\'s own rows are excluded from the comparison, and named', () => {
  assert.ok(SELF_REFERENTIAL.has('docs/ip/FILE_PROVENANCE.csv'));
  const before = 'path,blob\ndocs/ip/FILE_PROVENANCE.csv,aaa\napp/a.ts,one\n';
  const after = 'path,blob\ndocs/ip/FILE_PROVENANCE.csv,bbb\napp/a.ts,one\n';
  assert.deepEqual(csvDrift(before, after), { added: [], removed: [], changed: [] });
});

test('a real row still drifts while the self-referential one is ignored', () => {
  const before = 'path,blob\ndocs/ip/CONTRIBUTORS.csv,aaa\napp/a.ts,one\n';
  const after = 'path,blob\ndocs/ip/CONTRIBUTORS.csv,bbb\napp/a.ts,two\n';
  assert.deepEqual(csvDrift(before, after).changed, ['app/a.ts']);
});

test('the JSON twin excludes the same records', () => {
  const before = JSON.stringify({ records: [{ path: 'docs/ip/FILE_PROVENANCE.csv', blob: 'a' }, { path: 'app/a.ts', blob: 'one' }] });
  const after = JSON.stringify({ records: [{ path: 'docs/ip/FILE_PROVENANCE.csv', blob: 'b' }, { path: 'app/a.ts', blob: 'one' }] });
  assert.deepEqual(jsonDrift(before, after), []);
  const changed = JSON.stringify({ records: [{ path: 'docs/ip/FILE_PROVENANCE.csv', blob: 'b' }, { path: 'app/a.ts', blob: 'two' }] });
  assert.deepEqual(jsonDrift(before, changed), ['app/a.ts']);
});
