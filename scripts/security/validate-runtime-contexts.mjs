#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve('.');
const EXACT_HEAD = String(process.env.RUNTIME_CONTEXT_EXACT_HEAD ?? '').trim();
const REPORT_PATH = resolve(
  process.env.RUNTIME_CONTEXT_REPORT
    ?? 'artifacts/security/runtime-context-validation.json',
);

const violations = [];
const checkedFiles = new Set();

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function read(path) {
  const absolute = resolve(ROOT, path);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    violations.push(`${path}: required file is missing.`);
    return '';
  }
  checkedFiles.add(path);
  return readFileSync(absolute, 'utf8');
}

function requireFragments(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) violations.push(`${path}: missing required fragment ${JSON.stringify(fragment)}.`);
  }
}

function forbidPatterns(path, patterns) {
  const source = read(path);
  for (const [pattern, label] of patterns) {
    if (pattern.test(source)) violations.push(`${path}: forbidden ${label}.`);
  }
}

function walk(directory) {
  const absolute = resolve(ROOT, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(absolute, entry.name);
    return entry.isDirectory() ? walk(path) : [relative(ROOT, path).replaceAll('\\', '/')];
  });
}

function validateInventory() {
  const path = 'infra/docker/runtime-inventory.json';
  const source = read(path);
  if (!source) return;
  let inventory;
  try {
    inventory = JSON.parse(source);
  } catch (error) {
    violations.push(`${path}: invalid JSON: ${error instanceof Error ? error.message : String(error)}.`);
    return;
  }
  if (inventory.schemaVersion !== 1 || inventory.repository !== 'pachaninm-lab/pachanin-demo') {
    violations.push(`${path}: invalid schema or repository identity.`);
  }
  const active = Array.isArray(inventory.releaseAuthority) ? inventory.releaseAuthority : [];
  const expected = new Map([
    ['api', 'infra/docker/Dockerfile.api'],
    ['web', 'infra/docker/Dockerfile.web'],
    ['outbox-worker', 'infra/docker/Dockerfile.outbox-worker'],
  ]);
  if (active.length !== expected.size) violations.push(`${path}: releaseAuthority must contain exactly API, web and outbox-worker.`);
  for (const item of active) {
    if (expected.get(item.component) !== item.dockerfile
      || item.status !== 'DEPLOYABLE'
      || item.runtimeUser !== 'nonroot'
      || item.productionDependenciesOnly !== true) {
      violations.push(`${path}: invalid deployable runtime entry for ${item.component ?? '<missing>'}.`);
    }
    if (item.component === 'outbox-worker') {
      if (item.entrypoint !== 'dist-outbox-worker/outbox-worker.js'
        || item.stateAuthority !== 'PostgreSQL outbox_entries'
        || item.independentProcess !== true
        || item.activationContract?.helmEnabledByDefault !== false
        || item.activationContract?.immutableDigestRequired !== true
        || item.ticket !== '#2649') {
        violations.push(`${path}: outbox-worker authority or activation contract is invalid.`);
      }
    }
  }
  const retired = Array.isArray(inventory.nonDeployable) ? inventory.nonDeployable : [];
  const worker = retired.find((item) => item.component === 'route-simulator-worker');
  if (!worker || worker.status !== 'NOT_DEPLOYABLE' || worker.ticket !== '#2606') {
    violations.push(`${path}: retired route simulator worker classification is missing.`);
  }
}

function validateDockerfiles() {
  for (const path of [
    'infra/docker/Dockerfile.api',
    'infra/docker/Dockerfile.web',
    'infra/docker/Dockerfile.outbox-worker',
  ]) {
    requireFragments(path, [
      '# syntax=docker/dockerfile:1.7',
      'pnpm install --frozen-lockfile',
      '--prod deploy --legacy',
      'gcr.io/distroless/nodejs24-debian13:nonroot AS runtime',
      'COPY --from=build --chown=nonroot:nonroot',
      'USER nonroot',
    ]);
    forbidPatterns(path, [
      [/\|\|\s*pnpm\s+install/, 'fallback dependency installation'],
      [/FROM\s+node:[^\n]+\s+AS\s+runtime/i, 'mutable full Node runtime stage'],
      [/npm\s+install\s+--global[^\n]*\n(?:(?!FROM).)*CMD/s, 'runtime package-manager execution'],
    ]);
  }
  requireFragments('infra/docker/Dockerfile.outbox-worker', [
    'pnpm --filter @pc/api build:outbox-worker',
    'rm -rf /prod/outbox-worker/src /prod/outbox-worker/test /prod/outbox-worker/prisma',
    'ENV RUNTIME_COMPONENT=outbox-worker',
    'CMD ["dist-outbox-worker/outbox-worker.js"]',
  ]);
  requireFragments('apps/api/tsconfig.outbox-worker.json', [
    '"rootDir": "src"',
    '"outDir": "dist-outbox-worker"',
    '"src/outbox-worker.ts"',
  ]);
  for (const retired of ['infra/docker/Dockerfile.worker', 'infra/docker/Dockerfile.ml']) {
    if (existsSync(resolve(ROOT, retired))) {
      violations.push(`${retired}: retired image must remain absent from deployable runtime authority.`);
    }
  }
}

const POD_SECURITY = [
  'runAsNonRoot: true',
  'runAsGroup:',
  'fsGroup:',
  'seccompProfile:',
  'type: RuntimeDefault',
  'allowPrivilegeEscalation: false',
  'readOnlyRootFilesystem: true',
  'drop: [ALL]',
];

function validateWorkload(path, extra = []) {
  requireFragments(path, [...POD_SECURITY, ...extra]);
  forbidPatterns(path, [
    [/privileged:\s*true/, 'privileged container'],
    [/allowPrivilegeEscalation:\s*true/, 'privilege escalation'],
    [/seccompProfile:\s*\n\s*type:\s*Unconfined/, 'unconfined seccomp'],
  ]);
}

function validateFailClosedContour(path, ticket, component) {
  const source = read(path);
  for (const fragment of [
    'kind: ConfigMap',
    'platform.prozrachnaya-cena/deployable: "false"',
    'platform.prozrachnaya-cena/status: NOT_DEPLOYABLE',
    `platform.prozrachnaya-cena/ticket: "${ticket}"`,
    'status: NOT_DEPLOYABLE',
  ]) {
    if (!source.includes(fragment)) {
      violations.push(`${path}: missing ${component} fail-closed fragment ${JSON.stringify(fragment)}.`);
    }
  }
  for (const [pattern, label] of [
    [/kind:\s*Deployment/, 'Deployment'],
    [/kind:\s*StatefulSet/, 'StatefulSet'],
    [/kind:\s*Service\b/, 'Service'],
    [/kind:\s*Job\b/, 'Job'],
    [/kind:\s*CronJob\b/, 'CronJob'],
    [/image:\s*[^\n]+/, 'container image'],
  ]) {
    if (pattern.test(source)) violations.push(`${path}: executable ${component} ${label} remains.`);
  }
}

function validateManifests() {
  validateWorkload('infra/k8s/base/api-deployment.yml', [
    'automountServiceAccountToken: false',
    'runAsUser: 65532',
    'mountPath: /tmp',
    'medium: Memory',
  ]);
  validateFailClosedContour('infra/k8s/base/ml-deployment.yml', '#2605', 'ML');
  validateWorkload('infra/k8s/base/redis-cluster.yml', [
    'runAsUser: 999',
    'mountPath: /data',
    'mountPath: /tmp',
  ]);
  validateWorkload('infra/helm/grainflow/templates/api-deployment.yaml', [
    'automountServiceAccountToken: {{ .Values.vault.agentInjector.enabled }}',
    'mountPath: /tmp',
  ]);
  validateWorkload('infra/helm/grainflow/templates/web-deployment.yaml', [
    'automountServiceAccountToken: false',
    'runAsUser: 65532',
    'mountPath: /app/.next/cache',
  ]);
  validateWorkload('infra/helm/grainflow/templates/outbox-worker-deployment.yaml', [
    'automountServiceAccountToken: false',
    'maxUnavailable: 0',
    'requiredDuringSchedulingIgnoredDuringExecution:',
    'image: "{{ .Values.outboxWorker.image.repository }}@{{ $digest }}"',
    'OUTBOX_WORKER_ID',
    'KAFKA_CLIENT_ID',
    'terminationGracePeriodSeconds:',
    'mountPath: /tmp',
  ]);
  requireFragments('infra/helm/grainflow/values.yaml', [
    'outboxWorker:',
    'enabled: false',
    'digest: ""',
    'OUTBOX_WORKER_ENABLED: "true"',
    'KAFKA_REQUIRED: "true"',
    'OUTBOX_WORKER_ENABLED: "false"',
  ]);
  validateFailClosedContour('infra/helm/grainflow/templates/ml-deployment.yaml', '#2605', 'ML');
  validateFailClosedContour('infra/k8s/base/elasticsearch.yml', '#2606', 'Elasticsearch');

  const allIaC = [...walk('infra/k8s'), ...walk('infra/helm')]
    .filter((path) => /\.ya?ml$/i.test(path));
  for (const path of allIaC) {
    const source = read(path);
    if (/privileged:\s*true/.test(source)) violations.push(`${path}: privileged container remains in retained IaC.`);
  }
}

function main() {
  const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/i.test(EXACT_HEAD)) violations.push('RUNTIME_CONTEXT_EXACT_HEAD must be a full commit SHA.');
  if (EXACT_HEAD !== actualHead) violations.push(`Checked out commit ${actualHead} does not match exact head ${EXACT_HEAD}.`);

  validateInventory();
  validateDockerfiles();
  validateManifests();

  const report = {
    schemaVersion: 1,
    repository: 'pachaninm-lab/pachanin-demo',
    commitSha: actualHead,
    generatedAt: new Date().toISOString(),
    deployableImages: ['api', 'web', 'outbox-worker'],
    retiredImages: ['route-simulator-worker', 'ml-service'],
    checkedFiles: [...checkedFiles].sort().map((path) => ({ path, sha256: sha256(resolve(ROOT, path)) })),
    violations,
    passed: violations.length === 0,
  };
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  if (!report.passed) {
    console.error('Runtime context validation failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }
  console.log(`Runtime context validation passed ${report.checkedFiles.length} governed files for ${actualHead}.`);
}

main();
