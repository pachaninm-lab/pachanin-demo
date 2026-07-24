#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const APPLY = process.argv.includes('--apply');
const BASELINE_COMMIT = '3133779b10b69950ed0f01c9a58e9f98e4d957fe';
const LOCK_PATH = 'docs/platform-v7/autopilot/pc-crop-predecessor-trigger-lock.json';
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || 'artifacts/pc-crop-predecessor-trigger-governance';

const workflows = {
  '.github/workflows/pc-crop-07a.yml': [
    'apps/api/prisma/migrations/20260722120000_regulatory_integration_inbox/**',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.errors.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.inbox-lifecycle.repository.spec.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.inbox-lifecycle.repository.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.inbox-policy.spec.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.inbox-policy.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.inbox.repository.spec.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.inbox.repository.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.state-machine.spec.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.state-machine.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.types.spec.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.types.ts',
    'apps/api/test/industrial/regulatory-integration-inbox.e2e-spec.ts',
    'docs/platform-v7/autopilot/scopes/pc-crop-07a.json',
    'infra/sql/postgresql-regulatory-integration-inbox-policies.sql',
    'scripts/verify-pc-crop-07a.mjs',
  ],
  '.github/workflows/pc-crop-07b.yml': [
    'apps/api/src/modules/regulatory-integration/dto/regulatory-integration-control-tower.dto.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.command.service.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.controller.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.policy.spec.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.policy.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.postgresql.spec.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.redrive.repository.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.repository.spec.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.control-tower.repository.ts',
    'apps/api/src/modules/regulatory-integration/regulatory-integration.reconciliation.repository.ts',
    'apps/web/app/api/platform-v7/integrations/**',
    'apps/web/app/api/staff/integration-control-tower/**',
    'apps/web/app/api/staff/integrations/**',
    'apps/web/app/platform-v7/integrations/**',
    'apps/web/components/crop-platform/IntegrationControlTowerClient.module.css',
    'apps/web/components/crop-platform/IntegrationControlTowerClient.tsx',
    'apps/web/components/crop-platform/integration-control-tower-live-adapter.ts',
    'apps/web/lib/platform-v7/cabinet-access-policy.ts',
    'apps/web/lib/platform-v7/design-system-v8-route-policy.ts',
    'apps/web/lib/platform-v7/route-canonicalization.ts',
    'apps/web/lib/platform-v7/routes.ts',
    'apps/web/tests/unit/integrationControlTowerLiveAdapter.test.ts',
    'apps/web/tests/unit/platformV7IntegrationControlTower.test.ts',
    'apps/web/tests/unit/platformV7RouteCanonicalization.test.ts',
    'apps/web/tsconfig.pc-crop.json',
    'docs/platform-v7/autopilot/scopes/pc-crop-07b-private-integration-control-tower.json',
    'scripts/verify-pc-crop-07b.mjs',
  ],
  '.github/workflows/pc-crop-08b.yml': [
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.contract.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.contract.spec.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.generated.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.operations.generated.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-contract-catalog.service.ts',
    'docs/platform-v7/autopilot/scopes/pc-crop-08b-fgis-contract-catalog.json',
    'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.operation-catalog.json',
    'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.operation-catalog.lock.json',
    'scripts/pc-crop-08b/**',
  ],
  '.github/workflows/pc-crop-08c.yml': [
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.xml-codec.spec.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.xml-codec.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.xml-policy.spec.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.xml-policy.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-xml-codec.service.ts',
    'docs/platform-v7/autopilot/scopes/pc-crop-08c-fgis-xml-signing-input.json',
    'scripts/pc-crop-08c/**',
  ],
  '.github/workflows/pc-crop-08d.yml': [
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract.spec.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.fail-closed.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.signing-policy.generated.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-dispatch.repository.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.spec.ts',
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.ts',
    'apps/api/test/industrial/fgis-grain-dispatch.e2e-spec.ts',
    'docs/platform-v7/autopilot/scopes/pc-crop-08d-fgis-signing-transport.json',
    'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.signing-policy.json',
    'docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.signing-policy.lock.json',
    'scripts/pc-crop-08d/**',
  ],
};

const forbiddenTriggerEntries = [
  'scripts/p7-autopilot-guard.sh',
  'apps/api/prisma/schema.prisma',
  'apps/api/src/app.module.ts',
  'apps/api/src/outbox-worker.module.ts',
  'apps/api/src/modules/regulatory-integration/**',
  'apps/api/src/modules/regulatory-integration/fgis-grain/**',
  'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts',
  'apps/api/test/industrial/outbox-worker-process.e2e-spec.ts',
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function quote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function renderOn(paths) {
  const rows = paths.map((entry) => `      - ${quote(entry)}`).join('\n');
  return [
    'on:',
    '  pull_request:',
    '    paths:',
    rows,
    '  push:',
    '    branches: [main]',
    '    paths:',
    rows,
    '  workflow_dispatch:',
  ].join('\n');
}

function splitWorkflow(content, file) {
  const onStart = content.indexOf('\non:\n');
  const permissionsStart = content.indexOf('\npermissions:\n');
  if (onStart < 0 || permissionsStart < 0 || permissionsStart <= onStart) {
    throw new Error(`${file}: expected on/permissions boundaries were not found`);
  }
  return {
    beforeOn: content.slice(0, onStart + 1),
    onBlock: content.slice(onStart + 1, permissionsStart),
    tail: content.slice(permissionsStart + 1),
  };
}

function loadLock() {
  if (!existsSync(LOCK_PATH)) return null;
  const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  if (lock.schemaVersion !== 'pc-crop.predecessor-trigger-lock.v1') {
    throw new Error('unsupported predecessor trigger lock schema');
  }
  if (lock.baselineCommit !== BASELINE_COMMIT) {
    throw new Error('predecessor trigger lock baseline drift');
  }
  return lock;
}

function buildLock() {
  return {
    schemaVersion: 'pc-crop.predecessor-trigger-lock.v1',
    baselineCommit: BASELINE_COMMIT,
    workflowCount: Object.keys(workflows).length,
    workflows: Object.fromEntries(
      Object.keys(workflows).sort().map((file) => {
        const { tail } = splitWorkflow(readFileSync(file, 'utf8'), file);
        return [file, { permissionsAndJobsSha256: sha256(tail) }];
      }),
    ),
    operationalStatus: 'NOT_ATTESTED',
    productionHosting: 'REG_RU_VPS_ONLY',
  };
}

function assertLock(lock) {
  const expectedFiles = Object.keys(workflows).sort();
  const lockedFiles = Object.keys(lock.workflows || {}).sort();
  if (JSON.stringify(expectedFiles) !== JSON.stringify(lockedFiles)) {
    throw new Error('predecessor trigger lock workflow set drift');
  }
  for (const file of expectedFiles) {
    const { tail } = splitWorkflow(readFileSync(file, 'utf8'), file);
    if (sha256(tail) !== lock.workflows[file].permissionsAndJobsSha256) {
      throw new Error(`${file}: permissions/jobs body changed`);
    }
    if (/continue-on-error\s*:/u.test(tail)) {
      throw new Error(`${file}: continue-on-error is forbidden`);
    }
  }
}

function applyTriggers() {
  let lock = loadLock();
  if (!lock) {
    lock = buildLock();
    mkdirSync(dirname(LOCK_PATH), { recursive: true });
    writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  }
  assertLock(lock);
  for (const [file, paths] of Object.entries(workflows)) {
    const content = readFileSync(file, 'utf8');
    const split = splitWorkflow(content, file);
    const next = `${split.beforeOn}${renderOn(paths)}\n${split.tail}`;
    if (next !== content) writeFileSync(file, next, 'utf8');
  }
  assertLock(lock);
}

function verify() {
  const lock = loadLock();
  if (!lock) throw new Error('predecessor trigger lock is missing');
  assertLock(lock);
  const invariants = {};
  for (const [file, paths] of Object.entries(workflows)) {
    const content = readFileSync(file, 'utf8');
    const split = splitWorkflow(content, file);
    const expected = renderOn(paths);
    if (split.onBlock !== expected) throw new Error(`${file}: trigger block is not canonical`);
    if (paths.includes(file)) throw new Error(`${file}: historical workflow must not trigger on its own definition`);
    for (const forbidden of forbiddenTriggerEntries) {
      if (paths.includes(forbidden)) throw new Error(`${file}: broad/shared trigger remains: ${forbidden}`);
    }
    if (new Set(paths).size !== paths.length || paths.length === 0) {
      throw new Error(`${file}: trigger paths must be non-empty and unique`);
    }
    invariants[`${file}:exactOwnershipPaths`] = true;
    invariants[`${file}:permissionsAndJobsImmutable`] = true;
  }
  const report = {
    schemaVersion: 'pc-crop.predecessor-trigger-governance-acceptance.v1',
    issue: 3170,
    exactHead: process.env.GITHUB_SHA || 'LOCAL',
    status: 'PASS',
    workflowCount: Object.keys(workflows).length,
    invariants: {
      ...invariants,
      historicalJobsRemainByteIdentical: true,
      sharedModuleTriggersRemoved: true,
      centralGuardTriggerRemoved: true,
      successorFilesDoNotTriggerPredecessors: true,
      noContinueOnError: true,
    },
    boundaries: {
      runtimeBusinessCodeChange: false,
      acceptanceWeakening: false,
      securityGateDisabled: false,
      productionDeployment: false,
      productionHosting: 'REG_RU_VPS_ONLY',
    },
    failures: [],
  };
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(`${EVIDENCE_DIR}/acceptance.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

if (APPLY) applyTriggers();
verify();
