import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  GUARDED_HEADERS,
  SANITIZERS,
  accountedFor,
  isAnchoredRegex,
  isRequestHeaderRead,
  selectSources,
} from './verify-forwarded-header-sanitization.mjs';

const require = createRequire(import.meta.url);
const ts = require('../../apps/api/node_modules/typescript/lib/typescript.js');

const parse = (source) => ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function firstRead(source) {
  const sf = parse(source);
  let found = null;
  const visit = (node) => {
    if (!found && isRequestHeaderRead(node)) found = node;
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { node: found, sourceFile: sf };
}

function anchoredNames(sf) {
  const names = new Set();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isAnchoredRegex(node.initializer)) names.add(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

const verdict = (source) => {
  const { node, sourceFile } = firstRead(source);
  assert.ok(node, 'fixture contains no guarded header read');
  return accountedFor(node, sourceFile, anchoredNames(sourceFile));
};

test('a guarded header read on the request is recognized', () => {
  assert.equal(isRequestHeaderRead(firstRead("const a = request.headers.get('x-correlation-id');").node), 'x-correlation-id');
  assert.equal(isRequestHeaderRead(firstRead("const a = req.headers.get('user-agent');").node), 'user-agent');
});

test('a read from a response we received is not a client-controlled value', () => {
  // The API's own correlation id coming back is not the browser's input.
  assert.equal(firstRead("const a = upstream.headers.get('x-correlation-id');").node, null);
  assert.equal(firstRead("const a = response.headers.get('x-correlation-id');").node, null);
});

test('an unguarded header is not this requirement', () => {
  assert.equal(firstRead("const a = request.headers.get('content-type');").node, null);
  assert.equal(firstRead("const a = request.headers.get('sec-fetch-site');").node, null);
});

test('every header this tier forwards on is guarded', () => {
  for (const header of ['x-correlation-id', 'idempotency-key', 'user-agent', 'x-forwarded-for']) {
    assert.ok(GUARDED_HEADERS.has(header), header);
  }
});

test('handing the value straight to a sanitizer accounts for it', () => {
  assert.equal(verdict("const a = safeIdentifier(request.headers.get('x-correlation-id'));"), 'sanitizer');
  assert.equal(verdict("const a = safeUserAgent(request.headers.get('user-agent'));"), 'sanitizer');
});

test('storing it first and sanitizing it after also accounts for it', () => {
  assert.equal(verdict(`
    function handler(request) {
      const provided = String(request.headers.get('x-correlation-id') || '').trim();
      const clean = safeIdentifier(provided);
      return clean;
    }
  `), 'sanitizer');
});

test('an anchored pattern is a validation and accounts for it', () => {
  assert.equal(verdict(`
    const CORRELATION_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
    function handler(request) {
      const requested = String(request.headers.get('x-correlation-id') || '').trim();
      if (CORRELATION_PATTERN.test(requested)) return requested;
      return null;
    }
  `), 'anchored pattern');
});

test('an unanchored pattern proves a substring, not a value, and does not account for it', () => {
  assert.equal(verdict(`
    const LOOSE = /[A-Za-z0-9]{8,}/;
    function handler(request) {
      const requested = String(request.headers.get('x-correlation-id') || '').trim();
      if (LOOSE.test(requested)) return requested;
      return null;
    }
  `), null);
});

test('a read that is forwarded with no control at all is reported', () => {
  assert.equal(verdict(`
    function handler(request) {
      const forwarded = request.headers.get('x-forwarded-for') || '';
      return fetch(url, { headers: { 'x-forwarded-for': forwarded } });
    }
  `), null);
});

test('sanitizing a different variable does not account for this one', () => {
  assert.equal(verdict(`
    function handler(request) {
      const forwarded = request.headers.get('x-forwarded-for') || '';
      const other = safeIdentifier(request.headers.get('x-correlation-id'));
      return { forwarded, other };
    }
  `), null);
});

test('the sanitizer set names every entry point of the helper module', () => {
  for (const name of [
    'safeIdentifier', 'safeCorrelationId', 'safeIdempotencyKey', 'safeClientIp', 'safeUserAgent',
    'clientIpFromRequest', 'correlationIdFromRequest', 'idempotencyKeyFromRequest', 'userAgentFromRequest',
  ]) {
    assert.ok(SANITIZERS.has(name), name);
  }
});

test('source selection skips symlinks, tests and the helper module itself', () => {
  const listing = [
    '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tapps/web/app/api/auth/me/route.ts',
    '120000 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tapps/web/apps/web/lib',
    '100644 cccccccccccccccccccccccccccccccccccccccc 0\tapps/web/tests/unit/x.spec.ts',
    '100644 dddddddddddddddddddddddddddddddddddddddd 0\tapps/web/lib/server/forwarded-request-headers.ts',
    '100644 eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee 0\tdocs/notes.ts',
  ].join('\n');
  assert.deepEqual(selectSources(listing), ['apps/web/app/api/auth/me/route.ts']);
});

test('the repository itself passes', () => {
  const result = spawnSync(process.execPath, ['scripts/security/verify-forwarded-header-sanitization.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /unaccounted for\s+0/u);
});
