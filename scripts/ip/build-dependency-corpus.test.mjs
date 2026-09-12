import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { corpusEntryName, packageDirectories } from './build-dependency-corpus.mjs';

/**
 * The invariant that decides whether the corpus exists at all.
 *
 * The screening tool excludes any path containing a node_modules segment - it has
 * to, or it would scan our own installed tree and call our dependencies our own
 * code. pnpm stores packages at .pnpm/<id>/node_modules/<name>, so pointing the
 * tool at the store leaves every entry excluded, and the run reports a clean
 * result over an empty corpus: the most dangerous possible outcome, because it
 * looks like proof of originality.
 */
test('a corpus entry name never contains a node_modules segment', () => {
  for (const [id, name] of [
    ['zod@4.3.6', 'zod'],
    ['@nestjs+common@10.4.22', '@nestjs/common'],
    ['@angular-devkit+core@17.3.11_chokidar@3.6.0', '@angular-devkit/core'],
  ]) {
    const entry = corpusEntryName(id, name);
    assert.equal(entry.includes('/'), false, `${entry} must be a single path segment`);
    assert.equal(/(^|\/)node_modules(\/|$)/u.test(entry), false);
  }
});

test('a scoped package keeps scope and name distinct, so two scopes cannot collide', () => {
  assert.notEqual(
    corpusEntryName('x@1', '@a/core'),
    corpusEntryName('x@1', '@b/core'),
  );
  assert.equal(corpusEntryName('x@1', '@a/core'), 'x@1__@a__core');
});

test('the store walk finds scoped and unscoped packages and skips .bin', () => {
  const root = mkdtempSync(join(tmpdir(), 'corpus-'));
  try {
    const store = join(root, '.pnpm');
    for (const path of [
      'zod@4.3.6/node_modules/zod',
      '@nestjs+common@10.4.22/node_modules/@nestjs/common',
      'zod@4.3.6/node_modules/.bin',
    ]) {
      mkdirSync(join(store, path), { recursive: true });
    }
    writeFileSync(join(store, 'zod@4.3.6/node_modules/zod/index.js'), 'export const a = 1;\n');

    const found = packageDirectories(store).map((entry) => entry.name).sort();
    assert.deepEqual(found, ['@nestjs/common', 'zod']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a symlinked package directory is not mistaken for a package', () => {
  const root = mkdtempSync(join(tmpdir(), 'corpus-'));
  try {
    const store = join(root, '.pnpm');
    mkdirSync(join(store, 'real@1/node_modules/real'), { recursive: true });
    symlinkSync(join(store, 'real@1/node_modules/real'), join(store, 'real@1/node_modules/alias'));
    const found = packageDirectories(store).map((entry) => entry.name).sort();
    assert.deepEqual(found, ['real'], 'only the real directory is a package');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a store that is not installed yields nothing rather than throwing', () => {
  assert.deepEqual(packageDirectories(join(tmpdir(), 'no-such-store-ecb1')), []);
});
