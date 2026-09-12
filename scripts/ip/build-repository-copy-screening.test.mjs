import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { isStructurallyEmpty, normalizeSource, parseSymlink, tokens } from './build-repository-copy-screening.mjs';

function normalizerText(file, name) {
  const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
  const body = new RegExp(`function ${name}\\(source\\) \\{[\\s\\S]*?\\n\\}`, 'u').exec(source);
  assert.ok(body, `${name} not found in ${file}`);
  return body[0];
}

/**
 * Two normalisers are two different meanings of the word "clean".
 *
 * This screening and build-offline-similarity-evidence.mjs both claim that a
 * normalized-digest match means "the same file, reformatted". If their
 * normalisation drifts apart, one of the two records is quietly answering a
 * different question than it says. The tool that owns the definition is the
 * older one; this test is the copy's obligation to it.
 */
test('the normaliser is character-identical to the one in the token screening', () => {
  assert.equal(
    normalizerText('./build-repository-copy-screening.mjs', 'normalizeSource').replace(/^export /u, ''),
    normalizerText('./build-offline-similarity-evidence.mjs', 'normalizeSource'),
  );
});

test('the tokeniser is character-identical to the one in the token screening', () => {
  assert.equal(
    normalizerText('./build-repository-copy-screening.mjs', 'tokens').replace(/^export /u, ''),
    normalizerText('./build-offline-similarity-evidence.mjs', 'tokens'),
  );
});

test('normalisation erases comments, indentation, line breaks, string contents and numbers', () => {
  const original = 'function price(a) {\n  // comment\n  return a * 1.05;\n}\n';
  const reflowed = 'function price(a) {\n\t\t\t/* different comment */\n\n  return a * 2.5;\n}';
  assert.equal(normalizeSource(original), normalizeSource(reflowed));
});

/**
 * The limit, pinned so nobody reads the normalized digest as wider than it is.
 * Whitespace runs are collapsed, not removed, so a formatter that respaces around
 * an operator changes the digest. This is why the screening also hashes the token
 * sequence: that one does survive it.
 */
test('the normalized digest does not survive respacing, and the token digest does', () => {
  const spaced = 'function price(a) { return a * 1.05; }';
  const tight = 'function price( a ) { return a*1.05; }';
  assert.notEqual(normalizeSource(spaced), normalizeSource(tight));
  assert.deepEqual(tokens(spaced), tokens(tight));
});

test('normalisation does not erase the code itself', () => {
  assert.notEqual(
    normalizeSource('function price(a) { return a * 2; }'),
    normalizeSource('function price(a) { return a / 2; }'),
  );
});

/**
 * Every screening this programme has run spent its entire finding list on two
 * shapes that contain nothing: a barrel of re-exports and a module that is one
 * docstring. Counting them as findings is how a clean result looks dirty, and
 * dropping them silently is how a dirty one looks clean. They are measured.
 */
test('a barrel and a docstring-only module are structurally empty', () => {
  assert.equal(isStructurallyEmpty(normalizeSource("export * from './a';\nexport * from './b';\n")), true);
  assert.equal(isStructurallyEmpty(normalizeSource('"""Package docstring."""\n')), true);
  assert.equal(isStructurallyEmpty(normalizeSource('')), true);
});

test('a file with one real statement is not structurally empty', () => {
  assert.equal(isStructurallyEmpty(normalizeSource('const a = 1;')), false);
  assert.equal(isStructurallyEmpty(normalizeSource('export const a = 1;')), false);
  assert.equal(isStructurallyEmpty(normalizeSource('def run():\n    return 1\n')), false);
});

/**
 * A tracked symlink is not a file a screening can read, and an absolute one does
 * not resolve anywhere but the machine it was committed from.
 */
test('an absolute tracked symlink is distinguished from a relative one', () => {
  assert.deepEqual(parseSymlink('120000', '../../app'), { target: '../../app', absolute: false });
  assert.deepEqual(parseSymlink('120000', '/home/user/pachanin-demo/apps/web'), { target: '/home/user/pachanin-demo/apps/web', absolute: true });
  assert.equal(parseSymlink('100644', 'not-a-link'), null);
  assert.equal(parseSymlink('100755', '/looks/absolute'), null, 'a regular file is not a symlink whatever its contents look like');
});
