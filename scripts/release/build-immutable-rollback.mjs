#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  DATABASE_ROLLBACK_MODE,
  ROLLBACK_KIND,
  RELEASE_SCHEMA_VERSION,
  identityOf,
  readJson,
  validateRelease,
  validateRollback,
} from './immutable-release-lib.mjs';

function argsOf(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument sequence near ${key ?? '<end>'}`);
    args.set(key.slice(2), value);
  }
  return args;
}

function required(args, name) {
  const value = args.get(name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

const args = argsOf(process.argv.slice(2));
const current = await readJson(required(args, 'current'));
const target = await readJson(required(args, 'target'));
const output = required(args, 'output');
const createdAt = required(args, 'created-at');

for (const [label, manifest] of [['current', current], ['target', target]]) {
  const result = validateRelease(manifest);
  if (!result.valid) throw new Error(`${label} release manifest is invalid: ${result.errors.join('; ')}`);
}
if (current.manifestId === target.manifestId) throw new Error('Rollback target must differ from the current release manifest');
if (current.migrationSetDigest !== target.migrationSetDigest) {
  throw new Error('Rollback across migration-set changes is forbidden; use a forward fix or a separately accepted N-1 schema compatibility contour');
}

const payload = {
  kind: ROLLBACK_KIND,
  schemaVersion: RELEASE_SCHEMA_VERSION,
  repository: 'pachaninm-lab/pachanin-demo',
  createdAt,
  currentManifestId: current.manifestId,
  targetManifestId: target.manifestId,
  targetSourceCommit: target.sourceCommit,
  currentMigrationSetDigest: current.migrationSetDigest,
  targetMigrationSetDigest: target.migrationSetDigest,
  databaseRollbackMode: DATABASE_ROLLBACK_MODE,
  targetComponents: structuredClone(target.components),
  maturityBoundary: 'Rollback document generated and validated only; rollback is not executed, database down-migration is forbidden and no runtime recovery is claimed.',
};
const document = { ...payload, rollbackId: identityOf(payload) };
const result = validateRollback(document);
if (!result.valid) throw new Error(`Generated rollback document is invalid: ${result.errors.join('; ')}`);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
process.stdout.write(`${document.rollbackId}\n`);
