#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';

const SCOPE_PATH =
  'docs/platform-v7/autopilot/scopes/pc-crop-10c-predecessor-trigger-handoff-3446.json';
const WORKFLOW_08H = '.github/workflows/pc-crop-08h.yml';
const WORKFLOW_08I = '.github/workflows/pc-crop-08i.yml';
const EVIDENCE_DIR =
  process.env.EVIDENCE_DIR || 'artifacts/pc-crop-10c-predecessor-trigger-handoff';
const SHA1 = /^[a-f0-9]{40}$/u;

const expectedAllowedPaths = [
  WORKFLOW_08H,
  WORKFLOW_08I,
  '.github/workflows/pc-crop-10c-predecessor-trigger-handoff.yml',
  SCOPE_PATH,
  'scripts/pc-crop-10c-predecessor-trigger-handoff.mjs',
];
const sharedTriggers = [
  'apps/api/prisma/schema.prisma',
  'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts',
];
const retained08h = [
  'apps/api/prisma/migrations/20260727192500_fgis_grain_exchange_principals/**',
  'apps/api/prisma/migrations/20260727193000_fgis_grain_exchange_receipt/**',
  'apps/api/prisma/migrations/20260727194000_fgis_grain_exchange_outbox_binding/**',
  'apps/api/prisma/migrations/20260727195000_fgis_grain_exchange_correlation_replay/**',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-exchange*.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.spec.ts',
  'apps/api/src/outbox-worker.module.ts',
  'apps/api/test/industrial/fgis-grain-dispatch.e2e-spec.ts',
  'apps/api/test/industrial/fgis-grain-exchange.e2e-spec.ts',
  'docs/platform-v7/autopilot/scopes/pc-crop-08h-exchange-receipt.json',
  'scripts/pc-crop-08h/**',
];
const retained08i = [
  'apps/api/prisma/migrations/20260728004500_fgis_grain_outbound_ack/**',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-ack*.ts',
  'apps/api/test/industrial/fgis-grain-ack.e2e-spec.ts',
  'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.ack-policy.lock.json',
  'docs/platform-v7/autopilot/scopes/pc-crop-08i-outbound-ack.json',
  'scripts/pc-crop-08i/**',
];

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function read(file) {
  return readFileSync(file, 'utf8');
}

function gitText(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function splitWorkflowContent(content, label) {
  const onStart = content.indexOf('\non:\n');
  const permissionsStart = content.indexOf('\npermissions:\n');
  if (onStart < 0 || permissionsStart <= onStart) {
    throw new Error(`${label}: on/permissions boundaries are missing`);
  }
  return {
    triggers: content.slice(onStart + 1, permissionsStart),
    tail: content.slice(permissionsStart + 1),
  };
}

function splitWorkflow(file) {
  return splitWorkflowContent(read(file), file);
}

function workflowAt(commit, file) {
  return splitWorkflowContent(gitText('show', `${commit}:${file}`), `${commit}:${file}`);
}

function checkTriggerCount(workflow, path, expected, label) {
  check(
    count(workflow.triggers, path) === expected,
    `${label}: expected ${expected} trigger entries for ${path}`,
  );
}

const scope = JSON.parse(read(SCOPE_PATH));
check(scope.schemaVersion === 'platform-v7.concurrent-scope.v1', 'scope schema mismatch');
check(scope.id === 'PC-CROP-10C-PREDECESSOR-TRIGGER-HANDOFF-3446', 'scope id mismatch');
check(scope.branch === 'fix/pc-crop-10c-predecessor-trigger-handoff-3446', 'scope branch mismatch');
check(scope.status === 'active', 'scope is not active');
check(scope.projectLockId === 'PC-CROP-REMAINDER', 'project lock mismatch');
check(scope.issue === 3446 && scope.activeSlice === 'PC-CROP-10C', 'scope issue/slice mismatch');
check(scope.operationalStatus === 'NOT_ATTESTED', 'operational status was elevated');
check(scope.productionHosting === 'REG_RU_VPS_ONLY', 'production hosting boundary changed');
check(
  JSON.stringify(scope.allowedPaths) === JSON.stringify(expectedAllowedPaths),
  'allowed paths drift',
);
check(
  JSON.stringify(scope.sharedTriggerPaths) === JSON.stringify(sharedTriggers),
  'shared trigger registry drift',
);
check(
  Object.values(scope.boundaries || {}).every((value) => value === false),
  'scope enables a forbidden boundary',
);

const workflow08h = splitWorkflow(WORKFLOW_08H);
const workflow08i = splitWorkflow(WORKFLOW_08I);
for (const path of [
  WORKFLOW_08H,
  ...sharedTriggers,
]) {
  checkTriggerCount(workflow08h, path, 0, 'PC-CROP-08H handoff');
}
for (const path of [
  WORKFLOW_08H,
  WORKFLOW_08I,
  ...sharedTriggers,
]) {
  checkTriggerCount(workflow08i, path, 0, 'PC-CROP-08I handoff');
}
for (const path of retained08h) checkTriggerCount(workflow08h, path, 2, 'PC-CROP-08H retained');
for (const path of retained08i) checkTriggerCount(workflow08i, path, 2, 'PC-CROP-08I retained');

const baseCommit = String(process.env.GOVERNANCE_BASE_SHA || scope.baseCommit || '').trim();
check(SHA1.test(baseCommit), 'base commit is malformed');
if (SHA1.test(baseCommit)) {
  const base08h = workflowAt(baseCommit, WORKFLOW_08H);
  const base08i = workflowAt(baseCommit, WORKFLOW_08I);
  check(workflow08h.tail === base08h.tail, 'PC-CROP-08H permissions/jobs changed');
  check(workflow08i.tail === base08i.tail, 'PC-CROP-08I permissions/jobs changed');
}
check(!/continue-on-error\s*:/u.test(workflow08h.tail), 'PC-CROP-08H continue-on-error is forbidden');
check(!/continue-on-error\s*:/u.test(workflow08i.tail), 'PC-CROP-08I continue-on-error is forbidden');
check(
  workflow08h.tail.includes('test/industrial/fgis-grain-exchange.e2e-spec.ts'),
  'PC-CROP-08H PostgreSQL regression job was removed',
);
check(
  workflow08i.tail.includes('test/industrial/fgis-grain-ack.e2e-spec.ts'),
  'PC-CROP-08I PostgreSQL regression job was removed',
);

const successorCommit = process.env.GITHUB_ACTIONS === 'true'
  ? scope.successor?.commit
  : process.env.PC_CROP_10C_LOCAL_SUCCESSOR_COMMIT || scope.successor?.commit;
const successorBlob = scope.successor?.workflowBlobSha;
check(SHA1.test(successorCommit || ''), 'successor commit is malformed');
check(SHA1.test(successorBlob || ''), 'successor workflow blob is malformed');
if (SHA1.test(successorCommit || '') && SHA1.test(successorBlob || '')) {
  const actualBlob = gitText('rev-parse', `${successorCommit}:${scope.successor.workflow}`).trim();
  check(actualBlob === successorBlob, 'PC-CROP-10C successor workflow blob drift');
  const successorWorkflow = workflowAt(successorCommit, scope.successor.workflow);
  for (const path of sharedTriggers) {
    checkTriggerCount(successorWorkflow, path, 2, 'PC-CROP-10C successor ownership');
  }
  checkTriggerCount(
    successorWorkflow,
    scope.successor.workflow,
    2,
    'PC-CROP-10C successor self-governance',
  );
  check(
    successorWorkflow.tail.includes('set -euo pipefail')
      && successorWorkflow.tail.includes('fgis-grain-tenant-read.e2e-spec.ts'),
    'PC-CROP-10C fail-closed acceptance owner is incomplete',
  );
}

const report = {
  schemaVersion: 'pc-crop-10c.predecessor-trigger-handoff-acceptance.v1',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  exactHead: process.env.GITHUB_SHA || 'LOCAL',
  issue: 3446,
  slice: 'PC-CROP-10C',
  baseCommit,
  successorCommit: scope.successor?.commit,
  successorWorkflowBlobSha: successorBlob,
  retainedTriggerCounts: {
    pcCrop08h: retained08h.length,
    pcCrop08i: retained08i.length,
  },
  boundaries: scope.boundaries,
  operationalStatus: scope.operationalStatus,
  productionHosting: scope.productionHosting,
  failures,
};
mkdirSync(EVIDENCE_DIR, { recursive: true });
writeFileSync(
  `${EVIDENCE_DIR}/acceptance.json`,
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(failures.length === 0 ? 0 : 1);
