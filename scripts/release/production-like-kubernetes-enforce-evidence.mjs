#!/usr/bin/env node
import fs from 'node:fs';

const reportPath = 'artifacts/industrial-readiness/production-like-kubernetes-evidence.json';
if (!fs.existsSync(reportPath)) {
  throw new Error(`Missing machine-readable evidence: ${reportPath}`);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const exact = process.env.EXACT_HEAD;

if (!exact || !/^[0-9a-f]{40}$/.test(exact)) {
  throw new Error(`Invalid exact head: ${String(exact)}`);
}
if (report.commitSha !== exact) {
  throw new Error(`Evidence SHA ${report.commitSha} != exact head ${exact}`);
}
if (report.pass !== true || report.result !== 'PASS') {
  throw new Error(`Acceptance failed: ${report.failureReason ?? 'unknown'}`);
}
if (!Array.isArray(report.violatedThresholds) || report.violatedThresholds.length !== 0) {
  throw new Error(`Violated thresholds: ${JSON.stringify(report.violatedThresholds)}`);
}
if (report.assertions?.defaultHelmExecutableWorkloads !== 0) {
  throw new Error('Default Helm render contains executable workloads');
}
