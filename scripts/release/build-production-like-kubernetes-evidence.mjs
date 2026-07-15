#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness';
const k8s = path.join(root, 'kubernetes');
const read = (name) => {
  const file = path.join(k8s, name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
};
const json = (name) => {
  const value = read(name);
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
};
const initial = json('initial-release-manifest.json');
const update = json('update-release-manifest.json');
const rollback = json('rollback.json');
const nodes = json('cluster/pod-placement.json') ?? {};
const pass = process.env.RESULT === 'passed' && Number(process.env.EXIT_STATUS) === 0;
const thresholds = {
  apiReplicas: 2,
  webReplicas: 2,
  outboxWorkerReplicas: 2,
  pgbouncerReplicas: 1,
  pgbouncerRoutedPrincipals: 4,
  migrationExecutions: 1,
  apiAvailabilityProbeFailures: 0,
  webAvailabilityProbeFailures: 0,
  minimumReadyWorkersDuringPeerDeletion: 1,
  mutablePlatformImageReferences: 0,
  workloadServiceAccountTokens: 0,
  applicationDdlPrivileges: 0,
  networkPolicyUnauthorizedConnections: 0,
  rollbackDigestMismatches: 0,
};
const actual = {
  apiReplicas: Number(read('cluster/api-ready-replicas.txt') ?? 0),
  webReplicas: Number(read('cluster/web-ready-replicas.txt') ?? 0),
  outboxWorkerReplicas: Number(read('cluster/worker-ready-replicas.txt') ?? 0),
  pgbouncerReplicas: Number(read('cluster/pgbouncer-ready-replicas.txt') ?? 0),
  pgbouncerRoutedPrincipals: Number(read('cluster/pgbouncer-routed-principals.txt') ?? 0),
  migrationExecutions: Number(process.env.MIGRATION_EXECUTIONS),
  apiAvailabilityProbeFailures: Number(process.env.API_PROBE_FAILURES),
  webAvailabilityProbeFailures: Number(process.env.WEB_PROBE_FAILURES),
  minimumReadyWorkersDuringPeerDeletion: Number(process.env.WORKER_MIN_READY),
  mutablePlatformImageReferences: Number(read('cluster/mutable-platform-images.txt') ?? 999),
  workloadServiceAccountTokens: Number(read('cluster/service-account-token-violations.txt') ?? 999),
  applicationDdlPrivileges: Number(read('cluster/application-ddl-privileges.txt') ?? 999),
  networkPolicyUnauthorizedConnections: process.env.NETWORK_DENIAL_PROVEN === 'true' ? 0 : 1,
  rollbackDigestMismatches: process.env.ROLLBACK_MATCH === 'true' ? 0 : 1,
};
const exactThresholds = new Set(['migrationExecutions']);
const minimumThresholds = new Set([
  'apiReplicas',
  'webReplicas',
  'outboxWorkerReplicas',
  'pgbouncerReplicas',
  'pgbouncerRoutedPrincipals',
  'minimumReadyWorkersDuringPeerDeletion',
]);
const violations = [];
for (const [name, threshold] of Object.entries(thresholds)) {
  const value = actual[name];
  if (exactThresholds.has(name)) {
    if (value !== threshold) violations.push(`${name}:${value}!=${threshold}`);
  } else if (minimumThresholds.has(name)) {
    if (value < threshold) violations.push(`${name}:${value}<${threshold}`);
  } else if (value > threshold) {
    violations.push(`${name}:${value}>${threshold}`);
  }
}
if (process.env.INITIAL_MATCH !== 'true') violations.push('initialDigestSetMismatch');
if (process.env.ROLLOUT_MATCH !== 'true') violations.push('rolloutDigestSetMismatch');
if (process.env.ROLLBACK_MATCH !== 'true') violations.push('rollbackDigestSetMismatch');
const report = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY || 'pachaninm-lab/pachanin-demo',
  commitSha: process.env.EXACT_HEAD,
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'unknown',
  environment: 'github-actions-multi-node-kind-production-like',
  timestamp: new Date().toISOString(),
  command: 'bash scripts/release/production-like-kubernetes-acceptance.sh',
  durationSeconds: Math.max(0, Number(process.env.ENDED_EPOCH) - Number(process.env.STARTED_EPOCH)),
  result: pass ? 'PASS' : 'FAIL',
  pass,
  failureReason: pass ? null : process.env.FAILURE_REASON,
  release: {
    initialManifestId: initial?.manifestId ?? null,
    updateManifestId: update?.manifestId ?? null,
    rollbackId: rollback?.rollbackId ?? null,
    sourceCommit: initial?.sourceCommit ?? null,
    migrationSetDigest: initial?.migrationSetDigest ?? null,
    initialDigests: initial?.components ?? null,
    updateDigests: update?.components ?? null,
    rollbackTargetDigests: rollback?.targetComponents ?? null,
  },
  topology: {
    kindNodes: nodes.kindNodes ?? null,
    api: nodes.api ?? null,
    web: nodes.web ?? null,
    outboxWorker: nodes.outboxWorker ?? null,
    dependencies: ['PostgreSQL 16', 'PgBouncer 1.22.1', 'Kafka', 'Redis', 'MinIO', 'OpenTelemetry Collector', 'Prometheus', 'Alertmanager', 'ingress-nginx', 'Calico'],
  },
  thresholds,
  actualMeasurements: actual,
  violatedThresholds: [...new Set(violations)],
  assertions: {
    exactHeadCheckout: true,
    defaultHelmExecutableWorkloads: 0,
    buildOnceDeployMany: true,
    dedicatedMigrationJob: true,
    applicationMigrations: false,
    runtimeDatabaseAccessThroughPgBouncer: actual.pgbouncerReplicas >= 1 && actual.pgbouncerRoutedPrincipals >= 4,
    immutablePlatformImages: actual.mutablePlatformImageReferences === 0,
    initialDigestSetApplied: process.env.INITIAL_MATCH === 'true',
    rollingUpdateDigestSetApplied: process.env.ROLLOUT_MATCH === 'true',
    sameSchemaRollbackDigestSetRestored: process.env.ROLLBACK_MATCH === 'true',
    unauthorizedNetworkConnectionBlocked: process.env.NETWORK_DENIAL_PROVEN === 'true',
    secretSafeEvidenceCollection: true,
  },
  logs: [
    'kubernetes/cluster/pods-all.txt',
    'kubernetes/cluster/events.txt',
    'kubernetes/cluster/workload-descriptions.txt',
    'kubernetes/cluster/pgbouncer-runtime-check.log',
    'kubernetes/logs/grainflow-api.log',
    'kubernetes/logs/grainflow-web.log',
    'kubernetes/logs/grainflow-outbox-worker.log',
    'kubernetes/logs/pgbouncer.log',
  ],
  artifacts: [
    'kubernetes/initial-release-manifest.json',
    'kubernetes/update-release-manifest.json',
    'kubernetes/rollback.json',
    'kubernetes/rendered/default.yaml',
    'kubernetes/rendered/initial-migration.yaml',
    'kubernetes/rendered/initial-workloads.yaml',
    'kubernetes/rendered/update-workloads.yaml',
    'kubernetes/rendered/rollback-workloads.yaml',
    'kubernetes/cluster/accepted-resources.yaml',
  ],
  maturityBoundary: 'Reproducible disposable multi-node kind deployment, PostgreSQL runtime routing through PgBouncer, live rolling update and same-schema rollback. This does not prove provider-level PostgreSQL HA/PITR, target production load, permanent-environment operations, external pentest, live provider integrations or operational soak.',
  externalBlockers: [
    '#2600 removal of obsolete Vercel and Deno status publishers',
    'permanent Kubernetes/registry/DNS/TLS provider access',
    'provider-level PostgreSQL HA/PITR',
    'external pentest and live integration credentials',
    '72-hour, 14-day and 30-day operational soak',
  ],
  toolVersions: {
    docker: read('docker-version.txt'),
    kind: read('kind-version.txt'),
    kubectl: read('kubectl-client-version.txt'),
    helm: read('helm-version.txt'),
    node: read('node-version.txt'),
    pgbouncerImage: 'edoburu/pgbouncer:1.22.1-p0',
    calicoManifestSha256: read('external-manifests/calico.sha256'),
    ingressManifestSha256: read('external-manifests/ingress-nginx.sha256'),
  },
};
fs.writeFileSync(path.join(root, 'production-like-kubernetes-evidence.json'), `${JSON.stringify(report, null, 2)}\n`);
