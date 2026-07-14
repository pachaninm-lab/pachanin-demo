#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const INVENTORY_PATH = resolve('docs/platform-v7/industrial-readiness-inventory.json');
const SCHEMA_PATH = resolve('docs/platform-v7/industrial-readiness-inventory.schema.json');
const REPORT_PATH = resolve(
  process.env.INDUSTRIAL_READINESS_REPORT
    ?? 'artifacts/industrial-readiness/inventory-validation.json',
);

const STATUSES = [
  'IMPLEMENTED_AND_VERIFIED',
  'IMPLEMENTED_NOT_VERIFIED',
  'PARTIAL',
  'FAIL_CLOSED',
  'MOCK_ONLY',
  'LEGACY',
  'DUPLICATE_AUTHORITY',
  'NOT_IMPLEMENTED',
  'OUT_OF_RELEASE_SCOPE',
];

const REQUIRED_CAPABILITIES = [
  'release_status_checks',
  'auth_sessions',
  'membership_rbac_tenant',
  'deal_command_core',
  'auction_execution',
  'logistics_acceptance',
  'laboratory',
  'documents_evidence',
  'settlement_ledger_callbacks',
  'disputes',
  'audit_outbox',
  'observability',
  'load_capacity',
  'fault_injection',
  'backup_restore_dr',
  'security_gates',
  'deployment_iac',
  'browser_i18n_accessibility',
  'external_integrations',
  'machine_evidence',
];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function currentCommit() {
  if (/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA ?? '')) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function push(errors, condition, message) {
  if (!condition) errors.push(message);
}

const inventory = readJson(INVENTORY_PATH);
const schema = readJson(SCHEMA_PATH);
const errors = [];

push(errors, schema?.properties?.schemaVersion?.const === 1, 'Schema version contract must remain 1.');
push(errors, inventory.schemaVersion === 1, 'Inventory schemaVersion must equal 1.');
push(errors, inventory.repository === 'pachaninm-lab/pachanin-demo', 'Unexpected repository identifier.');
push(errors, Number.isInteger(inventory.programIssue) && inventory.programIssue > 0, 'programIssue must be a positive integer.');
push(errors, /^[0-9a-f]{40}$/.test(inventory.baselineCommit ?? ''), 'baselineCommit must be a full 40-character SHA.');
push(errors, !Number.isNaN(Date.parse(inventory.auditedAt ?? '')), 'auditedAt must be an ISO date-time.');
push(errors, Array.isArray(inventory.capabilities), 'capabilities must be an array.');

const capabilities = Array.isArray(inventory.capabilities) ? inventory.capabilities : [];
const ids = new Set();
const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));

for (const capability of capabilities) {
  const id = capability?.id ?? '<missing>';
  push(errors, /^[a-z0-9_]+$/.test(id), `Capability id is invalid: ${id}`);
  push(errors, !ids.has(id), `Duplicate capability id: ${id}`);
  ids.add(id);

  push(errors, STATUSES.includes(capability.status), `${id}: unsupported status ${capability.status}`);
  if (STATUSES.includes(capability.status)) counts[capability.status] += 1;
  push(errors, ['P0', 'P1', 'P2'].includes(capability.severity), `${id}: severity must be P0, P1 or P2.`);
  push(errors, typeof capability.authority === 'string' && capability.authority.length > 0, `${id}: authority is required.`);
  push(errors, typeof capability.finding === 'string' && capability.finding.length >= 10, `${id}: finding is required.`);
  push(errors, typeof capability.nextGate === 'string' && capability.nextGate.length >= 10, `${id}: nextGate is required.`);

  const evidence = capability.evidence ?? {};
  for (const kind of ['implementation', 'tests', 'workflows']) {
    const paths = evidence[kind];
    push(errors, Array.isArray(paths), `${id}: evidence.${kind} must be an array.`);
    if (!Array.isArray(paths)) continue;
    const unique = new Set(paths);
    push(errors, unique.size === paths.length, `${id}: evidence.${kind} contains duplicates.`);
    for (const path of paths) {
      push(errors, typeof path === 'string' && path.length > 0, `${id}: empty evidence path in ${kind}.`);
      if (typeof path === 'string' && path.length > 0) {
        push(errors, existsSync(resolve(path)), `${id}: evidence path does not exist: ${path}`);
      }
    }
  }

  if (capability.status === 'IMPLEMENTED_AND_VERIFIED') {
    push(errors, evidence.implementation?.length > 0, `${id}: verified capability requires implementation evidence.`);
    push(errors, evidence.tests?.length > 0, `${id}: verified capability requires automated test evidence.`);
    push(errors, evidence.workflows?.length > 0, `${id}: verified capability requires CI workflow evidence.`);
    push(errors, !/in[- ]?memory/i.test(capability.authority), `${id}: in-memory authority cannot be verified industrial authority.`);
  }
}

for (const id of REQUIRED_CAPABILITIES) {
  push(errors, ids.has(id), `Required capability is missing: ${id}`);
}

push(errors, inventory.summary?.total === capabilities.length, 'summary.total does not match capability count.');
for (const status of STATUSES) {
  push(
    errors,
    inventory.summary?.[status] === counts[status],
    `summary.${status}=${inventory.summary?.[status]} but calculated ${counts[status]}.`,
  );
}

const verified = counts.IMPLEMENTED_AND_VERIFIED;
const unresolvedP0 = capabilities.filter(
  (capability) => capability.severity === 'P0' && capability.status !== 'IMPLEMENTED_AND_VERIFIED',
);
const report = {
  schemaVersion: 1,
  repository: inventory.repository,
  programIssue: inventory.programIssue,
  inventoryBaselineCommit: inventory.baselineCommit,
  validatedCommit: currentCommit(),
  validatedAt: new Date().toISOString(),
  inventoryPath: 'docs/platform-v7/industrial-readiness-inventory.json',
  valid: errors.length === 0,
  summary: {
    ...counts,
    total: capabilities.length,
    verifiedPercent: capabilities.length === 0 ? 0 : Number(((verified / capabilities.length) * 100).toFixed(2)),
    unresolvedP0: unresolvedP0.map(({ id, status, nextGate }) => ({ id, status, nextGate })),
  },
  errors,
};

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (errors.length > 0) {
  console.error(`Industrial readiness inventory is invalid (${errors.length} error(s)).`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Industrial readiness inventory is valid: ${verified}/${capabilities.length} capabilities verified.`);
console.log(`Unresolved P0 capabilities: ${unresolvedP0.length}.`);
console.log(`Validation report: ${REPORT_PATH}`);
