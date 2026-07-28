#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const scopePath = 'docs/platform-v7/autopilot/scopes/tai-ap-14f1a-3345.json';
const allowedPaths = [
  '.github/workflows/tai-ap-14f1a.yml',
  'apps/tai/tai/migrations/0019_public_official_corpus.sql',
  'apps/tai/tai/migrations/0020_public_official_corpus_audit_authority.sql',
  'apps/tai/tai/migrations/manifest.json',
  'apps/tai/tai/postgres_public_official_corpus.py',
  'apps/tai/tai/public_official_corpus.py',
  'apps/tai/tests/test_migration_manifest.py',
  'apps/tai/tests/test_postgres_public_official_corpus.py',
  'apps/tai/tests/test_public_official_corpus.py',
  scopePath,
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

const scope = JSON.parse(text(scopePath));
assert(scope.schemaVersion === 'platform-v7.concurrent-scope.v1', 'scope schema changed');
assert(scope.branch === 'agent/tai-ap-14f1a-exact-main-3345', 'scope branch mismatch');
assert(scope.status === 'active', 'scope must remain active');
assert(scope.issue === 3345, 'scope issue mismatch');
assert(
  scope.baseCommit === 'fcd0a372fb3a94ba36408479bd1b18f33b16c4e8',
  'scope exact-main base changed',
);
assert(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope hosting boundary changed');
assert(scope.operationalStatus === 'NOT_ATTESTED', 'scope maturity boundary changed');
assert(Array.isArray(scope.allowedPaths), 'scope allowedPaths must be an array');
assert(
  JSON.stringify([...scope.allowedPaths].sort()) === JSON.stringify(allowedPaths),
  'scope allowed paths changed',
);
assert(Object.values(scope.boundaries).every(Boolean), 'all scope boundaries must remain enabled');
assert(scope.acceptance.exactHeadRequired === true, 'exact-head acceptance is required');
assert(scope.acceptance.exactMainRequired === true, 'exact-main acceptance is required');
assert(
  scope.acceptance.exactMainCommitStatusRequired === true,
  'observable exact-main commit status is required',
);
assert(scope.acceptance.mergeExpectedHeadRequired === true, 'expected-head merge is required');
assert(scope.acceptance.reviewThreadsRequired === 0, 'review thread boundary changed');
assert(scope.acceptance.changedPathCount === 11, 'governed path count changed');
assert(scope.acceptance.migrationVersion === 21, 'scope migration version changed');
assert(scope.acceptance.operationalStatus === 'NOT_ATTESTED', 'scope status changed');

const manifest = JSON.parse(text('apps/tai/tai/migrations/manifest.json'));
assert(
  manifest.schema_version === 'tai.migration.manifest.v1',
  'migration manifest schema changed',
);
assert(Array.isArray(manifest.migrations), 'migration manifest must contain migrations');
const versions = manifest.migrations.map((item) => item.version);
assert(
  JSON.stringify(versions)
    === JSON.stringify(Array.from({ length: 21 }, (_, index) => index + 1)),
  'migration versions must be exactly 1..21',
);
const latest = manifest.migrations.at(-1);
assert(
  latest?.path === '0020_public_official_corpus_audit_authority.sql'
    && latest.version === 21,
  'AP-14F1A immutable audit migration must be version 21',
);

const corpusSql = text('apps/tai/tai/migrations/0019_public_official_corpus.sql');
for (const token of [
  'tai_public_corpus_source_admissions',
  "data_plane = 'PUBLIC_OFFICIAL'",
  'tai_public_corpus_artifacts',
  'tai_public_corpus_quarantine',
  'tai_public_corpus_snapshots',
  'tai_public_corpus_chunks',
  'tai_public_corpus_audit',
  'tai_activate_public_corpus_snapshot',
  'tai_withdraw_public_corpus_source',
  'tai_active_public_corpus_chunks_v1',
  'tai_public_corpus_one_active_snapshot_idx',
  'manifest does not match persisted chunks',
  'contains quarantined material',
  'chunk.valid_until > clock_timestamp()',
  'artifact.freshness_due_at > clock_timestamp()',
  'admission.rights_review_due_at > clock_timestamp()',
]) assert(corpusSql.includes(token), `corpus migration missing ${token}`);

const auditSql = text(
  'apps/tai/tai/migrations/0020_public_official_corpus_audit_authority.sql',
);
for (const token of [
  'SNAPSHOT_CREATED',
  'ARTIFACT_QUARANTINED',
  'tai_public_corpus_audit_immutable_guard',
  'tai_public_corpus_audit_immutable',
  'BEFORE UPDATE OR DELETE',
  "RAISE EXCEPTION 'tai_public_corpus_audit is immutable'",
]) assert(auditSql.includes(token), `audit migration missing ${token}`);
for (const sql of [corpusSql, auditSql]) {
  assert(
    !/DROP\s+(TABLE|SCHEMA)|TRUNCATE|CASCADE\s*;/iu.test(sql),
    'destructive SQL is forbidden',
  );
}

const domain = text('apps/tai/tai/public_official_corpus.py');
for (const token of [
  'class AuthorityAuditContext',
  'class PublicSourceAdmission',
  'class PublicArtifactProvenance',
  'class PublicOfficialCorpusBuilder',
  'audit reason_code must satisfy the governed code contract',
  'tenant_id=None',
  'artifact source admission is withdrawn or rights-expired',
  'artifact rights decision does not match admission',
]) assert(domain.includes(token), `domain authority missing ${token}`);

const repository = text('apps/tai/tai/postgres_public_official_corpus.py');
for (const token of [
  'class PostgreSQLPublicOfficialCorpusAuthority',
  'AuthorityAuditContext',
  'from psycopg.types.json import Jsonb',
  'only an ADMITTED source may enter the corpus authority',
  'SET source_id = EXCLUDED.source_id',
  'SET artifact_sha256 = EXCLUDED.artifact_sha256',
  'Jsonb(list(snapshot.source_ids))',
  'Jsonb(list(snapshot.artifact_sha256s))',
  'def quarantine(',
  'def release_quarantine(',
  'release_audit_sha256 = %s',
  'def _insert_audit(',
  'INSERT INTO tai_public_corpus_audit',
  'audit event conflicts with immutable authority',
  'SOURCE_ADMITTED',
  'ARTIFACT_ADMITTED',
  'SNAPSHOT_CREATED',
  'SNAPSHOT_ACTIVATED',
  'ARTIFACT_QUARANTINED',
  'QUARANTINE_RELEASED',
  'SOURCE_WITHDRAWN',
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
  'test_audit_context_is_normalized_and_fail_closed',
  'test_audit_failure_rolls_back_source_mutation',
  'test_snapshot_chunk_conflict_rolls_back_without_audit',
  'test_real_postgresql_mutations_are_fail_closed_audited_and_immutable',
  'SOURCE_RIGHTS_EXTENDED',
  'ARTIFACT_FRESHNESS_EXTENDED',
  'ARTIFACT_QUARANTINED',
  'QUARANTINE_RELEASED',
  'SOURCE_WITHDRAWN',
  'PROMPT_INJECTION',
  'UPDATE tai_public_corpus_audit',
  'DELETE FROM tai_public_corpus_audit',
]) assert(tests.includes(token), `audit or negative regression missing ${token}`);

const workflow = text('.github/workflows/tai-ap-14f1a.yml');
assert(
  workflow.includes(
    'ghcr.io/pachaninm-lab/ci-postgres@sha256:'
      + '57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777',
  ),
  'profile workflow must use the canonical mirrored PostgreSQL digest',
);
for (const token of [
  '0020_public_official_corpus_audit_authority.sql',
  'tai_public_corpus_audit_immutable_guard',
  'tai_public_corpus_audit_immutable',
  'statuses: write',
  'TAI AP-14F1A exact-main',
  'report.counts.changedPaths < 1',
  'report.counts.changedPaths > 11',
  'report.counts.migrationVersion !== 21',
]) assert(workflow.includes(token), `workflow missing ${token}`);

let changedPaths = [];
const scopeIndex = process.argv.indexOf('--scope-guard');
if (scopeIndex !== -1) {
  const base = process.argv[scopeIndex + 1];
  assert(base, '--scope-guard requires a base ref');
  git('merge-base', '--is-ancestor', scope.baseCommit, 'HEAD');
  git('merge-base', '--is-ancestor', base, 'HEAD');
  changedPaths = git('diff', '--name-only', `${base}...HEAD`)
    .split('\n')
    .filter(Boolean)
    .sort();
  assert(changedPaths.length > 0, 'scope diff must not be empty');
  assert(new Set(changedPaths).size === changedPaths.length, 'scope diff must be unique');
  for (const path of changedPaths) {
    assert(allowedPaths.includes(path), `out-of-scope path changed: ${path}`);
  }
  assert(changedPaths.includes(scopePath), 'source-controlled scope manifest must be in the diff');
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
    auditEventTypes: 7,
    realPostgresqlExploitCases: 10,
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
