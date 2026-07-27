#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';

const EVIDENCE_DIR =
  process.env.EVIDENCE_DIR || 'artifacts/pc-crop-predecessor-trigger-governance';
const SCOPE_PATH =
  'docs/platform-v7/autopilot/scopes/pc-crop-successor-trigger-handoff-3290.json';
const WORKFLOW_08D = '.github/workflows/pc-crop-08d.yml';
const WORKFLOW_08F = '.github/workflows/pc-crop-08f.yml';
const WORKFLOW_08H = '.github/workflows/pc-crop-08h.yml';
const SHA1 = /^[a-f0-9]{40}$/u;

const dispatchShared = [
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.spec.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.ts',
  'apps/api/test/industrial/fgis-grain-dispatch.e2e-spec.ts',
];
const projectionShared = [
  'apps/api/prisma/schema.prisma',
  'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts',
];
const retained08d = [
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract.spec.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.fail-closed.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.signing-policy.generated.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-dispatch.repository.ts',
  'docs/platform-v7/autopilot/scopes/pc-crop-08d-fgis-signing-transport.json',
  'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.signing-policy.json',
  'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.signing-policy.lock.json',
  'scripts/pc-crop-08d/**',
];
const retained08f = [
  'apps/api/prisma/migrations/20260724190000_fgis_grain_sdiz_projection/**',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-*.ts',
  'apps/api/test/industrial/fgis-grain-sdiz-projection.e2e-spec.ts',
  'docs/platform-v7/autopilot/scopes/pc-crop-08f-sdiz-projection.json',
  'scripts/pc-crop-08f/**',
];

function read(file) {
  return readFileSync(file, 'utf8');
}

function gitText(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function gitLine(...args) {
  return gitText(...args).trim();
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function requireCount(haystack, needle, expected, label) {
  const actual = count(haystack, needle);
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, actual ${actual}`);
  }
}

function splitWorkflowContent(content, file) {
  const onStart = content.indexOf('\non:\n');
  const permissionsStart = content.indexOf('\npermissions:\n');
  if (onStart < 0 || permissionsStart <= onStart) {
    throw new Error(`${file}: on/permissions boundaries are missing`);
  }
  return {
    triggers: content.slice(onStart + 1, permissionsStart),
    tail: content.slice(permissionsStart + 1),
  };
}

function splitWorkflow(file) {
  return splitWorkflowContent(read(file), file);
}

function readWorkflowAt(commit, file) {
  if (!SHA1.test(commit)) {
    throw new Error(`${file}: invalid pinned commit ${commit}`);
  }
  return splitWorkflowContent(
    gitText('show', `${commit}:${file}`),
    `${commit}:${file}`,
  );
}

const d = splitWorkflow(WORKFLOW_08D);
const f = splitWorkflow(WORKFLOW_08F);
const baseSha = (process.env.GOVERNANCE_BASE_SHA || '').trim()
  || gitLine('rev-parse', 'HEAD^');
const baseD = readWorkflowAt(baseSha, WORKFLOW_08D);
const baseF = readWorkflowAt(baseSha, WORKFLOW_08F);
if (d.tail !== baseD.tail) {
  throw new Error('08D permissions/jobs body changed during trigger handoff');
}
if (f.tail !== baseF.tail) {
  throw new Error('08F permissions/jobs body changed during trigger handoff');
}

for (const path of dispatchShared) {
  requireCount(d.triggers, path, 0, `08D shared trigger handoff for ${path}`);
}
for (const path of projectionShared) {
  requireCount(f.triggers, path, 0, `08F shared trigger handoff for ${path}`);
}
requireCount(f.triggers, WORKFLOW_08F, 0, '08F workflow self-trigger isolation');
for (const path of retained08d) {
  requireCount(d.triggers, path, 2, `08D retained trigger ${path}`);
}
for (const path of retained08f) {
  requireCount(f.triggers, path, 2, `08F retained trigger ${path}`);
}

for (const [file, tail] of [[WORKFLOW_08D, d.tail], [WORKFLOW_08F, f.tail]]) {
  if (/continue-on-error\s*:/u.test(tail)) {
    throw new Error(`${file}: continue-on-error is forbidden`);
  }
}
if (!d.tail.includes('fgis-grain-outbox-dispatch.handler.spec.ts')) {
  throw new Error('08D dispatch unit regression job was removed');
}
if (!d.tail.includes('test/industrial/fgis-grain-dispatch.e2e-spec.ts')) {
  throw new Error('08D PostgreSQL dispatch regression job was removed');
}
if (!f.tail.includes('fgis-grain-sdiz-projection.contract.spec.ts')) {
  throw new Error('08F SDIZ contract regression job was removed');
}
if (!f.tail.includes('test/industrial/fgis-grain-sdiz-projection.e2e-spec.ts')) {
  throw new Error('08F PostgreSQL SDIZ regression job was removed');
}

const predecessor = read('scripts/pc-crop-predecessor-trigger-governance.mjs');
for (const path of dispatchShared) {
  requireCount(
    predecessor,
    `    '${path}',`,
    0,
    `canonical predecessor map excludes ${path}`,
  );
}

const scope = JSON.parse(read(SCOPE_PATH));
if (scope.issue !== 3290 || scope.operationalStatus !== 'NOT_ATTESTED') {
  throw new Error('successor handoff scope identity drift');
}
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') {
  throw new Error('successor handoff production boundary drift');
}
if (scope.handoffs?.successorWorkflow !== WORKFLOW_08H) {
  throw new Error('successor workflow is not pinned to PC-CROP-08H');
}
if (JSON.stringify(scope.handoffs.dispatchShared) !== JSON.stringify(dispatchShared)) {
  throw new Error('dispatch handoff registry drift');
}
if (JSON.stringify(scope.handoffs.projectionShared) !== JSON.stringify(projectionShared)) {
  throw new Error('projection handoff registry drift');
}
const successorCommit = scope.handoffs.successorCommit;
const successorBlob = scope.handoffs.successorWorkflowBlobSha;
if (!SHA1.test(successorCommit) || !SHA1.test(successorBlob)) {
  throw new Error('successor commit/blob authority is malformed');
}
execFileSync('git', ['merge-base', '--is-ancestor', successorCommit, 'FETCH_HEAD']);
const actualSuccessorBlob = gitLine('rev-parse', `${successorCommit}:${WORKFLOW_08H}`);
if (actualSuccessorBlob !== successorBlob) {
  throw new Error(
    `08H workflow blob drift: expected ${successorBlob}, actual ${actualSuccessorBlob}`,
  );
}
const h = readWorkflowAt(successorCommit, WORKFLOW_08H);
for (const path of [...dispatchShared, ...projectionShared]) {
  requireCount(h.triggers, path, 2, `08H successor trigger ${path}`);
}
if (!h.tail.includes('fgis-grain-outbox-dispatch.handler.spec.ts')) {
  throw new Error('08H transferred dispatch unit regression is absent');
}
if (!h.tail.includes('test/industrial/fgis-grain-dispatch.e2e-spec.ts')) {
  throw new Error('08H transferred dispatch PostgreSQL regression is absent');
}
if (/continue-on-error\s*:/u.test(h.tail)) {
  throw new Error('08H continue-on-error is forbidden');
}

const report = {
  schemaVersion: 'pc-crop.successor-trigger-handoff-acceptance.v1',
  issue: 3290,
  exactHead: process.env.GITHUB_SHA || 'LOCAL',
  baseSha,
  status: 'PASS',
  invariants: {
    dispatchSharedPathsRemovedFrom08D: true,
    projectionSharedPathsRemovedFrom08F: true,
    predecessorSpecificTriggersRetained: true,
    predecessorRegressionJobsRetained: true,
    predecessorJobBodiesMatchBase: true,
    workflowSelfTriggerIsolation: true,
    canonicalApplyMapUpdated: true,
    successorHandoffRegistryPinned: true,
    successorCommitReachableFromAuthorityBranch: true,
    successorWorkflowBlobPinned: true,
    successorWorkflowVerified: true,
    noContinueOnError: true,
  },
  boundaries: {
    runtimeProductMutation: false,
    acceptanceWeakening: false,
    securityException: false,
    productionDeployment: false,
  },
  operationalStatus: 'NOT_ATTESTED',
  productionHosting: 'REG_RU_VPS_ONLY',
  failures: [],
};
mkdirSync(EVIDENCE_DIR, { recursive: true });
writeFileSync(
  `${EVIDENCE_DIR}/successor-trigger-handoff.json`,
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify(report)}\n`);
