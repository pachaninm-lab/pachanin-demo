#!/usr/bin/env node
import { readJson, validateRelease, validateRollback, RELEASE_KIND, ROLLBACK_KIND } from './immutable-release-lib.mjs';

const path = process.argv[2];
if (!path) throw new Error('Usage: validate-immutable-release.mjs <manifest-or-rollback.json>');

const document = await readJson(path);
const result = document.kind === RELEASE_KIND
  ? validateRelease(document)
  : document.kind === ROLLBACK_KIND
    ? validateRollback(document)
    : { valid: false, errors: [`Unsupported document kind: ${document.kind}`] };

const report = {
  path,
  kind: document.kind ?? null,
  valid: result.valid,
  identity: document.manifestId ?? document.rollbackId ?? null,
  expectedIdentity: result.expectedIdentity ?? null,
  errors: result.errors,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!result.valid) process.exitCode = 1;
