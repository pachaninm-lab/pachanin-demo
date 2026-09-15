import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMMENT, LITERAL, maskNonCode, matchParen, responseSites, declaredValues,
  exemptPathsFrom, routeUrl, isCatchAll, needsOwnHeader,
} from './verify-response-cache-policy.mjs';

/* ---------------- reading a header out of source ---------------- */

test('a header name written inside a string is still found', () => {
  // The bug this exists for: header names live in string literals, so masking
  // string bodies as "not code" reported every file in the repository as
  // setting no Cache-Control at all - a total absence that looked like a finding.
  const source = "return Response.json(x, { headers: { 'Cache-Control': 'no-store' } });";
  assert.deepEqual(declaredValues(source), ['no-store']);
});

test('a header named only in a comment is not a header that is set', () => {
  assert.deepEqual(declaredValues("// 'Cache-Control': 'no-store' would go here\n"), []);
  assert.deepEqual(declaredValues("/* 'cache-control': 'no-store' */\n"), []);
});

test('the mask separates comments from literal text', () => {
  const source = "// note\nconst s = 'text';";
  const mask = maskNonCode(source);
  assert.equal(mask[0], COMMENT);
  assert.equal(mask[source.indexOf('text')], LITERAL);
});

test("the outbound fetch cache option is not a response header", () => {
  // 33 route files carry `cache: 'no-store'` on a fetch they make. It governs
  // the Next data cache, not what the browser may store, and counting it is
  // how a file with no anti-caching header reads as covered.
  assert.deepEqual(declaredValues("await fetch(url, { cache: 'no-store' });"), []);
  assert.equal(responseSites("return Response.json(await fetch(u, { cache: 'no-store' }));")[0].noStore, false);
});

/* ---------------- finding every response ---------------- */

test('every kind of response construction is counted', () => {
  for (const call of ['new Response(', 'new NextResponse(', 'Response.json(', 'NextResponse.json(']) {
    const sites = responseSites(`return ${call}body, { headers: { 'Cache-Control': 'no-store' } });`);
    assert.equal(sites.length, 1, call);
    assert.equal(sites[0].noStore, true, call);
  }
});

test('a response with no header is reported, not skipped', () => {
  const sites = responseSites('return Response.json({ ok: true });');
  assert.equal(sites.length, 1);
  assert.equal(sites[0].noStore, false);
});

test('a header on a different response does not cover this one', () => {
  const source = [
    "if (a) return Response.json(x, { headers: { 'Cache-Control': 'no-store' } });",
    'return Response.json(y);',
  ].join('\n');
  const sites = responseSites(source);
  assert.deepEqual(sites.map((s) => s.noStore), [true, false]);
});

test('a brace or paren inside a template does not end the call early', () => {
  const source = 'return Response.json(`${a(")")}/b`, { headers: { "Cache-Control": "no-store" } });';
  assert.equal(responseSites(source)[0].noStore, true);
});

test('a response written in a comment is not a response', () => {
  assert.deepEqual(responseSites('// return Response.json(x);\n'), []);
});

/* ---------------- who may opt out ---------------- */

test('only a directive no-store does not already imply earns an exemption', () => {
  assert.equal(needsOwnHeader(['no-store']), false);
  assert.equal(needsOwnHeader(['no-store, no-cache, must-revalidate, private']), false);
  assert.equal(needsOwnHeader(['no-store, max-age=0']), false);
  // no-transform is the one that matters: it stops a proxy re-encoding a stream.
  assert.equal(needsOwnHeader(['no-store, no-transform']), true);
  assert.equal(needsOwnHeader(['no-cache, no-transform']), true);
});

test('the exempt list is read from the middleware, not restated here', () => {
  const source = [
    "const SELF_MANAGED_CACHE_CONTROL = new Set([\n  '/api/a',\n  '/api/b',\n]);",
    "const SELF_MANAGED_CACHE_CONTROL_SUBTREE = ['/api/proxy'];",
  ].join('\n');
  assert.deepEqual(exemptPathsFrom(source), { exact: ['/api/a', '/api/b'], subtree: ['/api/proxy'] });
});

test('a route file maps to the URL it answers on', () => {
  assert.equal(routeUrl('apps/web/app/api/deals/route.ts'), '/api/deals');
  assert.equal(routeUrl('apps/web/app/api/a/b/route.tsx'), '/api/a/b');
  assert.ok(isCatchAll('apps/web/app/api/proxy/[...path]/route.ts'));
  assert.ok(!isCatchAll('apps/web/app/api/deals/[id]/route.ts'));
});

/* ---------------- helpers ---------------- */

test('paren matching ignores parens inside text', () => {
  const source = 'f(")", x)';
  assert.equal(matchParen(source, maskNonCode(source), 1), source.length - 1);
});

/* ---------------- the gate as it actually runs ----------------
 *
 * The checks above hold the detector; these hold main(). Without them a
 * mutation that checked only the FIRST response in an exempt file passed every
 * test, because the real tree has no exempt file whose later response is
 * missing a header - a condition a mutation can walk past is not a condition.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const SCRIPT = resolve('scripts/security/verify-response-cache-policy.mjs');

const middlewareFixture = (exact = [], subtree = ['/api/proxy']) => `
const SELF_MANAGED_CACHE_CONTROL = new Set([
${exact.map((e) => `  '${e}',`).join('\n')}
]);
const SELF_MANAGED_CACHE_CONTROL_SUBTREE = [${subtree.map((e) => `'${e}'`).join(', ')}];
function applyApiCachePolicy(response, pathname) {
  response.headers.set('cache-control', 'no-store');
  return response;
}
export async function middleware(req) {
  return applyApiCachePolicy(await routeRequest(req), req.nextUrl.pathname);
}
`;

// The gate reads tracked files, so the fixture is a real repository.
function withFixture({ routes, middleware }, assertion) {
  const root = mkdtempSync(join(tmpdir(), 'response-cache-'));
  try {
    const write = (rel, body) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), body);
    };
    write('apps/web/middleware.ts', middleware ?? middlewareFixture());
    for (const [rel, body] of Object.entries(routes)) write(`apps/web/app/api/${rel}`, body);
    for (const args of [['init', '-q'], ['add', '-A']]) spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    const result = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: 'utf8' });
    assertion({ status: result.status, out: `${result.stdout}${result.stderr}` });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a route with no header of its own is covered by the central policy', () => {
  withFixture({ routes: { 'deals/route.ts': 'export async function GET() { return Response.json({}); }' } }, (r) => {
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /1 take Cache-Control: no-store from the central policy/u);
  });
});

test('an exempt route whose LATER response has no header fails', () => {
  // The case the real tree does not contain, and the reason this fixture exists.
  withFixture({
    middleware: middlewareFixture(['/api/stream']),
    routes: {
      'stream/route.ts': [
        "export async function GET() {",
        "  if (a) return Response.json(x, { headers: { 'Cache-Control': 'no-store, no-transform' } });",
        "  return Response.json({ late: true });",
        "}",
      ].join('\n'),
    },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /constructs a response with no no-store/u);
  });
});

test('a route needing no-transform that is not exempt fails', () => {
  withFixture({
    routes: { 'stream/route.ts': "export async function GET() { return new Response(s, { headers: { 'Cache-Control': 'no-store, no-transform' } }); }" },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /would drop, but is not exempt/u);
  });
});

test('a route exempted although a bare no-store loses it nothing fails', () => {
  withFixture({
    middleware: middlewareFixture(['/api/deals']),
    routes: { 'deals/route.ts': "export async function GET() { return Response.json(x, { headers: { 'Cache-Control': 'no-store' } }); }" },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /has nothing to lose by it/u);
  });
});

test('an exempt path matching no route is stale and fails', () => {
  withFixture({
    middleware: middlewareFixture(['/api/gone']),
    routes: { 'deals/route.ts': 'export async function GET() { return Response.json({}); }' },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /matches no route/u);
  });
});

test('unwiring the central policy fails even when every route looks fine', () => {
  withFixture({
    middleware: "const SELF_MANAGED_CACHE_CONTROL = new Set([]);\nconst SELF_MANAGED_CACHE_CONTROL_SUBTREE = [];\nexport async function middleware(req) { return routeRequest(req); }\n",
    routes: { 'deals/route.ts': 'export async function GET() { return Response.json({}); }' },
  }, (r) => {
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /central policy is no longer wired/u);
  });
});
