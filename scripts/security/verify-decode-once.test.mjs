import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import test from 'node:test';

import { decodesOfAlreadyDecoded, paramDerivedNames } from './verify-decode-once.mjs';

const ts = await import(resolve('apps/api/node_modules/typescript/lib/typescript.js')).then((m) => m.default ?? m);

const parse = (body) => ts.createSourceFile('route.tsx', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const offences = (body) => {
  const source = parse(body);
  return decodesOfAlreadyDecoded(source, ts, paramDerivedNames(source, ts));
};

test('a value destructured out of context.params is tracked', () => {
  const names = paramDerivedNames(parse('const { path: segments = [] } = await context.params;'), ts);
  assert.equal(names.has('segments'), true);
});

test('a map callback over a tracked value is tracked too', () => {
  const names = paramDerivedNames(parse([
    'const { path: segments = [] } = await context.params;',
    'const decoded = segments.map((part) => part.trim());',
  ].join('\n')), ts);
  assert.equal(names.has('part'), true);
});

test('the whole params object counts, however it is awaited', () => {
  assert.equal(paramDerivedNames(parse('const params = await props.params;'), ts).has('params'), true);
  assert.equal(paramDerivedNames(parse('const params = props.params;'), ts).has('params'), true);
});

/** The shape that was in the repository: decode inside a map over catch-all segments. */
test('decoding a mapped catch-all segment is an offence', () => {
  const found = offences([
    'const { path: segments = [] } = await context.params;',
    'const decoded = segments.map((part) => decodeURIComponent(part).trim());',
  ].join('\n'));
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'part');
  assert.equal(found[0].decoder, 'decodeURIComponent');
});

test('decoding a member of the params object is an offence', () => {
  const found = offences(['const params = await props.params;', 'const id = decodeURIComponent(params.id);'].join('\n'));
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'params');
});

test('decodeURI and unescape count as decoders too', () => {
  for (const decoder of ['decodeURI', 'unescape']) {
    const found = offences(['const params = await props.params;', `const id = ${decoder}(params.id);`].join('\n'));
    assert.equal(found.length, 1, decoder);
    assert.equal(found[0].decoder, decoder);
  }
});

/**
 * The check must not object to decoding something that genuinely arrives
 * encoded. A cookie this application encoded itself is the common case, and a
 * rule that flagged it would be turned off.
 */
test('decoding a value that did not come from the router is not an offence', () => {
  assert.deepEqual(offences([
    'const params = await props.params;',
    "const raw = request.cookies.get('pc_session')?.value ?? '';",
    'const session = JSON.parse(decodeURIComponent(raw));',
  ].join('\n')), []);
  assert.deepEqual(offences("const session = JSON.parse(decodeURIComponent(raw));"), []);
});

test('using a route parameter without decoding it is not an offence', () => {
  assert.deepEqual(offences([
    'const { path: segments = [] } = await context.params;',
    'const decoded = segments.map((part) => part.trim()).filter(Boolean);',
  ].join('\n')), []);
});

test('a map over something unrelated does not taint its callback', () => {
  const names = paramDerivedNames(parse('const decoded = other.map((part) => part.trim());'), ts);
  assert.equal(names.has('part'), false);
});

/**
 * Five of the seven sites in this repository put the decode inside a separate
 * `normalizePath(segments)` and passed the catch-all array in, so the taint
 * arrives as a function parameter. The first version of this check followed only
 * declarations in one scope and reported those five clean — a false negative in
 * a guard written for exactly that shape.
 */
test('a helper called with a router value is itself tracked', () => {
  const found = offences([
    'function normalizePath(segments) {',
    '  return segments.map((part) => decodeURIComponent(part).trim());',
    '}',
    'async function handler(context) {',
    '  const { path: pathSegments = [] } = await context.params;',
    '  return normalizePath(pathSegments);',
    '}',
  ].join('\n'));
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'part');
});

/** `params.path || []` is how a catch-all array gets its default. */
test('a default-value expression does not hide the router value', () => {
  const found = offences([
    'function normalizePath(segments) {',
    '  return segments.map((part) => decodeURIComponent(part));',
    '}',
    'async function handler(context) {',
    '  const params = await context.params;',
    '  return normalizePath(params.path || []);',
    '}',
  ].join('\n'));
  assert.equal(found.length, 1, 'the || default must not break the trail');
});

test('a map over a parenthesised default is still a map over the router value', () => {
  const found = offences([
    'function join(parts) {',
    "  return (parts || []).map((part) => decodeURIComponent(part)).join('/');",
    '}',
    'async function handler(context) {',
    '  const { path: pathSegments } = await context.params;',
    '  return join(pathSegments);',
    '}',
  ].join('\n'));
  assert.equal(found.length, 1);
});

test('a helper called with something unrelated stays untracked', () => {
  assert.deepEqual(offences([
    'function normalizePath(segments) {',
    '  return segments.map((part) => decodeURIComponent(part));',
    '}',
    'async function handler(context) {',
    '  const params = await context.params;',
    '  return normalizePath(somethingElse);',
    '}',
  ].join('\n')), []);
});
