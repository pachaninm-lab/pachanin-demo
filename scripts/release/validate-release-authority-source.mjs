#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve('.');
const expectedHead = String(process.env.RELEASE_AUTHORITY_EXACT_HEAD ?? '').trim();
const reportPath = resolve(process.env.RELEASE_AUTHORITY_REPORT ?? 'artifacts/release-authority/source-policy.json');
const violations = [];
const checkedFiles = [];

function read(path) {
  const absolute = resolve(ROOT, path);
  if (!existsSync(absolute)) {
    violations.push(`${path}: required file is missing`);
    return '';
  }
  const source = readFileSync(absolute, 'utf8');
  checkedFiles.push({ path, sha256: createHash('sha256').update(source).digest('hex') });
  return source;
}

function requireFragments(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) violations.push(`${path}: missing ${JSON.stringify(fragment)}`);
  }
}

function forbid(path, patterns) {
  const source = read(path);
  for (const [pattern, description] of patterns) {
    if (pattern.test(source)) violations.push(`${path}: forbidden ${description}`);
  }
}

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(expectedHead)) violations.push('RELEASE_AUTHORITY_EXACT_HEAD must be a full lowercase commit SHA');
if (head !== expectedHead) violations.push(`checked out ${head} but expected ${expectedHead}`);

requireFragments('infra/helm/grainflow/values.yaml', [
  'release:',
  'sourceCommit: ""',
  'manifestId: ""',
  'migration:',
  'api:',
  'web:',
  'outboxWorker:',
]);
forbid('infra/helm/grainflow/values.yaml', [
  [/\btag:\s*/, 'mutable image tag field'],
  [/enabled:\s*true\s*(?:#.*)?$/m, 'runtime workload enabled by default'],
]);

for (const [path, imageFragment] of [
  ['infra/helm/grainflow/templates/api-deployment.yaml', 'image: "{{ .Values.api.image.repository }}@{{ $digest }}"'],
  ['infra/helm/grainflow/templates/web-deployment.yaml', 'image: "{{ .Values.web.image.repository }}@{{ $digest }}"'],
  ['infra/helm/grainflow/templates/outbox-worker-deployment.yaml', 'image: "{{ .Values.outboxWorker.image.repository }}@{{ $digest }}"'],
  ['infra/helm/grainflow/templates/migration-job.yaml', 'image: "{{ .Values.migration.image.repository }}@{{ $digest }}"'],
]) {
  requireFragments(path, [
    imageFragment,
    'platform.prozrachnaya-cena/image-digest:',
    'platform.prozrachnaya-cena/source-commit:',
    'platform.prozrachnaya-cena/release-manifest:',
    'runAsNonRoot: true',
    'allowPrivilegeEscalation: false',
    'readOnlyRootFilesystem: true',
    'drop: [ALL]',
  ]);
  forbid(path, [[/image:\s*"[^"\n]+:[^"\n]+"/, 'tag-based workload image']]);
}

requireFragments('infra/helm/grainflow/templates/api-deployment.yaml', [
  'migration.enabled must be true when api.enabled=true',
  'application pods never own migrations',
  'maxUnavailable: 0',
]);
forbid('infra/helm/grainflow/templates/api-deployment.yaml', [
  [/prisma\s+migrate|migrate\s+deploy/i, 'implicit application migration execution'],
  [/initContainers:/, 'per-pod migration init container'],
]);

requireFragments('infra/helm/grainflow/templates/migration-job.yaml', [
  'kind: Job',
  'helm.sh/hook: pre-install,pre-upgrade',
  'helm.sh/hook-weight: "-20"',
  'backoffLimit:',
  'restartPolicy: Never',
  'platform.prozrachnaya-cena/migration-set-digest:',
]);

for (const path of [
  'infra/docker/Dockerfile.api',
  'infra/docker/Dockerfile.web',
  'infra/docker/Dockerfile.outbox-worker',
  'infra/docker/Dockerfile.migrations',
]) {
  requireFragments(path, [
    'ARG GIT_COMMIT=unknown',
    'org.opencontainers.image.revision=$GIT_COMMIT',
    'gcr.io/distroless/nodejs24-debian13:nonroot AS runtime',
    'USER nonroot',
  ]);
  forbid(path, [[/FROM\s+node:[^\n]+\s+AS\s+runtime/i, 'full Node runtime stage']]);
}
requireFragments('infra/docker/Dockerfile.migrations', [
  'node_modules/prisma/build/index.js',
  'migrate',
  'deploy',
  '--schema',
  'prisma/schema.prisma',
]);

requireFragments('infra/docker/runtime-inventory.json', [
  '"releaseManifestRequired": true',
  '"component": "migration-job"',
  '"applicationPodsRunMigrations": false',
  '"ticket": "#2652"',
]);
requireFragments('infra/release/immutable-release-manifest.schema.json', [
  'ProzrachnayaCenaImmutableRelease',
  'migrationSetDigest',
  'outboxWorker',
  'additionalProperties',
]);
for (const path of [
  'scripts/release/immutable-release-lib.mjs',
  'scripts/release/build-immutable-release-manifest.mjs',
  'scripts/release/build-immutable-rollback.mjs',
  'scripts/release/render-immutable-release-values.mjs',
  'scripts/release/validate-immutable-release.mjs',
]) read(path);

const report = {
  schemaVersion: 1,
  repository: 'pachaninm-lab/pachanin-demo',
  commitSha: head,
  timestamp: new Date().toISOString(),
  checkedFiles: checkedFiles.sort((left, right) => left.path.localeCompare(right.path)),
  violations,
  pass: violations.length === 0,
  maturityBoundary: 'Static source and desired-state policy only; no registry promotion, cluster deployment or rollback execution is claimed.',
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (!report.pass) {
  console.error('Immutable release source policy failed:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}
console.log(`Immutable release source policy passed ${checkedFiles.length} governed files for ${head}.`);
