#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { validateRuntimeCounts } from './validate-production-like-outbox-runtime-counts.mjs';

const exactHead = process.env.EXACT_HEAD;
const file = 'artifacts/worker-topology/outbox-worker-acceptance.json';

if (!fs.existsSync(file)) {
  throw new Error(`Missing canonical outbox runtime evidence: ${file}`);
}

const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const failures = [];
const runtimeDir = path.join(process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness', 'kubernetes', 'outbox-runtime');
const read = (name) => {
  try { return fs.readFileSync(path.join(runtimeDir, name), 'utf8').trim(); } catch { return null; }
};
let outcomeSnapshot = null;
try { outcomeSnapshot = JSON.parse(read('terminal-outcome-counts.json')); } catch { /* validated below */ }
const measuredCounts = validateRuntimeCounts({
  snapshot: outcomeSnapshot,
  exactHead,
  runId: report.runId,
  ambiguity: read('lease-recovery-ambiguity.txt'),
  leaseSnapshot: read('killed-lease-snapshot.txt'),
});
failures.push(...measuredCounts.violations);
if (!isDeepStrictEqual(report.outcomeSnapshot, outcomeSnapshot)) failures.push('canonical outcome snapshot differs from measured artifact');
if (!isDeepStrictEqual(report.leaseQuarantine, measuredCounts.quarantine)) failures.push('canonical quarantine differs from measured artifact');
if (report.schemaVersion !== 1) failures.push(`schemaVersion=${report.schemaVersion}`);
if (report.commitSha !== exactHead) failures.push(`commitSha=${report.commitSha} exactHead=${exactHead}`);
if (report.result !== 'PASS' || report.pass !== true) failures.push(`result=${report.result} pass=${report.pass}`);
if (!Array.isArray(report.violatedAssertions) || report.violatedAssertions.length !== 0) {
  failures.push(`violatedAssertions=${JSON.stringify(report.violatedAssertions)}`);
}
if (report.replicaCount !== 2 || report.scaleOutReplicaCount !== 3 || report.finalReplicaCount !== 2) {
  failures.push(
    `replicas=${report.replicaCount}/${report.scaleOutReplicaCount}/${report.finalReplicaCount}`,
  );
}
for (const key of ['claimed', 'delivered', 'dead', 'quarantined', 'leaseLost']) {
  if (report[key] !== measuredCounts[key]) failures.push(`${key}=${report[key]} measured=${measuredCounts[key]}`);
}
if (!Number.isSafeInteger(report.retried) || report.retried < 0) {
  failures.push(`retried=${report.retried}`);
}
if (report.actualMeasurements?.kafkaOutageFalseSent !== 0) failures.push('Kafka outage falsely acknowledged SENT');
if (report.actualMeasurements?.missingKafkaDeliveries !== 0) failures.push('missing Kafka deliveries');
if (report.actualMeasurements?.duplicateKafkaDeliveries !== 0) failures.push('duplicate Kafka deliveries');
if (report.actualMeasurements?.poisonDeadLetters !== 1) failures.push('poison message did not dead-letter');

const poison = report.poisonDefinitiveRejection;
if (
  poison?.status !== 'DEAD_LETTER'
  || poison?.retryCount !== 1
  || poison?.category !== 'PERMANENT'
  || poison?.code !== 'KAFKA_MESSAGE_TOO_LARGE'
  || poison?.leaseState !== 'no-lease'
  || poison?.deliveryState !== 'unsent'
) {
  failures.push(`poisonDefinitiveRejection=${JSON.stringify(poison)}`);
}

if (report.staleTokenCas?.pass !== true) failures.push('stale-token CAS did not pass');
if (report.productionOperationallyAccepted !== false) failures.push('maturity boundary was inflated');

if (failures.length > 0) {
  throw new Error(`Outbox runtime evidence enforcement failed: ${failures.join('; ')}`);
}

process.stdout.write(
  `Outbox runtime evidence accepted for exact head ${exactHead}: `
  + `replicas 2->3->2, delivered=${report.delivered}, dead=${report.dead}, `
  + `quarantined=${report.quarantined}, `
  + `poison=${poison.code}/${poison.category}/attempt=${poison.retryCount}, `
  + `leaseLost=${report.leaseLost}, recovery=${report.recoveryDurationSeconds}s\n`,
);
