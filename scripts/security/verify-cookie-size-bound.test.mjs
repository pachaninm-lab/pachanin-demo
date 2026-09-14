import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

import { classifyValue, findCookieWrites, isCookieJar, selectSources } from './verify-cookie-size-bound.mjs';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');

const parse = (source) => ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const writesIn = (source) => findCookieWrites(parse(source));
const receiverOf = (source) => {
  let found = null;
  const visit = (node) => {
    if (!found && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'set') {
      found = node.expression.expression;
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(source));
  return found;
};

test('a cookie jar is recognized through the wrappers it is reached by', () => {
  assert.equal(isCookieJar(receiverOf('response.cookies.set(A, b, c);')), true);
  assert.equal(isCookieJar(receiverOf('cookieStore.set(A, b, c);')), true);
  assert.equal(isCookieJar(receiverOf('(await cookies()).set(A, b, c);')), true);
  assert.equal(isCookieJar(receiverOf('(response!.cookies).set(A, b, c);')), true);
});

test('an ordinary Map or Set is not mistaken for a cookie jar', () => {
  assert.equal(isCookieJar(receiverOf('seen.set(key, value);')), false);
  assert.equal(isCookieJar(receiverOf('new Map().set(key, value);')), false);
  assert.equal(isCookieJar(receiverOf('headers.set("x", "y");')), false);
});

test('a literal value is bounded by the source text itself', () => {
  assert.equal(writesIn('response.cookies.set(NAME, "", options);')[0].verdict, 'LITERAL');
  assert.equal(writesIn('response.cookies.set(NAME, `true`, options);')[0].verdict, 'LITERAL');
});

test('a budget-enforcing helper is what makes a computed value acceptable', () => {
  assert.equal(writesIn('response.cookies.set(NAME, boundedCookieValue(NAME, token), options);')[0].verdict, 'BOUNDED');
  assert.equal(
    writesIn('response.cookies.set(NAME, serializeWithinCookieBudget(NAME, build, text), options);')[0].verdict,
    'BOUNDED',
  );
});

test('anything else is reported, with the expression that was not accounted for', () => {
  const [write] = writesIn('response.cookies.set(NAME, payload.accessToken, options);');
  assert.equal(write.verdict, 'UNBOUNDED');
  assert.equal(write.detail, 'payload.accessToken');
  assert.equal(write.cookie, 'NAME');
});

test('a template literal with a substitution is not a literal', () => {
  // `demo.${role}` has no fixed length, whatever it looks like.
  assert.equal(writesIn('response.cookies.set(NAME, `demo.${role}`, options);')[0].verdict, 'UNBOUNDED');
});

test('the single-object form is read for its value, not skipped', () => {
  const [write] = writesIn('response.cookies.set({ name: NAME, value: token, path: "/" });');
  assert.equal(write.cookie, 'NAME');
  assert.equal(write.verdict, 'UNBOUNDED');
  assert.equal(writesIn('response.cookies.set({ name: NAME, value: "", path: "/" });')[0].verdict, 'LITERAL');
});

test('a write with no value at all is reported rather than passed over', () => {
  assert.equal(writesIn('response.cookies.set(NAME);')[0].verdict, 'MISSING');
});

test('source selection skips symlinks, tests and everything outside the scanned roots', () => {
  const listing = [
    '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tapps/web/middleware.ts',
    '120000 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tapps/web/apps/web/middleware.ts',
    '100644 cccccccccccccccccccccccccccccccccccccccc 0\tapps/web/tests/unit/cookieSizeBound.spec.ts',
    '100644 dddddddddddddddddddddddddddddddddddddddd 0\tapps/web/lib/server/bounded-cookie.ts',
    '100644 eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee 0\tapps/web/public/logo.svg',
    '100644 ffffffffffffffffffffffffffffffffffffffff 0\tdocs/security/notes.ts',
  ].join('\n');
  assert.deepEqual(selectSources(listing), ['apps/web/middleware.ts', 'apps/web/lib/server/bounded-cookie.ts']);
});

test('the repository itself passes', () => {
  const result = spawnSync(process.execPath, ['scripts/security/verify-cookie-size-bound.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /unaccounted for\s+0/u);
});
