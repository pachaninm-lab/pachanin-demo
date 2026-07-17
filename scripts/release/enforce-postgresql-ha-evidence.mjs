import fs from 'node:fs';
import path from 'node:path';

const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA;
const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness/postgresql-ha';
const evidencePath = path.join(evidenceDir, 'postgresql-ha-acceptance.json');

if (!exactHead) {
  throw new Error('EXACT_HEAD or GITHUB_SHA is required');
}
if (!fs.existsSync(evidencePath)) {
  throw new Error(`Missing evidence: ${evidencePath}`);
}

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const errors = [];

if (evidence.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
if (evidence.evidenceClass !== 'POSTGRESQL_HA_FAILOVER_PITR') errors.push('unexpected evidenceClass');
if (evidence.exactCommit !== exactHead) errors.push(`exactCommit ${evidence.exactCommit} does not match ${exactHead}`);
if (evidence.environment !== 'disposable-multi-node-kind') errors.push('unexpected environment');
if (evidence.pass !== true || evidence.decision !== 'PASS') errors.push('acceptance decision is not PASS');
if (!Array.isArray(evidence.violations) || evidence.violations.length !== 0) errors.push('violations must be empty');
if (evidence.topology?.readyInstances !== 3) errors.push('three ready PostgreSQL instances were not proven');
if (evidence.topology?.distinctDatabaseNodes !== 3) errors.push('database anti-affinity was not proven');
if ((evidence.replication?.synchronousStandbys ?? 0) < 1) errors.push('synchronous standby was not proven');
if (evidence.replication?.failoverQuorum !== true) errors.push('failover quorum was not proven');
if ((evidence.failover?.durationMs ?? Number.POSITIVE_INFINITY) > 120000) errors.push('failover RTO exceeded 120 seconds');
if (evidence.failover?.committedRowsLost !== 0) errors.push('committed row loss is non-zero');
if (evidence.failover?.oldPrimaryPodUidReused !== false) errors.push('stale primary process fencing was not proven');
if (evidence.failover?.poolerEndpointChanged !== false) errors.push('pooler endpoint changed during failover');
if (evidence.backup?.phase !== 'completed') errors.push('base backup did not complete');
if ((evidence.backup?.archivedWalDelta ?? 0) < 1) errors.push('WAL archiving was not proven');
if (evidence.restore?.sourceHash !== evidence.restore?.restoredHash) errors.push('full restore hash mismatch');
if (evidence.restore?.sourceCount !== evidence.restore?.restoredCount) errors.push('full restore count mismatch');
if (evidence.pitr?.includeMarkerPresent !== true) errors.push('PITR include marker is missing');
if (evidence.pitr?.excludeMarkerPresent !== false) errors.push('PITR exclude marker is present');
if (evidence.principals?.runtimeSuperuser !== false) errors.push('runtime principal is superuser');
if (evidence.principals?.runtimeCanCreateDatabase !== false) errors.push('runtime principal can create databases');
if (evidence.principals?.runtimeCanCreateSchemaObjects !== false) errors.push('runtime principal retains DDL authority');
if (!evidence.supplyChain?.cloudNativePgManifestSha256) errors.push('CNPG manifest digest missing');
if (!evidence.supplyChain?.barmanPluginManifestSha256) errors.push('Barman plugin manifest digest missing');
if (!evidence.supplyChain?.certManagerManifestSha256) errors.push('cert-manager manifest digest missing');
if (!String(evidence.supplyChain?.postgresImage || '').includes('@sha256:')) errors.push('PostgreSQL image is not digest-pinned');
if (!String(evidence.supplyChain?.minioImage || '').includes('@sha256:')) errors.push('MinIO image is not digest-pinned');

if (errors.length) {
  console.error(JSON.stringify({ evidencePath, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  evidencePath,
  exactCommit: evidence.exactCommit,
  decision: evidence.decision,
  failoverDurationMs: evidence.failover.durationMs,
  restoreDurationMs: evidence.restore.durationMs,
  pitrDurationMs: evidence.pitr.durationMs
}, null, 2));
