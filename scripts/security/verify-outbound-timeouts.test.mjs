import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  callArguments,
  isBoundedCall,
  outboundCallSites,
  OUTBOUND_ROOTS,
  scanOutboundTimeouts,
  trackedSources,
} from './verify-outbound-timeouts.mjs';

test('the API server has no unbounded outbound call', () => {
  const { unbounded } = scanOutboundTimeouts();
  assert.deepEqual(
    unbounded.map((site) => `${site.file}:${site.line}`),
    [],
  );
});

test('the site count agrees with an independent grep, so the scan cannot silently miss files', () => {
  // The scan walks git-tracked paths itself. If its own file discovery ever drops
  // files — the way a '**/*.ts' pathspec silently skips files directly in a
  // directory — this cross-check disagrees instead of reporting a clean tree.
  const files = trackedSources();
  const grepped = execFileSync(
    'bash',
    [
      '-c',
      `printf '%s\\0' ${files.map((f) => `'${f}'`).join(' ')} | xargs -0 grep -oE '(^|[^.[:alnum:]_$])fetch[[:space:]]*\\(' | wc -l`,
    ],
    { encoding: 'utf8' },
  ).trim();

  const { sites } = scanOutboundTimeouts();
  assert.equal(sites.length, Number(grepped));
  assert.ok(sites.length > 0, 'a scan that finds no outbound call at all is not evidence of safety');
});

test('argument extraction balances parentheses instead of trusting a line window', () => {
  const source = [
    'await fetch(url, {',
    '  method: "POST",',
    '  body: JSON.stringify({ nested: fn(a, b), deeper: g(h(i)) }),',
    ...Array.from({ length: 40 }, (_, index) => `  header${index}: "v",`),
    '  signal: AbortSignal.timeout(1000),',
    '});',
  ].join('\n');

  const open = source.indexOf('(');
  const args = callArguments(source, open);
  // A 20-line window would stop before the signal and call this unbounded.
  assert.ok(args.includes('AbortSignal.timeout'));
  assert.equal(outboundCallSites(source, 'x.ts')[0].bounded, true);
});

test('a parenthesis inside a string or a template literal does not truncate the arguments', () => {
  const source = 'await fetch(`${base}/v1/a)b`, { headers: { x: "close ) paren" }, signal });';
  const args = callArguments(source, source.indexOf('('));
  assert.ok(args.includes('signal'));
  assert.equal(outboundCallSites(source, 'x.ts')[0].bounded, true);
});

test('an unbounded call is reported, and a method named fetch on an object is not an outbound call', () => {
  assert.equal(
    outboundCallSites('await fetch(url, { method: "POST" });', 'x.ts')[0].bounded,
    false,
  );
  // A cache or client object of our own is not the global outbound fetch.
  assert.deepEqual(outboundCallSites('await cache.fetch(key);', 'x.ts'), []);
  assert.deepEqual(outboundCallSites('const prefetch = 1;', 'x.ts'), []);
});

test('every accepted form of bounding is a real abort, not a lookalike token', () => {
  assert.equal(isBoundedCall('url, { signal }'), true);
  assert.equal(isBoundedCall('url, { signal: controller.signal }'), true);
  assert.equal(isBoundedCall('url, { signal: AbortSignal.timeout(1000) }'), true);
  // A timeout the request never receives is not a bound.
  assert.equal(isBoundedCall('url, { timeout: 1000 }'), false);
  assert.equal(isBoundedCall('url, { headers: { "x-signal-strength": "1" } }'), false);
  assert.equal(isBoundedCall('url'), false);
});

test('the scan is anchored on the API server, not on presentation code', () => {
  assert.deepEqual(OUTBOUND_ROOTS, ['apps/api/src']);
});
