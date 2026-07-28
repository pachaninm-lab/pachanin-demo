#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const allowedPaths = [
  '.github/workflows/tai-ap-14f1a.yml',
  'apps/tai/tai/migrations/0019_public_official_corpus.sql',
  'apps/tai/tai/migrations/manifest.json',
  'apps/tai/tai/postgres_public_official_corpus.py',
  'apps/tai/tai/public_official_corpus.py',
  'apps/tai/tests/test_migration_manifest.py',
  'apps/tai/tests/test_postgres_public_official_corpus.py',
  'apps/tai/tests/test_public_official_corpus.py',
  'docs/platform-v7/autopilot/scopes/tai-ap-14f1a-3345.json',
  'scripts/tai-ap-14f1a/verify.mjs',
].sort();

function fail(message) {
  throw new Error(`TAI_AP_14F1A:${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function text(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

const manifest = JSON.parse(text('apps/tai/tai/migrations/manifest.json'));
assert(
  manifest.schema_version === 'tai.migration.manifest.v1',
  'migration manifest schema changed',
);
assert(Array.isArray(manifest.migrations), 'migration manifest must contain migrations');
const versions = manifest.migrations.map((item) => item.version);
assert(
  JSON.stringify(versions)
    === JSON.stringify(Array.from({ length: 20 }, (_, index) => index + 1)),
  'migration versions must be exactly 1..20',
);
const latest = manifest.migrations.at(-1);
assert(
  latest?.path === '0019_public_official_corpus.sql' && latest.version === 20,
  'AP-14F1A migration must be version 20',
);

const sql = text('apps/tai/tai/migrations/0019_public_official_corpus.sql');
for (const token of [
  'tai_public_corpus_source_admissions',
  "data_plane = 'PUBLIC_OFFICIAL'",
  'tai_public_corpus_artifacts',
  'tai_public_corpus_quarantine',
  'tai_public_corpus_snapshots',
  'tai_public_corpus_chunks',
  'tai_activate_public_corpus_snapshot',
  'tai_withdraw_public_corpus_source',
  'tai_active_public_corpus_chunks_v1',
  'tai_public_corpus_one_active_snapshot_idx',
  'manifest does not match persisted chunks',
  'contains quarantined material',
  'chunk.valid_until > clock_timestamp()',
  'artifact.freshness_due_at > clock_timestamp()',
  'admission.rights_review_due_at > clock_timestamp()',
]) assert(sql.includes(token), `migration missing ${token}`);
assert(
  !/DROP\s+(TABLE|SCHEMA)|TRUNCATE|CASCADE\s*;/iu.test(sql),
  'destructive SQL is forbidden',
);

const domain = text('apps/tai/tai/public_official_corpus.py');
for (const token of [
  'class PublicSourceAdmission',
  'class PublicArtifactProvenance',
  'class PublicOfficialCorpusBuilder',
  'tenant_id=None',
  'artifact source admission is withdrawn or rights-expired',
  'artifact rights decision does not match admission',
]) assert(domain.includes(token), `domain authority missing ${token}`);

const repository = text('apps/tai/tai/postgres_public_official_corpus.py');
for (const token of [
  'class PostgreSQLPublicOfficialCorpusAuthority',
  'from psycopg.types.json import Jsonb',
  'only an ADMITTED source may enter the corpus authority',
  'SET source_id = EXCLUDED.source_id',
  'rights_review_due_at =',
  'SET artifact_sha256 = EXCLUDED.artifact_sha256',
  'freshness_due_at = EXCLUDED.freshness_due_at',
  'Jsonb(list(snapshot.source_ids))',
  'Jsonb(list(snapshot.artifact_sha256s))',
  'tai_activate_public_corpus_snapshot',
  'tai_withdraw_public_corpus_source',
  'tai_active_public_corpus_chunks_v1',
]) assert(repository.includes(token), `PostgreSQL authority missing ${token}`);
assert(
  !repository.includes('SET status = EXCLUDED.status'),
  'source replay may not revive a withdrawn admission',
);
assert(
  !repository.includes('SET observed_at = EXCLUDED.observed_at'),
  'artifact replay may not rewrite observation provenance',
);
assert(
  !repository.includes('SET freshness_due_at = EXCLUDED.freshness_due_at'),
  'artifact replay may not silently extend freshness',
);

for (const path of [
  'apps/tai/tai/public_official_corpus.py',
  'apps/tai/tai/postgres_public_official_corpus.py',
]) {
  const source = text(path);
  assert(
    !/\b(requests|httpx|socket|subprocess|urllib\.request)\b/u.test(source),
    `${path} may not perform network or process execution`,
  );
  assert(
    !/(password|private[_-]?key|access[_-]?key|secret[_-]?key)\s*=/iu.test(source),
    `${path} may not contain credential material`,
  );
}

const tests = `${text('apps/tai/tests/test_public_official_corpus.py')}\n${text('apps/tai/tests/test_postgres_public_official_corpus.py')}`;
for (const token of [
  'withdrawn or rights-expired',
  'stale or not yet effective',
  'rights decision',
  'chunk identity conflicts',
  'tenant_id is None',
  'test_real_postgresql_blocks_silent_extension_and_withdrawal_revival',
  'manifest does not match persisted chunks',
  'PROMPT_INJECTION',
]) assert(tests.includes(token), `negative regression missing ${token}`);

const workflow = text('.github/workflows/tai-ap-14f1a.yml');
assert(
  workflow.includes(
    'ghcr.io/pachaninm-lab/ci-postgres@sha256:'
      + '57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777',
  ),
  'profile workflow must use the canonical mirrored PostgreSQL digest',
);

let changedPaths = [];
const scopeIndex = process.argv.indexOf('--scope-guard');
if (scopeIndex !== -1) {
  const base = process.argv[scopeIndex + 1];
  assert(base, '--scope-guard requires a base ref');
  git('merge-base', '--is-ancestor', base, 'HEAD');
  changedPaths = git('diff', '--name-only', `${base}...HEAD`)
    .split('\n')
    .filter(Boolean)
    .sort();
  assert(
    JSON.stringify(changedPaths) === JSON.stringify(allowedPaths),
    `scope mismatch: ${changedPaths.join(', ')}`,
  );
}

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  slice: 'TAI-AP-14F1A',
  issue: 3345,
  operationalStatus: 'NOT_ATTESTED',
  productionHosting: 'REG_RU_VPS_ONLY',
  counts: {
    changedPaths: changedPaths.length,
    migrationVersion: latest.version,
    dataPlanesAdmitted: 1,
    quarantineReasons: 12,
    realPostgresqlExploitCases: 6,
  },
  boundaries: {
    networkFetch: false,
    realCorpusBytes: false,
    tenantLiveData: false,
    contractedData: false,
    credentials: false,
    modelWeights: false,
    runtimeActivation: false,
    productionDeployment: false,
  },
}, null, 2)}\n`);
