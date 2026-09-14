import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

import { EXCEPTIONS_PATH, NON_SECURITY_MARKER, exceptedPaths, selectSources, weakFallbackFunctions } from './verify-browser-security-capabilities.mjs';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');
const hits = (src) => weakFallbackFunctions(ts.createSourceFile('f.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));

test('the nullish fallback shape is caught', () => {
  const found = hits('function make() { const id = globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random()}`; return id; }');
  assert.equal(found.length, 1);
});

test('the logical-or fallback shape is caught', () => {
  assert.equal(hits('function make() { return globalThis.crypto?.randomUUID?.() || `r-${Date.now()}`; }').length, 1);
});

test('the conditional fallback shape is caught', () => {
  assert.equal(hits("function make() { return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `r-${Math.random()}`; }").length, 1);
});

test('the early-return fallback shape is caught', () => {
  assert.equal(hits("function id(p) { if (typeof crypto.randomUUID === 'function') return crypto.randomUUID(); return `${p}-${Date.now()}`; }").length, 1);
});

test('a long function that merely mentions both is not a fallback', () => {
  // The first version of this guard reported a server route on exactly this
  // shape: randomUUID() in one place, Date.now() somewhere else entirely.
  const found = hits(`
    async function POST(request) {
      const correlationId = request.headers.get('x-correlation-id') || randomUUID();
      const startedAt = Date.now();
      doWork(correlationId, startedAt);
      return correlationId;
    }
  `);
  assert.deepEqual(found, []);
});

test('refusing instead of substituting is not a finding', () => {
  assert.deepEqual(hits('function make() { return secureRandomId("reg"); }'), []);
});

test('a marked site is a reviewed claim, not a finding', () => {
  const marked = `function id(p) {
    // ${NON_SECURITY_MARKER}. React keys only.
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return \`\${p}-\${Date.now()}\`;
  }`;
  assert.deepEqual(hits(marked), []);
});

test('the marker does not excuse a neighbouring function', () => {
  const src = `function safe(p) {
    // ${NON_SECURITY_MARKER}. React keys only.
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return \`\${p}-\${Date.now()}\`;
  }
  function unsafe() { return globalThis.crypto?.randomUUID?.() ?? \`c-\${Math.random()}\`; }`;
  assert.equal(hits(src).length, 1);
});

test('source selection skips symlinks, tests, api routes and the module itself', () => {
  const listing = [
    '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tapps/web/components/gekta/GektaChatWorkspace.tsx',
    '120000 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tapps/web/apps/web/components',
    '100644 cccccccccccccccccccccccccccccccccccccccc 0\tapps/web/tests/unit/x.spec.tsx',
    '100644 dddddddddddddddddddddddddddddddddddddddd 0\tapps/web/app/api/auth/me/route.ts',
    '100644 eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee 0\tapps/web/lib/browser-security-capabilities.ts',
  ].join('\n');
  assert.deepEqual(selectSources(listing), ['apps/web/components/gekta/GektaChatWorkspace.tsx']);
});

test('an exception needs a reason, not a label', () => {
  const { accepted, rejected } = exceptedPaths({
    exceptions: [
      { path: 'a.tsx', reason: 'too short' },
      { path: 'b.tsx' },
      { reason: 'x'.repeat(200) },
      { path: 'c.tsx', reason: 'This value is a React key only, never travels to the server as an idempotency or command identifier, and nothing authorizes on it.' },
    ],
  });
  assert.deepEqual([...accepted], ['c.tsx']);
  assert.equal(rejected.length, 3);
});

test('a missing or empty register excepts nothing', () => {
  assert.deepEqual([...exceptedPaths(undefined).accepted], []);
  assert.deepEqual([...exceptedPaths({ exceptions: [] }).accepted], []);
});

test('the register on disk is the one the rule points at, and its reasons hold up', () => {
  const document = JSON.parse(readFileSync(EXCEPTIONS_PATH, 'utf8'));
  const { accepted, rejected } = exceptedPaths(document);
  assert.deepEqual(rejected, [], 'every recorded exception must carry a usable reason');
  assert.ok(accepted.has('apps/web/components/gekta/GektaChatWorkspace.tsx'));
});

test('the repository itself passes', () => {
  const result = spawnSync(process.execPath, ['scripts/security/verify-browser-security-capabilities.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /weak fallback\s+0/u);
});
