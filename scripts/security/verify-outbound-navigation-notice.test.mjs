import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

import { CONFIRMED_ATTRIBUTE, CONFIRMED_COMPONENT, bindsAContractAbsoluteUri, findNewTabAnchors, isLiteralSameOriginHref, selectSources } from './verify-outbound-navigation-notice.mjs';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');
const anchors = (jsx) => findNewTabAnchors(ts.createSourceFile('f.tsx', `const x = ${jsx};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));

test('a literal same-origin path needs no notice', () => {
  const [a] = anchors("<a href='/platform-v7/terms' target='_blank'>t</a>");
  assert.equal(a.literalSameOrigin, true);
  assert.equal(a.confirmed, false);
});

test('a protocol-relative href is another origin, not a path', () => {
  const [a] = anchors("<a href='//evil.example/x' target='_blank'>t</a>");
  assert.equal(a.literalSameOrigin, false);
});

test('an absolute href is not a same-origin path', () => {
  const [a] = anchors("<a href='https://evil.example/x' target='_blank'>t</a>");
  assert.equal(a.literalSameOrigin, false);
});

test('a run-time href is only acceptable when it is confirmed', () => {
  const [plain] = anchors("<a href={destination.href} target='_blank'>t</a>");
  assert.equal(plain.literalSameOrigin, false);
  assert.equal(plain.confirmed, false);
  const [marked] = anchors(`<a href={destination.href} target='_blank' ${CONFIRMED_ATTRIBUTE}={'true'}>t</a>`);
  assert.equal(marked.confirmed, true);
});

test('an anchor that does not open a new tab is not this rule', () => {
  assert.deepEqual(anchors("<a href={destination.href}>t</a>"), []);
  assert.deepEqual(anchors("<a href={destination.href} target='_self'>t</a>"), []);
});

test('Link is covered as well as a', () => {
  const [a] = anchors("<Link href='/legal/terms' target='_blank'>t</Link>");
  assert.equal(a.tag, 'Link');
  assert.equal(a.literalSameOrigin, true);
});

test('isLiteralSameOriginHref answers false for a missing href', () => {
  assert.equal(isLiteralSameOriginHref(undefined), false);
  assert.equal(isLiteralSameOriginHref(null), false);
});

test('source selection skips symlinks, tests and non-tsx', () => {
  const listing = [
    '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tapps/web/components/gekta/GektaSourceList.tsx',
    '120000 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tapps/web/apps/web/components',
    '100644 cccccccccccccccccccccccccccccccccccccccc 0\tapps/web/tests/unit/x.spec.tsx',
    '100644 dddddddddddddddddddddddddddddddddddddddd 0\tapps/web/lib/gekta/outbound-destination.ts',
  ].join('\n');
  assert.deepEqual(selectSources(listing), ['apps/web/components/gekta/GektaSourceList.tsx']);
});

test('an href bound to the contract-absolute field needs a notice even in the same tab', () => {
  const [a] = anchors('<a href={citation.uri}>t</a>');
  assert.equal(a.confirmed, false);
  assert.equal(a.literalSameOrigin, false);
});

test('an href bound to the internal catalogue field is not flagged', () => {
  // citation.href comes from a fixed list of /platform-v7 paths; pushing it
  // through an external-link component would be a regression, not a control.
  assert.deepEqual(anchors('<Link href={citation.href}>t</Link>'), []);
});

test('the confirmed component counts as the notice', () => {
  const [a] = anchors(`<${CONFIRMED_COMPONENT} uri={citation.uri}>t</${CONFIRMED_COMPONENT}>`);
  assert.equal(a.confirmed, true);
});

test('the repository itself passes', () => {
  const result = spawnSync(process.execPath, ['scripts/security/verify-outbound-navigation-notice.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /unannounced\s+0/u);
});
