import { strict as assert } from 'node:assert';
import test from 'node:test';

import { compareClaims, csvDrift, readNumber, registerClaims } from './verify-provenance-currency.mjs';

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

/**
 * The drift this gate was written for, reproduced from the numbers that were
 * actually on disk: a register generated at one commit, describing a tree that
 * had moved on by 2976 commits and 654 files.
 */
test('a register describing a different tree fails on every number that moved', () => {
  const problems = compareClaims(
    registerClaims(REGISTER),
    { repositoryHistoryCommits: 26211, crownJewelFiles: 636, crownJewelUnknownOrigin: 636, distinctContributors: 21 },
    'fd895e061f0e27661a6e67f436f03108e35e5dd9',
  );
  assert.equal(problems.length, 4, problems.join(' | '));
  assert.ok(problems.some((problem) => problem.includes('Source SHA')));
  assert.ok(problems.some((problem) => problem.includes('26211')));
  assert.ok(problems.some((problem) => problem.includes('636 CROWN_JEWEL') || problem.includes('the builder counts 636')));
  assert.ok(!problems.some((problem) => problem.includes('identities')), 'the identity count did not move and must not be reported');
});

test('a current register reports nothing', () => {
  const current = REGISTER
    .replace('0e5fbc7997221d02e2ac57ee7f55295e2c56fdf4', 'a'.repeat(40))
    .replaceAll('23 235', '26 211')
    .replaceAll('605 of 605', '636 of 636');
  assert.deepEqual(
    compareClaims(registerClaims(current), { repositoryHistoryCommits: 26211, crownJewelFiles: 636, crownJewelUnknownOrigin: 636, distinctContributors: 21 }, 'a'.repeat(40)),
    [],
  );
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
