#!/usr/bin/env node
import fs from 'node:fs';

const root = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness';
const file = `${root}/fault/fault-injection-acceptance.json`;
if (!fs.existsSync(file)) throw new Error(`Missing fault evidence: ${file}`);
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const exact = process.env.EXACT_HEAD || process.env.GITHUB_SHA;
const failures = [];
if (report.schemaVersion !== 1) failures.push('schemaVersion');
if (report.evidenceClass !== 'FAULT_INJECTION_SAFE_DEGRADATION_RECOVERY') failures.push('evidenceClass');
if (!exact || report.exactCommit !== exact) failures.push(`exactCommit:${report.exactCommit}!=${exact}`);
if (report.pass !== true || report.decision !== 'PASS') failures.push('decision');
if (!Array.isArray(report.violations) || report.violations.length !== 0) failures.push('violations');
for (const [name, value] of Object.entries(report.inheritedAcceptedScenarios || {})) {
  if (value !== true) failures.push(`inherited:${name}`);
}
if (report.actualMeasurements?.databaseOutageFalseEffects !== 0) failures.push('databaseOutageFalseEffects');
if (report.actualMeasurements?.databaseRecoveryCommandEvents !== 1) failures.push('databaseRecoveryCommandEvents');
if (report.actualMeasurements?.apiAlertFired !== 1 || report.actualMeasurements?.apiAlertCleared !== 1) failures.push('alertContinuity');
if (report.actualMeasurements?.objectOutageFalseVerified !== 0 || report.actualMeasurements?.objectRecoveryVerified !== 1) failures.push('objectStorageRecovery');
if (report.actualMeasurements?.kafkaOutageFalseSent !== 0 || report.actualMeasurements?.kafkaRecoverySeconds > 90) failures.push('kafkaRecovery');
if (report.actualMeasurements?.pressureApiFailures !== 0) failures.push('resourcePressure');
if (report.actualMeasurements?.evacuationApiFailures !== 0 || report.actualMeasurements?.minimumWorkersDuringEvacuation < 1) failures.push('workloadEvacuation');
if (report.actualMeasurements?.migrationResidue !== 0 || report.actualMeasurements?.releaseAuthorityMismatches !== 0) failures.push('migrationRollback');
if (report.actualMeasurements?.duplicateLeaseTokens !== 0) failures.push('duplicateLeaseTokens');
if (failures.length) {
  console.error(JSON.stringify({ accepted: false, failures, report }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ accepted: true, exactCommit: exact, evidenceClass: report.evidenceClass }));
