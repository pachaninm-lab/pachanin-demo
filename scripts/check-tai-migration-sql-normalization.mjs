#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const deployPath = 'scripts/tai-reg-ru-deploy.sh';
const deploy = readFileSync(deployPath, 'utf8');
const startMarker = "<<'PY_MIGRATION_SQL'\n";
const endMarker = '\nPY_MIGRATION_SQL\n';
const start = deploy.indexOf(startMarker);
const end = deploy.indexOf(endMarker, start + startMarker.length);
const failures = [];

if (start < 0 || end < 0) {
  console.error('TAI migration SQL normalization contract failed: production generator heredoc is missing');
  process.exit(1);
}
const generator = deploy.slice(start + startMarker.length, end);

for (const marker of [
  'TAI_DEPLOY_MIGRATION_BUNDLE_EXTRACTION_FAILED',
  'TAI_DEPLOY_MIGRATION_SQL_GENERATION_FAILED',
  'TAI_DEPLOY_MIGRATION_APPLICATION_FAILED',
  'TAI_DEPLOY_MIGRATION_LEDGER_VERIFICATION_FAILED',
  'unbalanced outer migration transaction boundary',
  'empty migration body',
]) {
  if (!deploy.includes(marker)) failures.push(`missing production contract marker: ${marker}`);
}
if (!generator.includes("wrapped=re.fullmatch")) failures.push('generator does not normalize wrapped migrations');
if (!generator.includes("body=(wrapped.group(1) if wrapped else raw).strip()")) {
  failures.push('generator does not preserve plain SQL migration bodies');
}

const targetSha = 'a'.repeat(40);
const root = mkdtempSync(join(tmpdir(), 'tai-migration-normalization-'));

function bundleFor(raw, { version = 1, path = '0001_fixture.sql', digest = 'b'.repeat(64) } = {}) {
  return {
    schemaVersion: 'tai.exact-image-migration-bundle.v1',
    migrations: [{
      version,
      path,
      sha256: digest,
      contentBase64: Buffer.from(raw, 'utf8').toString('base64'),
    }],
  };
}

function run(raw, options = {}) {
  const bundlePath = join(root, `bundle-${Math.random().toString(16).slice(2)}.json`);
  const outputPath = `${bundlePath}.sql`;
  writeFileSync(bundlePath, `${JSON.stringify(bundleFor(raw, options))}\n`, 'utf8');
  const result = spawnSync('python3', ['-', bundlePath, outputPath, targetSha], {
    input: generator,
    encoding: 'utf8',
    timeout: 30_000,
  });
  return {
    status: result.status,
    stderr: result.stderr || '',
    sql: result.status === 0 ? readFileSync(outputPath, 'utf8') : '',
  };
}

try {
  const historicalPlain = readFileSync('apps/tai/tai/migrations/0002_materialization_claims.sql', 'utf8');
  const plain = run(historicalPlain, { version: 2, path: '0002_materialization_claims.sql' });
  if (plain.status !== 0) {
    failures.push(`historical plain SQL migration is still rejected: ${plain.stderr.trim()}`);
  } else {
    if (!plain.sql.includes('CREATE TABLE IF NOT EXISTS tai_materialization_claims')) {
      failures.push('historical plain SQL body was not preserved');
    }
    if (!plain.sql.includes('INSERT INTO public.tai_schema_migrations(version,path,sha256,target_sha) VALUES (2,')) {
      failures.push('historical plain SQL migration lost ledger authority');
    }
  }

  const wrapped = run('BEGIN;\nSELECT 1;\nCOMMIT;\n');
  if (wrapped.status !== 0 || !wrapped.sql.includes('\nSELECT 1;\n')) {
    failures.push(`wrapped migration is not normalized: ${wrapped.stderr.trim()}`);
  }
  if (wrapped.sql.includes('BEGIN;\nBEGIN;') || wrapped.sql.includes('COMMIT;\nCOMMIT;')) {
    failures.push('wrapped migration produced nested transaction control');
  }

  const unbalancedStart = run('BEGIN;\nSELECT 1;\n');
  if (unbalancedStart.status === 0 || !unbalancedStart.stderr.includes('unbalanced outer migration transaction boundary')) {
    failures.push('leading BEGIN without trailing COMMIT did not fail closed');
  }

  const unbalancedEnd = run('SELECT 1;\nCOMMIT;\n');
  if (unbalancedEnd.status === 0 || !unbalancedEnd.stderr.includes('unbalanced outer migration transaction boundary')) {
    failures.push('trailing COMMIT without leading BEGIN did not fail closed');
  }

  const empty = run(' \n\t');
  if (empty.status === 0 || !empty.stderr.includes('empty migration body')) {
    failures.push('empty migration did not fail closed');
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failures.length) {
  console.error('TAI migration SQL normalization contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('TAI migration SQL normalization contract PASS: historical plain SQL and wrapped migrations are normalized into controller-owned transactions; empty and unbalanced boundaries fail closed.');
