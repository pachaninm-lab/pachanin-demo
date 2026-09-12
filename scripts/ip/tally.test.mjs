import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tallyBy } from './tally.mjs';

const rows = (...keys) => keys.map((key) => ({ key }));

test('counts ordinary keys in first-seen order', () => {
  const counts = tallyBy(rows('B', 'A', 'B'), (row) => row.key, 'probe');
  assert.deepEqual(Object.keys(counts), ['B', 'A']);
  assert.deepEqual(counts, { B: 2, A: 1 });
});

test('counts __proto__ instead of silently dropping it', () => {
  const items = rows('A', '__proto__', '__proto__');
  const counts = tallyBy(items, (row) => row.key, 'probe');
  assert.equal(Object.hasOwn(counts, '__proto__'), true);
  assert.equal(counts.__proto__, 2);
  assert.equal(Object.values(counts).reduce((sum, n) => sum + n, 0), items.length);
});

test('counts constructor as a number instead of concatenating onto Object', () => {
  const counts = tallyBy(rows('constructor', 'constructor'), (row) => row.key, 'probe');
  assert.equal(counts.constructor, 2);
  assert.equal(typeof counts.constructor, 'number');
});

test('a plain-object accumulator loses the same records — the defect this replaces', () => {
  const items = rows('A', '__proto__', '__proto__', 'constructor', 'A');
  const broken = {};
  for (const item of items) broken[item.key] = (broken[item.key] ?? 0) + 1;
  const brokenTotal = Object.values(broken)
    .reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
  assert.equal(brokenTotal, 2, 'plain object counts 2 of 5');
  assert.equal(typeof broken.constructor, 'string', 'plain object concatenates onto Object');

  const fixed = tallyBy(items, (item) => item.key, 'probe');
  assert.equal(Object.values(fixed).reduce((sum, n) => sum + n, 0), items.length);
});

test('refuses to emit a breakdown that lost records', () => {
  // A key function that throws away a record is the failure mode the total
  // check exists to catch; simulate it with a Map-shaped miscount.
  const items = rows('A', 'B');
  assert.throws(
    () => tallyBy({ length: 3, [Symbol.iterator]: items[Symbol.iterator].bind(items) }, (row) => row.key, 'probe'),
    /breakdown lost records — counted 2 of 3/u,
  );
});

test('stringifies non-string keys so numeric and null groups stay distinct', () => {
  const counts = tallyBy([{ k: null }, { k: 1 }, { k: '1' }], (row) => row.k, 'probe');
  assert.deepEqual(counts, { null: 1, 1: 2 });
});

test('an empty input yields an empty breakdown, not a failure', () => {
  assert.deepEqual(tallyBy([], (row) => row.key, 'probe'), {});
});
