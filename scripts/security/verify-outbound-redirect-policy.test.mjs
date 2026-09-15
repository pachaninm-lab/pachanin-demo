import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BACKEND_ROOTS, DECIDED_VALUES, COMMENT, LITERAL,
  maskNonCode, matchBracket, splitTopLevel, objectKeys, withoutComments,
  fetchSitesIn, isClientModule, isBackendPath, isRelativeUrlLiteral,
  categoryProblem, reconcile,
} from './verify-outbound-redirect-policy.mjs';

const only = (source) => {
  const sites = fetchSitesIn(source, 'f.ts');
  assert.equal(sites.length, 1, `expected one call site, found ${sites.length}`);
  return sites[0];
};

/* -------------------------------------------------------------- *
 * Telling code from the text that looks like it
 * -------------------------------------------------------------- */

test('a fetch written inside a string or a comment is not a call site', () => {
  assert.deepEqual(fetchSitesIn("const doc = 'call fetch(url) to send';\n", 'f.ts'), []);
  assert.deepEqual(fetchSitesIn('// fetch(url) is how this used to work\n', 'f.ts'), []);
  assert.deepEqual(fetchSitesIn('/* fetch(url, {}) */\n', 'f.ts'), []);
});

test('an identifier ending in fetch is a different function', () => {
  assert.deepEqual(fetchSitesIn("prefetch(url, { cache: 'no-store' });", 'f.ts'), []);
  assert.deepEqual(fetchSitesIn("refetch(url, { cache: 'no-store' });", 'f.ts'), []);
});

test("another object's fetch method is not the global one, but globalThis.fetch is", () => {
  assert.deepEqual(fetchSitesIn('cache.fetch(url, {});', 'f.ts'), []);
  assert.equal(fetchSitesIn('globalThis.fetch(url, {});', 'f.ts').length, 1);
  assert.equal(fetchSitesIn('window . fetch(url, {});', 'f.ts').length, 1);
});

test('braces and parentheses inside a template literal are text, not structure', () => {
  // Without a template-aware mask the closing paren of the call is found inside
  // the URL, the init object is never reached, and the site reads as safe.
  const site = only('await fetch(`${base}/a)b{c}/${id}`, { redirect: \'error\' });');
  assert.equal(site.posture, 'declared');
  assert.equal(site.value, 'error');
});

test('a nested template inside a substitution is still tracked', () => {
  const site = only('await fetch(`${a(`${b}/x`)}/y`, { redirect: \'error\' });');
  assert.equal(site.value, 'error');
});

test('a regular expression containing a paren does not unbalance the scan', () => {
  const source = "const re = /a(b/;\nawait fetch(url, { redirect: 'error' });";
  assert.equal(only(source).value, 'error');
});

test('division is not mistaken for the start of a regular expression', () => {
  const source = "const half = total / 2;\nawait fetch(url, { redirect: 'error' });";
  assert.equal(only(source).value, 'error');
});

test('the mask separates comments from literal text', () => {
  const source = "// note\nconst s = 'text';";
  const mask = maskNonCode(source);
  assert.equal(mask[0], COMMENT);
  assert.equal(mask[source.indexOf('text')], LITERAL);
  assert.equal(withoutComments(source, mask).trim(), "const s = 'text';");
  // The string body survives, or a quoted property name would vanish with it.
  assert.ok(withoutComments(source, mask).includes("'text'"));
});

/* -------------------------------------------------------------- *
 * Reading the redirect posture
 * -------------------------------------------------------------- */

test('an init object with no redirect property leaves the default in place', () => {
  const site = only("await fetch(url, { method: 'POST', cache: 'no-store' });");
  assert.equal(site.posture, 'default');
  assert.equal(site.value, null);
});

test('a call with no init at all leaves the default in place', () => {
  assert.equal(only('await fetch(url);').posture, 'default');
});

test('a comment between properties does not hide the property after it', () => {
  // This is not hypothetical: a real call site carrying redirect: 'error' below
  // a two-line comment was reported as unguarded until the mask distinguished
  // comments from literals.
  const site = only([
    'await fetch(endpoint, {',
    "  method: 'POST',",
    '  // The bot token is part of the endpoint path. Never follow a redirect',
    '  // that could replay that credential to a different origin.',
    "  redirect: 'error',",
    '});',
  ].join('\n'));
  assert.equal(site.posture, 'declared');
  assert.equal(site.value, 'error');
});

test('a quoted property name reads the same as a bare one', () => {
  assert.equal(only("await fetch(url, { 'redirect': 'error' });").value, 'error');
});

test('manual is a decided posture and follow is not', () => {
  assert.ok(DECIDED_VALUES.has('manual') && DECIDED_VALUES.has('error'));
  assert.ok(!DECIDED_VALUES.has('follow'));
  assert.equal(only("await fetch(url, { redirect: 'manual' });").value, 'manual');
  assert.equal(only("await fetch(url, { redirect: 'follow' });").value, 'follow');
});

test('a computed redirect value is not read as a decision', () => {
  assert.equal(only('await fetch(url, { redirect: mode });').value, 'computed');
});

test('an init built only from a spread is reported as such, not as safe', () => {
  const site = only('await fetch(url, { ...init, cache: \'no-store\' });');
  assert.equal(site.posture, 'spread');
});

test('a redirect written after a spread is a decision, because the later key wins', () => {
  assert.equal(only("await fetch(url, { ...init, redirect: 'error' });").value, 'error');
});

test('the property must belong to the init object, not to something nested in it', () => {
  const site = only("await fetch(url, { body: JSON.stringify({ redirect: 'error' }) });");
  assert.equal(site.posture, 'default', 'a redirect field in the BODY is not a fetch option');
});

test('two calls in one file are told apart by their ordinal', () => {
  const sites = fetchSitesIn('await fetch(url, {});\nawait fetch(url, {});', 'f.ts');
  assert.deepEqual(sites.map((s) => s.occurrence), [0, 1]);
  assert.equal(new Set(sites.map((s) => s.key)).size, 2);
});

test('the key names the file, the target and the ordinal', () => {
  assert.equal(only('await fetch(url, {});').key, 'f.ts::url::0');
});

/* -------------------------------------------------------------- *
 * Scope
 * -------------------------------------------------------------- */

test('"use client" is recognised through a licence header but not mid-file', () => {
  assert.ok(isClientModule("'use client';\n"));
  assert.ok(isClientModule('/* header */\n\n"use client";\n'));
  assert.ok(isClientModule('// a note\n\'use client\';\n'));
  assert.ok(!isClientModule("const s = 'use client';\n"));
  assert.ok(!isClientModule('export const x = 1;\n\'use client\';\n'));
});

test('reading the directive stays linear on a comment-heavy header', () => {
  // The first version of isClientModule skipped leading trivia with one
  // quantified alternation whose branches both matched whitespace. Measured on
  // "/*c*/ " repeated, it ran 4ms at ten comments, 587ms at sixteen and 5.3s at
  // eighteen - roughly nine times worse per two comments - because every run of
  // whitespace after a comment could be claimed by either branch. A module with
  // a long comment header and no directive is the ordinary case here, so this
  // was reachable. The margin below is generous: the old form needed five
  // seconds for the same input the current one answers in under a millisecond.
  const source = '/*c*/ '.repeat(18) + 'export const x = 1;\n';
  const started = process.hrtime.bigint();
  assert.equal(isClientModule(source), false);
  const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(elapsed < 200, `took ${elapsed.toFixed(1)}ms; the exponential form took 5296ms`);
});

test('a comment header is skipped whichever way it is written', () => {
  assert.ok(isClientModule('/*c*/ /*c*/\n\n  // and a line comment\n"use client";'));
  assert.ok(!isClientModule('/* never closed\n'));
  assert.ok(!isClientModule('/*c*/ /*c*/ export const x = 1;'));
});

test('every server-side root is in scope and test files are not', () => {
  for (const root of BACKEND_ROOTS) assert.ok(isBackendPath(`${root}x.ts`), root);
  assert.ok(isBackendPath('apps/web/components/ServerThing.tsx'));
  assert.ok(!isBackendPath('apps/api/src/thing.spec.ts'));
  assert.ok(!isBackendPath('apps/web/tests/unit/x.test.ts'));
  assert.ok(!isBackendPath('packages/ui/src/x.ts'));
});

/* -------------------------------------------------------------- *
 * What an exception has to prove
 * -------------------------------------------------------------- */

test('a relative path proves browser context; a protocol-relative URL does not', () => {
  assert.ok(isRelativeUrlLiteral("'/api/x'"));
  assert.ok(isRelativeUrlLiteral('`/api/${id}`'));
  // //evil.example is an absolute cross-origin URL wearing a leading slash.
  assert.ok(!isRelativeUrlLiteral("'//evil.example/x'"));
  assert.ok(!isRelativeUrlLiteral("'https://x.example/a'"));
  assert.ok(!isRelativeUrlLiteral('endpoint'));
});

test('a browser exception must show a relative URL or a browser-only global', () => {
  const site = { target: 'endpoint', file: 'f.ts' };
  const entry = { category: 'browser', reason: 'x'.repeat(30) };
  assert.ok(categoryProblem(entry, site, 'const a = 1;'), 'nothing browser-only: must complain');
  assert.equal(categoryProblem(entry, site, 'window.localStorage.getItem("k");'), null);
  assert.equal(categoryProblem(entry, { ...site, target: "'/api/x'" }, 'const a = 1;'), null);
});

test('a property merely named window does not pass for the global', () => {
  const entry = { category: 'browser', reason: 'x'.repeat(30) };
  assert.ok(categoryProblem(entry, { target: 'u', file: 'f.ts' }, 'config.window.size = 3;'));
});

test('an unknown category is refused rather than ignored', () => {
  assert.ok(categoryProblem({ category: 'looks-fine' }, { target: 'u' }, ''));
  assert.ok(categoryProblem({}, { target: 'u' }, ''));
  assert.equal(categoryProblem({ category: 'intended-redirect' }, { target: 'u' }, ''), null);
});

/* -------------------------------------------------------------- *
 * Reconciliation
 * -------------------------------------------------------------- */

const site = (over = {}) => ({ file: 'a.ts', line: 1, target: 'url', occurrence: 0, posture: 'declared', value: 'error', key: 'a.ts::url::0', ...over });

test('a decided site needs no entry, an undecided one does', () => {
  assert.deepEqual(reconcile([site()], { sites: [] }).unjudged, []);
  const out = reconcile([site({ posture: 'default', value: null })], { sites: [] });
  assert.equal(out.unjudged.length, 1);
});

test('a site that follows redirects is reported separately from an undecided one', () => {
  const out = reconcile([site({ value: 'follow' })], { sites: [] });
  assert.equal(out.following.length, 1);
  assert.equal(out.unjudged.length, 0);
});

test('an entry for a call that no longer exists is stale and fails', () => {
  const baseline = { sites: [{ key: 'gone.ts::url::0', category: 'browser', reason: 'x'.repeat(30) }] };
  assert.equal(reconcile([], baseline).stale.length, 1);
});

test('a reason too short to be one does not cover the site', () => {
  const key = 'a.ts::url::0';
  const short = { sites: [{ key, category: 'browser', reason: 'browser' }] };
  assert.equal(reconcile([site({ posture: 'default' })], short, () => 'window.x').badReason.length, 1);
  const enough = { sites: [{ key, category: 'browser', reason: 'Runs in the browser against a same-origin path.' }] };
  assert.equal(reconcile([site({ posture: 'default' })], enough, () => 'window.x').badReason.length, 0);
});

test('an entry whose category stops holding stops covering the site', () => {
  const baseline = { sites: [{ key: 'a.ts::url::0', category: 'browser', reason: 'x'.repeat(30) }] };
  const stillBrowser = reconcile([site({ posture: 'default' })], baseline, () => 'window.localStorage.x');
  assert.equal(stillBrowser.badCategory.length, 0);
  const nowServer = reconcile([site({ posture: 'default' })], baseline, () => 'export const x = 1;');
  assert.equal(nowServer.badCategory.length, 1);
});

/* -------------------------------------------------------------- *
 * Helpers used by the above
 * -------------------------------------------------------------- */

test('bracket matching skips brackets that are inside text', () => {
  const source = 'f(")", x)';
  assert.equal(matchBracket(source, maskNonCode(source), 1), source.length - 1);
});

test('argument splitting ignores commas nested one level down', () => {
  const source = 'f(a, g(b, c), { d: 1 })';
  const parts = splitTopLevel(source, maskNonCode(source), 2, source.length - 1);
  assert.equal(parts.length, 3);
});

test('object keys are read at the top level only', () => {
  const source = '({ a: 1, b: { c: 2 }, ...rest })';
  const mask = maskNonCode(source);
  const names = objectKeys(source, mask, 1, source.length - 2).map((k) => k.name);
  assert.deepEqual(names, ['a', 'b', '...']);
});
