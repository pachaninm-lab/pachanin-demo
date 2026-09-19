#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const evidenceRoot = path.resolve(process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness');
const reportPath = path.join(evidenceRoot, 'production-like-kubernetes-evidence.json');
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

const referencedEvidence = [];
for (const field of ['logs', 'artifacts']) {
  const values = report[field];
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`Evidence ${field} must be a non-empty array`);
  }
  for (const value of values) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Evidence ${field} contains an invalid path: ${JSON.stringify(value)}`);
    }
    if (path.isAbsolute(value)) {
      throw new Error(`Evidence reference must be relative: ${value}`);
    }
    const resolved = path.resolve(evidenceRoot, value);
    const relative = path.relative(evidenceRoot, resolved);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Evidence reference escapes package root: ${value}`);
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error(`Missing referenced evidence file: ${value}`);
    }
    referencedEvidence.push(value);
  }
}

if (new Set(referencedEvidence).size !== referencedEvidence.length) {
  throw new Error('Evidence logs/artifacts contain duplicate file references');
}
