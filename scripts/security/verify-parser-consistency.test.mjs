import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

import { adhocUrlTest, findSecondParsers, legacyUrlParse, selectSources } from './verify-parser-consistency.mjs';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');
const parse = (source) => ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const hits = (source) => findSecondParsers(parse(source));

test('the idioms that stand in for a URL parser are caught', () => {
  assert.equal(hits("if (href.includes('..')) reject();")[0].detail, "includes('..')");
  assert.equal(hits("if (href.includes('://')) reject();")[0].detail, "includes('://')");
  assert.equal(hits("if (href.startsWith('https://')) accept();")[0].detail, "startsWith('https://')");
  assert.equal(hits("if (href.startsWith('//')) reject();")[0].detail, "startsWith('//')");
});

test('the original boundary check would have been reported', () => {
  // Verbatim shape of what restricted-public-qwen tested before this change.
  const found = hits(`
    function verify(href) {
      if (!/^\\/platform-v7(?:\\/|$)/u.test(href) || href.includes('..') || href.includes('://')) {
        throw new Error('outside');
      }
    }
  `);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((f) => f.detail).sort(), ["includes('..')", "includes('://')"]);
});

test('an ordinary string test is not a URL parser', () => {
  assert.deepEqual(hits("if (name.includes('@')) reject();"), []);
  assert.deepEqual(hits("if (list.includes(value)) accept();"), []);
  assert.deepEqual(hits("if (label.startsWith('PC-')) accept();"), []);
});

test('the legacy node:url parser is caught, its non-parsers are not', () => {
  assert.equal(hits("import { parse } from 'node:url';\nconst u = parse(raw);")[0].detail, 'parse()');
  assert.equal(hits("import * as url from 'url';\nconst u = url.parse(raw);")[0].detail, 'url.parse()');
  assert.deepEqual(hits("import { domainToASCII } from 'node:url';\nconst d = domainToASCII(host);"), []);
  assert.deepEqual(hits("import { fileURLToPath } from 'node:url';\nconst p = fileURLToPath(u);"), []);
});

test('a local function named parse is not node:url', () => {
  assert.deepEqual(hits('function parse(x) { return x; }\nconst u = parse(raw);'), []);
});

test('the WHATWG parser is the one this rule points at', () => {
  assert.deepEqual(hits("const u = new URL(raw, base);"), []);
});

test('adhocUrlTest and legacyUrlParse answer null for unrelated calls', () => {
  const sf = parse('const x = doSomething();');
  let call = null;
  const visit = (node) => { if (!call && ts.isCallExpression(node)) call = node; ts.forEachChild(node, visit); };
  visit(sf);
  assert.equal(adhocUrlTest(call), null);
  assert.equal(legacyUrlParse(call, new Set(), new Set()), null);
});

test('source selection skips symlinks, tests and anything outside the scanned roots', () => {
  const listing = [
    '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tapps/api/src/common/security/public-source-path.ts',
    '120000 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tapps/web/apps/web/lib',
    '100644 cccccccccccccccccccccccccccccccccccccccc 0\tapps/api/src/common/security/public-source-path.spec.ts',
    '100644 dddddddddddddddddddddddddddddddddddddddd 0\tapps/web/tests/unit/x.test.ts',
    '100644 eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee 0\tscripts/security/x.ts',
  ].join('\n');
  assert.deepEqual(selectSources(listing), ['apps/api/src/common/security/public-source-path.ts']);
});

test('the repository itself passes', () => {
  const result = spawnSync(process.execPath, ['scripts/security/verify-parser-consistency.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /second parsers for a URL\s+0/u);
});
