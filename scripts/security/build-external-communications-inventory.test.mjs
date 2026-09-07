import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  authenticationMismatches,
  AUTHENTICATION_KINDS,
  buildInventory,
  callArguments,
  discoverOutboundModules,
  INVENTORY_JSON,
  INVENTORY_MD,
  measureModule,
  outboundBindings,
  OUTBOUND_NODE_IMPORTS,
  reconcile,
  REGISTRY_PATH,
  renderMarkdown,
  trackedSources,
} from './build-external-communications-inventory.mjs';

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));

test('every module that talks to an external system is registered, and every registration is live', () => {
  const { unregistered, phantom } = reconcile(discoverOutboundModules(), registry);
  assert.deepEqual(unregistered, [], 'an outbound call must not go unrecorded');
  assert.deepEqual(phantom, [], 'a registry entry must still describe a real outbound call');
});

test('the committed inventory is what the generator produces from the current tree', () => {
  // A hand-edited or stale inventory is worse than none: it is documentation that
  // reads as evidence while describing a tree that no longer exists.
  const inventory = buildInventory(discoverOutboundModules(), registry);
  const committed = JSON.parse(readFileSync(INVENTORY_JSON, 'utf8'));

  assert.deepEqual(committed.systems, inventory.systems);
  assert.equal(committed.scannedFiles, trackedSources().length);
  assert.equal(readFileSync(INVENTORY_MD, 'utf8'), renderMarkdown(inventory));
});

test('a declared authentication posture the source does not carry fails the build', () => {
  const inventory = buildInventory(discoverOutboundModules(), registry);
  assert.deepEqual(authenticationMismatches(inventory.systems), []);

  // Claiming a header where the source has none, and the reverse, both fail.
  assert.equal(
    authenticationMismatches([{ id: 'x', authenticationKind: 'header', carriesAuthentication: false }]).length,
    1,
  );
  assert.equal(
    authenticationMismatches([{ id: 'x', authenticationKind: 'none', carriesAuthentication: true }]).length,
    1,
  );
  assert.equal(
    authenticationMismatches([{ id: 'x', authenticationKind: 'invented', carriesAuthentication: false }]).length,
    1,
  );
  for (const kind of AUTHENTICATION_KINDS) {
    assert.equal(
      authenticationMismatches([{ id: 'x', authenticationKind: kind, carriesAuthentication: kind === 'header' }]).length,
      0,
    );
  }
});

test('the registry answers what a scanner cannot derive, for every system', () => {
  assert.ok(registry.systems.length > 0);
  for (const system of registry.systems) {
    assert.ok(system.id && system.name, 'every system is named');
    assert.ok(Array.isArray(system.modules) && system.modules.length > 0);
    assert.ok(String(system.need || '').trim().length > 20, `${system.id} must say what it is talked to for`);
    assert.ok(String(system.onFailure || '').trim().length > 20, `${system.id} must say what happens when it fails`);
    assert.ok(String(system.dataClass || '').trim(), `${system.id} must state a data class`);
    assert.equal(typeof system.degradesSilently, 'boolean');
    assert.ok(AUTHENTICATION_KINDS.has(system.authenticationKind), `${system.id} has a known authentication kind`);
  }
});

test('a dependency that fails without surfacing an error is recorded as such', () => {
  // The ML scoring client returns null rather than throwing, so a caller sees
  // "no score" and not "the scorer is down". That is a design choice, and it has
  // to be visible in the inventory rather than discovered by reading the client.
  const inventory = buildInventory(discoverOutboundModules(), registry);
  const ml = inventory.systems.find((system) => system.id === 'ml-scoring');
  assert.ok(ml, 'the ML scoring client is inventoried');
  assert.equal(ml.degradesSilently, true);
  assert.equal(ml.authenticationKind, 'none');
  assert.match(readFileSync(INVENTORY_MD, 'utf8'), /Деградирует молча/u);
});

test('the scan count agrees with an independent grep, so discovery cannot silently miss files', () => {
  const files = trackedSources();
  const grepped = Number(execFileSync(
    'bash',
    [
      '-c',
      `printf '%s\\0' ${files.map((f) => `'${f}'`).join(' ')} | xargs -0 grep -oE '(^|[^.[:alnum:]_$])fetch[[:space:]]*\\(' | wc -l`,
    ],
    { encoding: 'utf8' },
  ).trim());

  const discovered = discoverOutboundModules();
  const counted = [...discovered.values()].reduce((total, entry) => total + entry.fetchCallSites, 0);
  assert.equal(counted, grepped, 'the fetch count must agree with an independent grep');
  assert.ok(counted > 0, 'a scan finding no outbound call at all is not evidence of anything');
});

test('argument extraction balances parentheses and ignores punctuation inside strings', () => {
  const long = [
    'await fetch(url, {',
    ...Array.from({ length: 40 }, (_, index) => `  header${index}: "v",`),
    '  signal: AbortSignal.timeout(1000),',
    '});',
  ].join('\n');
  assert.ok(callArguments(long, long.indexOf('(')).includes('AbortSignal.timeout'));
  assert.equal(measureModule(long).everyFetchCallBounded, true);

  const quoted = 'await fetch(`${base}/v1/a)b`, { headers: { x: "close ) paren" }, signal });';
  assert.ok(callArguments(quoted, quoted.indexOf('(')).includes('signal'));

  // A method named fetch on some object of ours is not an outbound call.
  assert.equal(measureModule('await cache.fetch(key);'), null);
  assert.equal(measureModule('const prefetch = 1;'), null);
});

test('fetch is not the only outbound transport the scan can see', () => {
  // The first version of this inventory looked only for `fetch(` and therefore
  // missed two real external channels: the SSRF-guarded partner webhook request,
  // which goes through request() from node:https, and outbound mail, which opens a
  // socket with connect() from node:net/node:tls. An inventory that cannot see a
  // transport is a document asserting a completeness it does not have.
  const guard = measureModule([
    "import { request as httpRequest } from 'node:http';",
    "import { request as httpsRequest } from 'node:https';",
    'const send = isHttps ? httpsRequest : httpRequest;',
  ].join('\n'));
  assert.ok(guard, 'a module importing an outbound node transport is an outbound module');
  assert.deepEqual(guard.transports, ['httpRequest', 'httpsRequest']);
  assert.equal(guard.fetchCallSites, 0);

  const smtp = measureModule([
    "import { connect as connectTcp } from 'node:net';",
    "import { connect as connectTls } from 'node:tls';",
  ].join('\n'));
  assert.deepEqual(smtp.transports, ['connectTcp', 'connectTls']);
});

test('discovery keys on the import, which cannot be aliased away, not on a call-site name', () => {
  // safe-outbound-request.ts assigns its transport to a variable before calling it,
  // so a scan counting calls to the imported name finds nothing there.
  const aliased = "import { request as httpsRequest } from 'node:https';\nconst send = httpsRequest;\nsend(options);";
  assert.deepEqual([...outboundBindings(aliased)], ['httpsRequest']);
  assert.ok(measureModule(aliased));
});

test('address parsing and inbound servers are not outbound transports', () => {
  // isIP parses an address; createServer accepts incoming connections. Counting
  // either would inflate the inventory with channels that do not exist.
  assert.equal(measureModule("import { isIP } from 'node:net';\nconst v = isIP(host);"), null);
  assert.equal(measureModule("import { createServer } from 'node:http';\ncreateServer(handler);"), null);
  assert.equal(measureModule("import type { Socket } from 'node:net';"), null);
});

test('the user-supplied destination case V13.1.1 names explicitly is recorded', () => {
  // The requirement asks for external services relied upon AND "cases where an end
  // user might be able to provide an external location to which the application will
  // then connect". The second clause is a separate obligation, not a restatement.
  const inventory = buildInventory(discoverOutboundModules(), registry);
  const userSupplied = inventory.systems.filter((system) => system.userSuppliedDestination);
  assert.ok(userSupplied.length > 0, 'the partner webhook destination must be recorded as user-supplied');
  for (const system of userSupplied) {
    assert.ok(String(system.authentication || '').trim().length > 20, `${system.id} must state its destination control`);
  }
  assert.match(readFileSync(INVENTORY_MD, 'utf8'), /## Адреса, которые задаёт пользователь/u);
});

test('every outbound node transport the scan knows about is a connection opener', () => {
  for (const [module, names] of Object.entries(OUTBOUND_NODE_IMPORTS)) {
    assert.match(module, /^node:(?:http|https|net|tls)$/u);
    assert.ok(names.length > 0);
    for (const name of names) {
      assert.ok(
        ['request', 'get', 'connect', 'createConnection'].includes(name),
        `${name} must open a connection, not parse or listen`,
      );
    }
  }
});
