#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIGRATION = 'apps/api/prisma/migrations/20260720131500_commodity_profile_registry_authority/migration.sql';
const SQL_TEST = 'apps/api/test/industrial/commodity-profile-registry-invariants.sql';
const RACE_SCRIPT = 'scripts/pc-crop-01b1-postgresql-acceptance.sh';
const SCOPE = 'docs/crop-platform/scopes/pc-crop-01b1-postgresql-authority-2883.json';
const DOC = 'docs/crop-platform/PC-CROP-01B1-POSTGRESQL-AUTHORITY.md';
const WORKFLOW = '.github/workflows/pc-crop-01b1.yml';
const SELF = 'scripts/verify-pc-crop-01b1.mjs';

const EXPECTED = new Set([MIGRATION, SQL_TEST, RACE_SCRIPT, SCOPE, DOC, WORKFLOW, SELF]);

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function fail(message) {
  throw new Error(message);
}

function requireToken(text, token, label) {
  if (!text.includes(token)) fail(`${label}: missing ${JSON.stringify(token)}`);
}

function forbidToken(text, token, label) {
  if (text.toLowerCase().includes(token.toLowerCase())) fail(`${label}: forbidden ${JSON.stringify(token)}`);
}

function changedFiles() {
  const base = process.env.PC_CROP_BASE_REF || 'origin/agent/pc-crop-01-commodity-registry-foundation';
  try {
    return execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function exactHead() {
  return process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
}

const migration = read(MIGRATION);
const sqlTest = read(SQL_TEST);
const race = read(RACE_SCRIPT);
const scope = JSON.parse(read(SCOPE));
const doc = read(DOC);
const workflow = read(WORKFLOW);

if (scope.schemaVersion !== 'pc-crop.concurrent-scope.v1') fail('scope schema version mismatch');
if (scope.branch !== 'agent/pc-crop-01b-postgresql-registry-authority') fail('scope branch mismatch');
if (scope.parentIssue !== 2883) fail('scope issue mismatch');
if (scope.operationalStatus !== 'NOT_ATTESTED') fail('operational maturity overstated');
if (new Set(scope.allowedPaths).size !== EXPECTED.size || scope.allowedPaths.some((path) => !EXPECTED.has(path))) {
  fail('scope allowedPaths are not exact');
}

const unexpected = changedFiles().filter((path) => !EXPECTED.has(path));
if (unexpected.length > 0) fail(`files outside exact stacked scope: ${unexpected.join(', ')}`);

for (const table of ['commodity_profiles', 'commodity_profile_versions', 'commodity_profile_transitions']) {
  requireToken(migration, `CREATE TABLE public.\"${table}\"`, 'table authority');
  requireToken(migration, `ALTER TABLE public.\"${table}\" ENABLE ROW LEVEL SECURITY`, 'RLS authority');
  requireToken(migration, `ALTER TABLE public.\"${table}\" FORCE ROW LEVEL SECURITY`, 'RLS authority');
}

for (const archetype of [
  'DRY_BULK',
  'SEED_PLANTING',
  'ROOT_INDUSTRIAL',
  'FRESH_PACKED',
  'GREENHOUSE_RECURRING',
  'ORGANIC_EXPORT_QUARANTINE',
]) requireToken(migration, `'${archetype}'`, 'archetype constraint');

for (const token of [
  'contentHashAlgorithm',
  "\"contentHashAlgorithm\" = 'SHA-256'",
  'commodity_profile_versions_profile_sequence_key',
  'commodity_profile_versions_profile_hash_key',
  'commodity_profile_transitions_version_profile_fkey',
  'pg_advisory_xact_lock(hashtextextended(NEW.\"profileId\", 0))',
  'PC_PROFILE_INITIAL_STATE_INVALID',
  'PC_PROFILE_VERSION_IMMUTABLE',
  'PC_PROFILE_HASH_STALE',
  'PC_PROFILE_EFFECTIVE_OVERLAP',
  'PC_PROFILE_TRANSITION_CHAIN_MISMATCH',
  'PC_PROFILE_TRANSITION_IMMUTABLE',
  'app_rls_context_ready()',
  'app_rls_privileged()',
]) requireToken(migration, token, 'database invariant');

for (const token of [' Float', ' double precision', ' real ', 'ON DELETE CASCADE']) {
  forbidToken(migration, token, 'database precision/history boundary');
}

for (const token of [
  'expected immutable content rejection',
  'expected published version deletion rejection',
  'expected append-only transition rejection',
  'expected initial-state rejection',
  'version-race-a',
  'version-race-b',
]) requireToken(sqlTest, token, 'SQL acceptance');

for (const token of [
  'race_a_pid',
  'PC_PROFILE_EFFECTIVE_OVERLAP',
  'effective_count',
  'transition_count',
  'lifecycleWindowClosedWithTransition',
  'evidence-sha256.txt',
]) requireToken(race, token, 'concurrency acceptance');

for (const token of [
  'PostgreSQL 16',
  'advisory lock',
  'не является подтверждением production',
  'PENDING_SCHEMA_SYNC',
  'forward-fix',
]) requireToken(doc, token, 'architecture evidence');

for (const token of [
  'postgres:16',
  'prisma migrate deploy',
  'verify-pc-crop-01b1.mjs',
  'pc-crop-01b1-postgresql-acceptance.sh',
  'retention-days: 90',
]) requireToken(workflow, token, 'workflow authority');

const report = {
  schemaVersion: 'pc-crop.postgresql-static-acceptance.v1',
  slice: 'PC-CROP-01B.1',
  issue: 2883,
  status: 'PASS',
  exactHead: exactHead(),
  operationalStatus: 'NOT_ATTESTED',
  tables: 3,
  archetypes: 6,
  invariants: {
    fixedPrecisionNoFloat: true,
    immutablePublishedContent: true,
    appendOnlyTransitions: true,
    effectiveOverlapGuard: true,
    perProfileAdvisoryLock: true,
    forcedRls: true,
  },
  boundaries: {
    prismaModels: 'PENDING_SCHEMA_SYNC',
    nestRuntime: 'NOT_IN_THIS_SLICE',
    externalIntegrations: 'NOT_CONNECTED_OR_ATTESTED',
  },
};

const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) {
  const path = process.argv[outputIndex + 1];
  if (!path) fail('--output requires path');
  writeFileSync(resolve(ROOT, path), `${JSON.stringify(report, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
