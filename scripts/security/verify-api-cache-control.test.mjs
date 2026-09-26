import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

import { classify, resolveImport, setsCacheControl } from './verify-api-cache-control.mjs';

/** In-memory tree so the unit cases do not depend on the repository. */
function io(tree) {
  return {
    readFile: (file) => tree[file] ?? '',
    exists: (file) => Object.hasOwn(tree, file),
  };
}

test('a handler that sets the header itself is covered', () => {
  const tree = { 'r.ts': "return NextResponse.json(x, { headers: { 'Cache-Control': 'no-store' } });" };
  assert.equal(setsCacheControl('r.ts', io(tree)), true);
});

test('the Headers-call spelling counts too', () => {
  // The shared helper uses headers.set('cache-control', …), not an object
  // literal. Accepting only the literal made a freshly fixed tree still report
  // every route as uncovered.
  const tree = { 'r.ts': "headers.set('cache-control', 'no-store');" };
  assert.equal(setsCacheControl('r.ts', io(tree)), true);
});

test('a handler covered only through a helper is covered', () => {
  const tree = {
    'app/api/x/route.ts': "import { send } from '../../../lib/send';\nreturn send(x);",
    'lib/send.ts': "return NextResponse.json(b, { headers: { 'Cache-Control': 'no-store' } });",
  };
  assert.equal(setsCacheControl('app/api/x/route.ts', io(tree)), true);
});

test('a helper reached through the @/ alias is followed', () => {
  // Resolving only relative imports counted every alias-importing route as
  // uncovered - the second measurement error while writing this gate.
  const tree = {
    'app/api/x/route.ts': "import { send } from '@/lib/send';\nreturn send(x);",
    'apps/web/lib/send.ts': "headers.set('cache-control', 'no-store');",
  };
  assert.equal(setsCacheControl('app/api/x/route.ts', io(tree)), true);
});

test('a handler that says nothing about caching is uncovered', () => {
  const tree = { 'r.ts': 'return NextResponse.json(payload);' };
  assert.equal(setsCacheControl('r.ts', io(tree)), false);
});

test('an import chain deeper than the hop limit is not followed', () => {
  const tree = {
    'a.ts': "from './b'", 'b.ts': "from './c'", 'c.ts': "from './d'", 'd.ts': "from './e'",
    'e.ts': "headers.set('cache-control', 'no-store');",
  };
  assert.equal(setsCacheControl('a.ts', io(tree)), false);
});

test('a cycle in the import graph terminates', () => {
  const tree = { 'a.ts': "from './b'", 'b.ts': "from './a'" };
  assert.equal(setsCacheControl('a.ts', io(tree)), false);
});

test('a streaming handler is exempt and counted separately, not silently', () => {
  const tree = { 's.ts': "headers: { 'Content-Type': 'text/event-stream' }" };
  const result = classify(['s.ts'], io(tree));
  assert.deepEqual(result.streaming, ['s.ts']);
  assert.deepEqual(result.uncovered, []);
  assert.deepEqual(result.covered, []);
});

test('resolveImport handles the alias, relative paths and index files', () => {
  const exists = (f) => ['apps/web/lib/a.ts', '/x/b/index.ts'].includes(f);
  assert.equal(resolveImport('anything.ts', '@/lib/a', exists), 'apps/web/lib/a.ts');
  assert.equal(resolveImport('/x/y.ts', './b', exists), '/x/b/index.ts');
  assert.equal(resolveImport('/x/y.ts', 'next/server', exists), null);
});

test('the working tree has no handler that says nothing about caching', () => {
  const files = execFileSync('git', ['ls-files', 'apps/web/app/api/**/route.ts'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const { covered, streaming, uncovered } = classify(files);
  assert.deepEqual(uncovered, []);
  assert.ok(covered.length > 100, `expected the bulk to be covered, got ${covered.length}`);
  assert.ok(streaming.length > 0, 'the streaming exemption should still describe real handlers');
});
