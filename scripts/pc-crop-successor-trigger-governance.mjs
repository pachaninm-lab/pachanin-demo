#!/usr/bin/env node
import {
  existsSync,
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
  '.github/workflows/pc-crop-08f.yml',
  'apps/api/prisma/migrations/20260724190000_fgis_grain_sdiz_projection/**',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-*.ts',
  'apps/api/test/industrial/fgis-grain-sdiz-projection.e2e-spec.ts',
  'docs/platform-v7/autopilot/scopes/pc-crop-08f-sdiz-projection.json',
  'scripts/pc-crop-08f/**',
];

function read(file) {
  return readFileSync(file, 'utf8');
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

function splitWorkflow(file) {
  const content = read(file);
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

const d = splitWorkflow(WORKFLOW_08D);
const f = splitWorkflow(WORKFLOW_08F);

for (const path of dispatchShared) {
  requireCount(d.triggers, path, 0, `08D shared trigger handoff for ${path}`);
}
for (const path of projectionShared) {
  requireCount(f.triggers, path, 0, `08F shared trigger handoff for ${path}`);
}
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

let successorWorkflowVerified = false;
if (existsSync(WORKFLOW_08H)) {
  const h = splitWorkflow(WORKFLOW_08H);
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
  successorWorkflowVerified = true;
}

const report = {
  schemaVersion: 'pc-crop.successor-trigger-handoff-acceptance.v1',
  issue: 3290,
  exactHead: process.env.GITHUB_SHA || 'LOCAL',
  status: 'PASS',
  invariants: {
    dispatchSharedPathsRemovedFrom08D: true,
    projectionSharedPathsRemovedFrom08F: true,
    predecessorSpecificTriggersRetained: true,
    predecessorRegressionJobsRetained: true,
    canonicalApplyMapUpdated: true,
    successorHandoffRegistryPinned: true,
    successorWorkflowVerified,
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
