#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness';
const reportPath = path.join(root, 'production-like-kubernetes-evidence.json');
const failurePath = path.join(root, 'kubernetes', 'failure-reason.txt');

fs.mkdirSync(root, { recursive: true });

if (fs.existsSync(reportPath)) {
  process.exit(0);
}

const failureReason = fs.existsSync(failurePath)
  ? fs.readFileSync(failurePath, 'utf8').trim()
  : 'acceptance process exited before the in-process evidence finalizer produced its report';

const report = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY || 'pachaninm-lab/pachanin-demo',
  commitSha: process.env.EXACT_HEAD || null,
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'unknown',
  environment: 'github-actions-multi-node-kind-production-like',
  timestamp: new Date().toISOString(),
  command: 'bash scripts/release/production-like-kubernetes-acceptance.sh',
  result: 'FAIL',
  pass: false,
  failureReason: failureReason || 'acceptance failed before evidence finalization',
  violatedThresholds: ['evidenceFinalizerMissing'],
  maturityBoundary:
    'No production maturity claim. This fallback report records an incomplete disposable acceptance run only.',
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
