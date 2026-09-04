#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness';
const dir = path.join(root, 'fault');
const raw = path.join(dir, 'raw');
const output = path.join(dir, 'fault-injection-acceptance.json');
const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA || 'unknown';

const read = (file, fallback = null) => {
  const target = path.join(dir, file);
  if (!fs.existsSync(target)) return fallback;
  const value = fs.readFileSync(target, 'utf8').trim();
  return value === '' ? fallback : value;
};
const readRaw = (file, fallback = null) => {
  const target = path.join(raw, file);
  if (!fs.existsSync(target)) return fallback;
  const value = fs.readFileSync(target, 'utf8').trim();
  return value === '' ? fallback : value;
};
const num = (file, fallback = 999) => {
  const value = Number(readRaw(file, fallback));
  return Number.isFinite(value) ? value : fallback;
};
const json = (target) => {
  try { return JSON.parse(fs.readFileSync(target, 'utf8')); } catch { return null; }
};

const baseline = json(path.join(root, 'production-like-kubernetes-evidence.json'));
const invariants = json(path.join(raw, 'final-invariants.json')) || {};
const started = Number(read('started-epoch.txt', 0));
const ended = Number(read('completed-epoch.txt', Math.floor(Date.now() / 1000)));
const complete = fs.existsSync(path.join(dir, 'acceptance-complete'));

const thresholds = {
  baselineAccepted: true,
  databaseOutageFalseEffects: 0,
  databaseRecoveryCommandEvents: 1,
  apiAlertFired: 1,
  apiAlertCleared: 1,
  objectOutageFalseVerified: 0,
  objectRecoveryVerified: 1,
  kafkaOutageFalseSent: 0,
  kafkaRecoverySeconds: 90,
  pressureApiFailures: 0,
  evacuationApiFailures: 0,
  minimumWorkersDuringEvacuation: 1,
  migrationResidue: 0,
  releaseAuthorityMismatches: 0,
  duplicateLeaseTokens: 0,
};

const actual = {
  baselineAccepted: baseline?.pass === true,
  databaseOutageFalseEffects: num('db-outage-false-effects.txt'),
  databaseRecoveryCommandEvents: num('db-recovery-event-count.txt'),
  apiAlertFired: num('api-alert-fired.txt', 0),
  apiAlertCleared: num('api-alert-cleared.txt', 0),
  objectOutageFalseVerified: num('object-outage-false-verified.txt'),
  objectRecoveryVerified: num('object-recovery-verified.txt', 0),
  kafkaOutageFalseSent: num('kafka-outage-false-sent.txt'),
  kafkaRecoverySeconds: num('kafka-recovery-seconds.txt'),
  pressureApiFailures: num('pressure-api-failures.txt'),
  evacuationApiFailures: num('node-evacuation-api-failures.txt'),
  minimumWorkersDuringEvacuation: num('node-evacuation-min-workers.txt', 0),
  migrationResidue: num('migration-residue-count.txt'),
  releaseAuthorityMismatches: num('release-authority-mismatches.txt'),
  duplicateLeaseTokens: Number(invariants.duplicateLeaseTokens ?? 999),
};

const violations = [];
if (!actual.baselineAccepted) violations.push('baselineAccepted:false');
for (const key of [
  'databaseOutageFalseEffects',
  'objectOutageFalseVerified',
  'kafkaOutageFalseSent',
  'pressureApiFailures',
  'evacuationApiFailures',
  'migrationResidue',
  'releaseAuthorityMismatches',
  'duplicateLeaseTokens',
]) {
  if (actual[key] !== thresholds[key]) violations.push(`${key}:${actual[key]}!=${thresholds[key]}`);
}
for (const key of ['databaseRecoveryCommandEvents', 'apiAlertFired', 'apiAlertCleared', 'objectRecoveryVerified']) {
  if (actual[key] !== thresholds[key]) violations.push(`${key}:${actual[key]}!=${thresholds[key]}`);
}
if (actual.kafkaRecoverySeconds > thresholds.kafkaRecoverySeconds) {
  violations.push(`kafkaRecoverySeconds:${actual.kafkaRecoverySeconds}>${thresholds.kafkaRecoverySeconds}`);
}
if (actual.minimumWorkersDuringEvacuation < thresholds.minimumWorkersDuringEvacuation) {
  violations.push(`minimumWorkersDuringEvacuation:${actual.minimumWorkersDuringEvacuation}<${thresholds.minimumWorkersDuringEvacuation}`);
}

const pass = complete && violations.length === 0 && read('exact-head.txt') === exactHead;
const report = {
  schemaVersion: 1,
  evidenceClass: 'FAULT_INJECTION_SAFE_DEGRADATION_RECOVERY',
  repository: process.env.GITHUB_REPOSITORY || 'pachaninm-lab/pachanin-demo',
  exactCommit: exactHead,
  environment: 'github-actions-multi-node-kind-production-like',
  generatedAt: new Date().toISOString(),
  durationSeconds: Math.max(0, ended - started),
  pass,
  decision: pass ? 'PASS' : 'FAIL',
  failureReason: pass ? null : read('failure-reason.txt', 'fault acceptance incomplete'),
  thresholds,
  actualMeasurements: actual,
  violations,
  inheritedAcceptedScenarios: {
    apiPeerDeletion: baseline?.actualMeasurements?.apiAvailabilityProbeFailures === 0,
    webPeerDeletion: baseline?.actualMeasurements?.webAvailabilityProbeFailures === 0,
    pgbouncerPeerDeletion: baseline?.actualMeasurements?.pgbouncerAvailabilityProbeFailures === 0,
    workerPeerDeletion: Number(baseline?.actualMeasurements?.minimumReadyWorkersDuringPeerDeletion ?? 0) >= 1,
    immutableRollingDeployment: baseline?.assertions?.rollingUpdateDigestSetApplied === true,
    sameSchemaRollback: baseline?.assertions?.sameSchemaRollbackDigestSetRestored === true,
    networkPolicy: baseline?.assertions?.unauthorizedNetworkConnectionBlocked === true,
  },
  residualScenarios: {
    databaseTotalRouteOutage: { falseBusinessEffects: actual.databaseOutageFalseEffects, recoveredCommandEvents: actual.databaseRecoveryCommandEvents },
    alertContinuity: { fired: actual.apiAlertFired === 1, cleared: actual.apiAlertCleared === 1 },
    objectStorageOutage: { falseVerified: actual.objectOutageFalseVerified, recoveredVerified: actual.objectRecoveryVerified },
    kafkaOutage: { falseSent: actual.kafkaOutageFalseSent, recoverySeconds: actual.kafkaRecoverySeconds },
    boundedResourcePressure: { apiFailures: actual.pressureApiFailures },
    platformWorkloadEvacuation: { apiFailures: actual.evacuationApiFailures, minimumReadyWorkers: actual.minimumWorkersDuringEvacuation },
    failedMigrationRollback: { schemaResidue: actual.migrationResidue, releaseAuthorityMismatches: actual.releaseAuthorityMismatches },
    finalInvariantReconciliation: invariants,
  },
  evidence: [
    'production-like-kubernetes-evidence.json',
    'fault/raw/db-outage-command.json',
    'fault/raw/db-recovery-command.json',
    'fault/raw/api-alert-fired.txt',
    'fault/raw/api-alert-cleared.txt',
    'fault/raw/object-outage-response.json',
    'fault/raw/object-recovery-response.json',
    'fault/raw/kafka-recovery-seconds.txt',
    'fault/raw/pressure-pod.yaml',
    'fault/raw/node-evacuation-api-failures.txt',
    'fault/raw/migration-failure.log',
    'fault/raw/final-invariants.json',
  ],
  maturity: {
    acceptedLevel: pass ? 'PRODUCTION_LIKE_ACCEPTED' : 'IMPLEMENTED_NOT_OPERATIONALLY_PROVEN',
    permittedClaim: pass ? 'Residual infrastructure fault handling, safe degradation and bounded recovery are accepted on reproducible production-like infrastructure.' : null,
    prohibitedClaims: ['fully operational production', 'real provider resilience', 'live user traffic', 'permanent production history'],
  },
};

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, pass, violations }));
