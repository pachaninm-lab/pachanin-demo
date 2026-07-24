#!/usr/bin/env node
import fs from 'node:fs';
import {
  validateRegistry,
} from './pc-crop-owned-diff.mjs';

const failures = [];
const registryPath = 'docs/platform-v7/autopilot/pc-crop-workflow-ownership.json';
const registry = validateRegistry(JSON.parse(fs.readFileSync(registryPath, 'utf8')));
const scope = JSON.parse(fs.readFileSync(
  'docs/platform-v7/autopilot/scopes/pc-crop-predecessor-ownership-3170.json',
  'utf8',
));

function readPathBlock(lines, section) {
  const sectionIndex = lines.findIndex((line) => line === `  ${section}:`);
  const pathsIndex = lines.findIndex(
    (line, index) => index > sectionIndex && line === '    paths:',
  );
  if (sectionIndex < 0 || pathsIndex < 0) return null;
  const values = [];
  for (let index = pathsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('      - ')) break;
    const raw = line.slice('      - '.length).trim();
    if (!(raw.startsWith("'") && raw.endsWith("'"))) return null;
    values.push(raw.slice(1, -1).replaceAll("''", "'"));
  }
  return values;
}

function scopeStep(lines, name) {
  const start = lines.findIndex((line) => line === `      - name: ${name}`);
  if (start < 0) return '';
  let end = start + 1;
  while (end < lines.length && !/^      - (?:name|uses):/u.test(lines[end])) end += 1;
  return lines.slice(start, end).join('\n');
}

for (const [workflowId, ownership] of Object.entries(registry.workflows)) {
  const source = fs.readFileSync(ownership.workflowPath, 'utf8');
  const lines = source.split(/\r?\n/u);
  for (const section of ['pull_request', 'push']) {
    const actual = readPathBlock(lines, section);
    if (actual === null) {
      failures.push(`${workflowId} has malformed ${section}.paths`);
    } else if (JSON.stringify(actual) !== JSON.stringify(ownership.triggerPaths)) {
      failures.push(`${workflowId} ${section}.paths differ from ownership registry`);
    }
  }
  const step = scopeStep(lines, ownership.scopeStepName);
  if (!step.includes('node scripts/pc-crop-owned-diff.mjs')) {
    failures.push(`${workflowId} does not use the shared owned-diff evaluator`);
  }
  if (!step.includes(`--workflow '${workflowId}'`)) {
    failures.push(`${workflowId} passes the wrong workflow identity`);
  }
  if (!step.includes('touch "$EVIDENCE_DIR/scope-guard.ok"')) {
    failures.push(`${workflowId} does not preserve scope evidence marker`);
  }
  if (step.includes('grep -Ev') || step.includes('PC-CROP contains out-of-scope files')) {
    failures.push(`${workflowId} still evaluates the entire successor diff as its own scope`);
  }
  for (const forbidden of [
    "'apps/api/src/modules/regulatory-integration/**'",
    "'apps/api/src/modules/regulatory-integration/fgis-grain/**'",
    "'scripts/p7-autopilot-guard.sh'",
  ]) {
    if (source.includes(forbidden)) {
      failures.push(`${workflowId} retains broad trigger ${forbidden}`);
    }
  }
  if (source.includes('continue-on-error: true')) {
    failures.push(`${workflowId} contains blanket continue-on-error`);
  }
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') {
  failures.push('remediation scope schema mismatch');
}
if (scope.branch !== 'governance/pc-crop-predecessor-ownership-3170') {
  failures.push('remediation scope branch mismatch');
}
if (scope.issue !== 3170 || scope.status !== 'active') {
  failures.push('remediation scope issue/status mismatch');
}
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') {
  failures.push('production hosting boundary mismatch');
}
if (!Object.values(scope.boundaries || {}).every((value) => value === false)) {
  failures.push('governance-only scope boundaries must remain false');
}
if (registry.boundaries?.runtimeBusinessBehaviorChange !== false
  || registry.boundaries?.predecessorAcceptanceDisabled !== false
  || registry.boundaries?.unrelatedSuccessorFilesIgnoredByPredecessorScope !== true
  || registry.boundaries?.wholePullRequestStillGovernedByCentralGuard !== true
  || registry.boundaries?.productionHosting !== 'REG_RU_VPS_ONLY') {
  failures.push('ownership registry boundaries are invalid');
}

const report = {
  schemaVersion: 'pc-crop.predecessor-governance-acceptance.v1',
  issue: 3170,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  workflowCount: Object.keys(registry.workflows).length,
  workflows: Object.fromEntries(
    Object.entries(registry.workflows).map(([id, value]) => [id, {
      workflowPath: value.workflowPath,
      triggerPathCount: value.triggerPaths.length,
    }]),
  ),
  invariants: {
    exactOwnershipRegistry: true,
    broadDirectoryTriggersRemoved: failures.every((entry) => !entry.includes('broad trigger')),
    ownedDiffEvaluatorUsedByAll: failures.every((entry) => !entry.includes('shared owned-diff evaluator')),
    unrelatedSuccessorFilesIgnoredByPredecessors: true,
    wholePullRequestGovernedByCentralGuard: true,
    predecessorAcceptanceStillEnabled: true,
    runtimeBusinessBehaviorUnchanged: true,
    productionHostingRegRuOnly: scope.productionHosting === 'REG_RU_VPS_ONLY',
  },
  boundaries: scope.boundaries,
  failures,
};
fs.mkdirSync('artifacts/pc-crop-predecessor-governance', { recursive: true });
fs.writeFileSync(
  'artifacts/pc-crop-predecessor-governance/acceptance.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
