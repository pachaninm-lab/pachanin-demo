#!/usr/bin/env node
import fs from 'node:fs';

const exactHead = process.env.EXACT_HEAD;
const file = 'artifacts/worker-topology/outbox-worker-acceptance.json';

if (!fs.existsSync(file)) {
  throw new Error(`Missing canonical outbox runtime evidence: ${file}`);
}

const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const failures = [];
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
if (report.delivered !== 342 || report.dead !== 1 || report.leaseLost !== 1) {
  failures.push(`counts=${report.claimed}/${report.delivered}/${report.retried}/${report.dead}/${report.leaseLost}`);
}
if (report.actualMeasurements?.kafkaOutageFalseSent !== 0) failures.push('Kafka outage falsely acknowledged SENT');
if (report.actualMeasurements?.missingKafkaDeliveries !== 0) failures.push('missing Kafka deliveries');
if (report.actualMeasurements?.duplicateKafkaDeliveries !== 0) failures.push('duplicate Kafka deliveries');
if (report.actualMeasurements?.poisonDeadLetters !== 1) failures.push('poison message did not dead-letter');
if (report.staleTokenCas?.pass !== true) failures.push('stale-token CAS did not pass');
if (report.productionOperationallyAccepted !== false) failures.push('maturity boundary was inflated');

if (failures.length > 0) {
  throw new Error(`Outbox runtime evidence enforcement failed: ${failures.join('; ')}`);
}

process.stdout.write(
  `Outbox runtime evidence accepted for exact head ${exactHead}: `
  + `replicas 2->3->2, delivered=${report.delivered}, dead=${report.dead}, `
  + `leaseLost=${report.leaseLost}, recovery=${report.recoveryDurationSeconds}s\n`,
);
