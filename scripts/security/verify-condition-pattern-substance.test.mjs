import { strict as assert } from 'node:assert';
import test from 'node:test';

import { isProseOnly, occurrences, stripComments } from './verify-condition-pattern-substance.mjs';

/**
 * The distinction the whole check rests on: a comment is prose, a string literal
 * is code doing its job. A stripper that did not know the difference would erase
 * working controls and report them as descriptions.
 */
test('a line comment is stripped and an identical string literal is not', () => {
  const source = [
    "const denied = '// not a comment';",
    '// this one is a comment',
    'const real = deny();',
  ].join("\n");
  const stripped = stripComments(source, '.ts');
  assert.ok(stripped.includes("'// not a comment'"), 'a string keeping comment characters must survive');
  assert.ok(!stripped.includes('this one is a comment'));
  assert.ok(stripped.includes('const real = deny();'));
});

test('a block comment is stripped and newlines inside it are preserved', () => {
  const source = ['const a = 1;', '/* one', '   two */', 'const b = 2;'].join("\n");
  const stripped = stripComments(source, '.ts');
  assert.ok(!stripped.includes('one'));
  assert.ok(!stripped.includes('two'));
  assert.equal(stripped.split("\n").length, source.split("\n").length, 'line numbering must not move');
});

test('each language loses its own comment marker and no other', () => {
  assert.ok(!stripComments('x = 1  # note', '.py').includes('note'));
  assert.ok(stripComments('x = 1  # note', '.ts').includes('note'), 'a hash is not a comment in TypeScript');
  assert.ok(!stripComments('SELECT 1 -- note', '.sql').includes('note'));
  assert.ok(stripComments('const a = 1 -- note', '.ts').includes('note'), 'a double dash is not a comment in TypeScript');
});

test('an escaped quote does not end the string it is inside', () => {
  const source = String.raw`const a = 'it\'s // fine'; // gone`;
  const stripped = stripComments(source, '.ts');
  assert.ok(stripped.includes('// fine'), 'the string must survive its escaped quote');
  assert.ok(!stripped.includes('gone'));
});

test('occurrences counts case-insensitively, the way the matrix matches', () => {
  assert.equal(occurrences('Foo foo FOO', 'foo'), 3);
  assert.equal(occurrences('abcabc', 'abc'), 2);
  assert.equal(occurrences('abc', 'zzz'), 0);
  assert.equal(occurrences('anything', ''), 0);
});

/** The positive control: without one, a check that finds nothing proves nothing. */
test('a pattern that lives only in a comment is prose-only', () => {
  const source = ['// the endpoint is for internal monitoring only', 'export const handler = () => ok();'].join("\n");
  assert.equal(isProseOnly(source, '.ts', 'for internal monitoring only'), true);
});

test('a pattern that appears in code is not prose-only, even when a comment also mentions it', () => {
  const source = ['// we call deny() here', 'const result = deny();'].join("\n");
  assert.equal(isProseOnly(source, '.ts', 'deny()'), false);
});

test('a pattern inside a string literal is code, not prose', () => {
  assert.equal(isProseOnly("const algorithm = 'aes-256-gcm';", '.ts', 'aes-256-gcm'), false);
});

test('a pattern that is not there at all is not prose-only', () => {
  assert.equal(isProseOnly('const a = 1;', '.ts', 'nowhere'), false);
});

test('a file type with no comment syntax is returned unchanged', () => {
  const json = '{"a": "// not a comment"}';
  assert.equal(stripComments(json, '.json'), json);
});
