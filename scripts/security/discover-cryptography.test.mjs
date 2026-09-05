import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInventory,
  renderMarkdown,
  scanKeyMaterial,
  scanSource,
  trackedSourceFiles,
} from './discover-cryptography.mjs';

const SAMPLE = `
  import { createCipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'crypto';
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const digest = createHash('sha256').update(x).digest();
  const mac = createHmac('sha1', secret).update(counter).digest();
  const derived = hkdfSync('sha256', material, salt, info, 32);
  const nonce = randomBytes(12);
  const same = timingSafeEqual(a, b);
  const secretValue = requireSecret('JWT_SECRET');
  const other = process.env.GEKTA_PHONE_LOOKUP_PEPPER;
  const budget = process.env.AI_ASSISTANT_MAX_TOKENS;
`;

test('identifies each cryptographic operation class, not only the insecure ones', () => {
  const found = scanSource(SAMPLE);
  const byProbe = new Map(found.map((hit) => [hit.probe, hit.detail]));
  assert.equal(byProbe.get('encryption'), 'aes-256-gcm');
  assert.equal(byProbe.get('hash'), 'sha256');
  assert.equal(byProbe.get('mac'), 'sha1');
  assert.equal(byProbe.get('kdf-hkdf'), 'sha256');
  assert.ok(byProbe.has('csprng'));
  assert.ok(byProbe.has('constant-time'));
});

test('records the algorithm, because an inventory of calls without algorithms is not an inventory', () => {
  const inventory = buildInventory({ files: ['sample.ts'], readFile: () => SAMPLE });
  const mac = inventory.operations.find((op) => op.operation === 'mac');
  assert.equal(mac.sites, 1);
  assert.deepEqual(mac.algorithms.map((a) => a.algorithm), ['sha1']);
});

test('reports an absent operation as zero rather than omitting it', () => {
  const inventory = buildInventory({ files: ['sample.ts'], readFile: () => SAMPLE });
  const signing = inventory.operations.find((op) => op.operation === 'signing');
  assert.equal(signing.sites, 0);
  assert.deepEqual(signing.algorithms, []);
});

test('names key material and classifies configuration rather than dropping it', () => {
  const names = scanKeyMaterial(SAMPLE);
  assert.ok(names.includes('JWT_SECRET'));
  assert.ok(names.includes('GEKTA_PHONE_LOOKUP_PEPPER'));
  const inventory = buildInventory({ files: ['sample.ts'], readFile: () => SAMPLE });
  const byName = new Map(inventory.keyMaterial.map((key) => [key.name, key.kind]));
  assert.equal(byName.get('JWT_SECRET'), 'secret');
  assert.equal(byName.get('AI_ASSISTANT_MAX_TOKENS'), 'configuration');
});

test('never carries a key value into the artefact', () => {
  const withValue = "const k = process.env.JWT_SECRET || 'super-secret-literal-value';";
  const inventory = buildInventory({ files: ['s.ts'], readFile: () => withValue });
  const serialized = JSON.stringify(inventory) + renderMarkdown(inventory, { sourceSha: 'x' });
  assert.ok(!serialized.includes('super-secret-literal-value'));
});

test('states its own limits in the artefact', () => {
  const inventory = buildInventory({ files: [], readFile: () => null });
  assert.ok(inventory.limits.length >= 4);
  const markdown = renderMarkdown(inventory, { sourceSha: 'x' });
  assert.ok(markdown.includes('not a key-management policy'));
});

test('excludes tests, so the inventory describes what runs', () => {
  const files = trackedSourceFiles();
  assert.ok(files.length > 0);
  assert.ok(!files.some((path) => /\.spec\.ts$/u.test(path)));
  assert.ok(!files.some((path) => path.startsWith('apps/landing/')));
});

// The check that makes the inventory maintained rather than a one-off: the
// committed artefact must match what the scanner produces at this head.
test('committed inventory is not stale', () => {
  execFileSync('node', ['scripts/security/discover-cryptography.mjs', '/tmp/ci-inv.json', '/tmp/ci-inv.md'], {
    encoding: 'utf8',
  });
  const fresh = JSON.parse(readFileSync('/tmp/ci-inv.json', 'utf8'));
  const committed = JSON.parse(readFileSync('docs/security/cryptographic-inventory.json', 'utf8'));
  assert.deepEqual(
    fresh,
    committed,
    'docs/security/cryptographic-inventory.json is stale; run node scripts/security/discover-cryptography.mjs',
  );
});
