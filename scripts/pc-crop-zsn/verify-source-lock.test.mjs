import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { verifySourceLock } from './verify-source-lock.mjs';

const root = resolve(import.meta.dirname, '../..');
const base = 'docs/platform-v7/crop-platform/efgis-zsn-api-document.source-lock';
const lock = JSON.parse(readFileSync(resolve(root, `${base}.json`), 'utf8'));
const schema = JSON.parse(readFileSync(resolve(root, `${base}.schema.json`), 'utf8'));
const registry = JSON.parse(readFileSync(resolve(root, 'docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json'), 'utf8'));
const registryBytes = readFileSync(resolve(root, 'docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json'));

test('pins the public operator document without promoting access or API version', () => {
  assert.deepEqual(verifySourceLock(lock, schema, registry), {
    status: 'PASS', systemCode: 'EFGIS_ZSN', sourceSha256: lock.artifactSha256, contractVersion: null, runtimeEnabled: false,
  });
});

test('rejects altered artifact, invented version and enabled runtime', () => {
  assert.throws(() => verifySourceLock(lock, schema, registry, Buffer.from('%PDF-false')), /size mismatch/);
  assert.throws(() => verifySourceLock({ ...lock, declaredContractVersion: '1.0' }, schema, registry), /must remain unknown/);
  assert.throws(() => verifySourceLock({ ...lock, boundaries: { ...lock.boundaries, platformReadEnabled: true } }, schema, registry), /boundary platformReadEnabled drifted/);
  assert.throws(() => verifySourceLock(lock, schema, { ...registry, systems: registry.systems.map((system) => system.systemCode === 'EFGIS_ZSN' ? { ...system, platformReadEnabled: true } : system) }), /runtime enablement/);
});

test('rejects coordinated schema and source changes that would promote document evidence', () => {
  const alteredSchema = structuredClone(schema);
  alteredSchema.properties.status.const = 'CONTRACT_PINNED';
  alteredSchema.properties.boundaries.properties.platformReadEnabled.const = true;
  const alteredLock = { ...lock, status: 'CONTRACT_PINNED', boundaries: { ...lock.boundaries, platformReadEnabled: true } };
  assert.throws(() => verifySourceLock(alteredLock, alteredSchema, registry), /independent source truth status/);
  assert.throws(() => verifySourceLock({ ...lock, boundaries: alteredLock.boundaries }, alteredSchema, registry), /status differs from pinned schema/);
});

test('rejects invalid UTC dates and historical registry byte drift', () => {
  for (const retrievedAt of ['2026-09-24Z', '2026-02-31T13:38:26Z', '2026-09-24T25:38:26Z']) {
    assert.throws(() => verifySourceLock({ ...lock, retrievedAt }, schema, registry), /retrieval timestamp invalid/);
  }
  assert.throws(() => verifySourceLock(lock, schema, registry, undefined, Buffer.from(`${registryBytes.toString('utf8')} `)), /accepted registry bytes drifted/);
});
