import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { assertedFields, producibleNames, readTemplate, scanSource } from './verify-raw-sql-shape.mjs';

const call = (type, sql) => `const rows = await client.$queryRaw<${type}>(Prisma.sql\`${sql}\`);`;

test('finds an asserted field the query does not return', () => {
  const { findings } = scanSource(
    'a.ts',
    call('Array<{ credit: bigint }>', 'SELECT sum(x) AS credit_total FROM t'),
  );
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].missing, ['credit']);
});

test('accepts a quoted alias', () => {
  const { findings } = scanSource(
    'a.ts',
    call('Array<{ circuitState: string }>', 'SELECT circuit_state AS "circuitState" FROM t'),
  );
  assert.deepEqual(findings, []);
});

test('accepts a bare alias and a bare column', () => {
  const { findings } = scanSource(
    'a.ts',
    call('Array<{ id: string; source: string }>', 'SELECT gen() AS id, source FROM t'),
  );
  assert.deepEqual(findings, []);
});

test('reads a query whose interpolation contains a nested template', () => {
  // The naive non-greedy capture stops at the first nested backtick and cuts
  // off the alias behind it. Measured on this repository: that mistake
  // reported two present aliases as missing.
  const sql = 'SELECT f(${`attestation:${id}:${v}`}) AS "authorizationVersion"';
  const { findings } = scanSource('a.ts', call('Array<{ authorizationVersion: bigint }>', sql));
  assert.deepEqual(findings, []);

  const text = call('Array<{ authorizationVersion: bigint }>', sql);
  const tick = text.indexOf('`', text.indexOf('Prisma.sql'));
  const read = readTemplate(text, tick);
  assert.ok(read.sql.includes('authorizationVersion'), 'the tail after the nested template survives');
});

test('counts a named result type as unverified rather than passing it', () => {
  const result = scanSource('a.ts', call('SourceHealthSnapshot[]', 'SELECT source FROM t'));
  assert.equal(result.namedType, 1);
  assert.equal(result.inline, 0);
  assert.deepEqual(result.findings, []);
});

test('skips SELECT *, whose shape is not knowable statically', () => {
  const result = scanSource('a.ts', call('Array<{ anything: string }>', 'SELECT * FROM t'));
  assert.equal(result.selectStar, 1);
  assert.deepEqual(result.findings, []);
});

test('assertedFields reads names from an inline object and nothing from a named type', () => {
  assert.deepEqual(assertedFields('Array<{ a: string; b?: number }>'), ['a', 'b']);
  assert.deepEqual(assertedFields('SourceHealthSnapshot[]'), []);
});

test('producibleNames collects quoted aliases, bare aliases and bare identifiers', () => {
  const names = producibleNames('SELECT a AS "x", b AS y, "z" FROM t WHERE w = 1');
  for (const expected of ['x', 'y', 'z', 'a', 'b', 'w', 't']) {
    assert.ok(names.has(expected), `expected ${expected}`);
  }
});

test('a pathological type argument is scanned in linear time, not exponential', () => {
  // CodeQL js/redos on the first version: `<([^>]*(?:<[^>]*>[^>]*)*)>`.
  // Measured on that regex — `$queryRaw<` plus 30 repetitions of `<<>`, a
  // string of 101 bytes, took 3 seconds, and every two further repetitions
  // roughly quadrupled it. Any scanned source file could have hung CI.
  const evil = `$queryRaw<${'<<>'.repeat(400)}!`;
  const started = Date.now();
  scanSource('evil.ts', evil);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 1000, `scan took ${elapsed}ms on a ${evil.length}-byte pathological input`);
});

test('reads a doubly nested generic the old single-level pattern could not balance', () => {
  // Array<Record<string, unknown>> occurs 5 times in this repository and was
  // silently skipped by the previous pattern - not reported, just not seen.
  const result = scanSource(
    'a.ts',
    call('Array<Record<string, unknown>>', 'SELECT source FROM t'),
  );
  assert.equal(result.namedType, 1, 'the call is seen and classified, not skipped');
});

test('the working tree has no raw query asserting an absent field', () => {
  const files = execFileSync('git', ['ls-files', 'apps/api/src/**/*.ts', 'packages/**/*.ts'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((file) => !/\.(?:test|spec)\.[a-z]+$/u.test(file));
  const findings = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('$queryRaw<')) continue;
    findings.push(...scanSource(file, text).findings);
  }
  assert.deepEqual(findings.map((f) => `${f.file}:${f.line}`), []);
});
