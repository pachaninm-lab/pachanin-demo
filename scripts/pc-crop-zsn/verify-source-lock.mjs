#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const prefix = 'docs/platform-v7/crop-platform/efgis-zsn-api-document.source-lock';
const expectedSha256 = '8d9b2fdd8a5c560347e08b8bd5bfd118a163b3f1636dbe4ff63bfc9a5742cdd7';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameKeys(actual, expected, context) {
  assert(JSON.stringify(Object.keys(actual).sort()) === JSON.stringify([...expected].sort()), `${context} shape mismatch`);
}

export function verifySourceLock(lock, schema, registry, artifactBytes) {
  assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'source-lock schema draft mismatch');
  assert(schema.additionalProperties === false, 'source-lock schema must reject extra properties');
  sameKeys(lock, schema.required, 'source lock');
  sameKeys(schema.properties, schema.required, 'source-lock schema');
  for (const [key, rule] of Object.entries(schema.properties)) {
    if (Object.hasOwn(rule, 'const')) assert(lock[key] === rule.const, `${key} differs from pinned schema`);
    if (rule.type === 'null') assert(lock[key] === null, `${key} must remain unknown`);
    if (rule.type === 'string') assert(typeof lock[key] === 'string' && lock[key].length >= (rule.minLength ?? 0), `${key} invalid`);
  }
  assert(!Number.isNaN(Date.parse(lock.retrievedAt)) && /Z$/u.test(lock.retrievedAt), 'retrieval timestamp invalid');
  assert(lock.artifactSha256 === expectedSha256, 'official PDF hash drift');
  assert(lock.retrievalMethod.includes('temporary downloader URL'), 'temporary artifact locator must not become authority');

  const boundaryRules = schema.properties.boundaries;
  assert(boundaryRules.additionalProperties === false, 'boundary schema must reject extra properties');
  sameKeys(lock.boundaries, boundaryRules.required, 'source-lock boundaries');
  sameKeys(boundaryRules.properties, boundaryRules.required, 'boundary schema');
  for (const [key, rule] of Object.entries(boundaryRules.properties)) {
    assert(lock.boundaries[key] === rule.const, `source-lock boundary ${key} drifted`);
  }

  assert(registry.registryVersion === lock.existingRegistryVersion, 'accepted registry version changed; govern its successor first');
  assert(registry.operationalStatus === 'NOT_ATTESTED', 'registry operational status elevated');
  const zsn = registry.systems.find((system) => system.systemCode === lock.systemCode);
  assert(zsn && zsn.responsibleAuthority === lock.operator, 'EFGIS ZSN operator binding mismatch');
  assert(zsn.integrationStatus === 'NOT_ASSESSED' && zsn.apiContract.status === 'NOT_ASSESSED', 'unversioned document is not a pinned API contract');
  assert(zsn.apiContract.version === null && zsn.apiContract.artifacts.length === 0, 'legacy registry must not imply a versioned contract');
  assert(zsn.platformState === 'DISABLED' && !zsn.platformReadEnabled && !zsn.platformWriteEnabled, 'ZSN runtime enablement requires separate authority');
  assert(zsn.credentialReference === null && zsn.signatureReference === null, 'ZSN secret or signature reference is not attested');

  if (artifactBytes !== undefined) {
    assert(Buffer.isBuffer(artifactBytes), 'artifact must be raw PDF bytes');
    assert(artifactBytes.length === lock.artifactSizeBytes, 'official PDF size mismatch');
    assert(artifactBytes.subarray(0, 5).toString('ascii') === '%PDF-', 'artifact is not a PDF');
    assert(createHash('sha256').update(artifactBytes).digest('hex') === lock.artifactSha256, 'official PDF hash mismatch');
  }
  return { status: 'PASS', systemCode: lock.systemCode, sourceSha256: lock.artifactSha256, contractVersion: null, runtimeEnabled: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lock = JSON.parse(readFileSync(resolve(root, `${prefix}.json`), 'utf8'));
  const schema = JSON.parse(readFileSync(resolve(root, `${prefix}.schema.json`), 'utf8'));
  const registry = JSON.parse(readFileSync(resolve(root, 'docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json'), 'utf8'));
  const artifactIndex = process.argv.indexOf('--artifact');
  assert(artifactIndex < 0 || process.argv[artifactIndex + 1], '--artifact requires a PDF path');
  const artifact = artifactIndex < 0 ? undefined : readFileSync(resolve(process.argv[artifactIndex + 1]));
  process.stdout.write(`${JSON.stringify(verifySourceLock(lock, schema, registry, artifact))}\n`);
}
