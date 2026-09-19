#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const INVENTORY_PATH = resolve('docs/platform-v7/autopilot/industrial-readiness-inventory.json');
const SCHEMA_PATH = resolve('docs/platform-v7/autopilot/industrial-readiness-inventory.schema.json');
const REPORT_PATH = resolve(process.env.INDUSTRIAL_READINESS_REPORT ?? 'artifacts/industrial-readiness/inventory-validation.json');
const STATUSES = [
  'IMPLEMENTED_AND_VERIFIED',
  'IMPLEMENTED_NOT_OPERATIONALLY_PROVEN',
  'PARTIAL',
  'FAIL_CLOSED',
  'BLOCKED_BY_EXTERNAL_ADMIN',
  'NOT_IMPLEMENTED',
  'DUPLICATE_AUTHORITY',
  'LEGACY',
  'NO_GO',
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
  'worker_topology',
  'object_storage',
  'postgresql_ha',
  'observability',
  'load_capacity',
  'fault_injection',
  'backup_restore_dr',
  'security_gates',
  'deployment_iac',
  'browser_i18n_accessibility',
  'external_integrations',
  'machine_evidence',
  'operational_runbooks',
  'production_soak',
];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function checkedOutCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function assert(errors, condition, message) {
  if (!condition) errors.push(message);
}

const inventory = readJson(INVENTORY_PATH);
const schema = readJson(SCHEMA_PATH);
const errors = [];
const validatedCommit = checkedOutCommit();
const expectedCommit = process.env.INDUSTRIAL_READINESS_COMMIT ?? '';

assert(errors, /^[0-9a-f]{40}$/.test(expectedCommit), 'INDUSTRIAL_READINESS_COMMIT must be a full exact-head SHA.');
assert(errors, validatedCommit === expectedCommit, `Checked out commit ${validatedCommit} does not match exact head ${expectedCommit}.`);
assert(errors, schema?.properties?.schemaVersion?.const === 1, 'Schema version contract must remain 1.');
assert(errors, inventory.schemaVersion === 1, 'Inventory schemaVersion must equal 1.');
assert(errors, inventory.repository === 'pachaninm-lab/pachanin-demo', 'Unexpected repository identifier.');
assert(errors, Number.isInteger(inventory.programIssue) && inventory.programIssue > 0, 'programIssue must be a positive integer.');
assert(errors, /^[0-9a-f]{40}$/.test(inventory.baselineCommit ?? ''), 'baselineCommit must be a full SHA.');
assert(errors, !Number.isNaN(Date.parse(inventory.auditedAt ?? '')), 'auditedAt must be ISO date-time.');
assert(errors, ['NO_GO', 'PRODUCTION_OPERATIONALLY_ACCEPTED'].includes(inventory.overallStatus), 'overallStatus is invalid.');
assert(errors, typeof inventory.decision?.productionOperationallyAccepted === 'boolean', 'decision.productionOperationallyAccepted must be boolean.');
assert(errors, Array.isArray(inventory.decision?.reasonCodes), 'decision.reasonCodes must be an array.');
assert(errors, Array.isArray(inventory.capabilities), 'capabilities must be an array.');

const capabilities = Array.isArray(inventory.capabilities) ? inventory.capabilities : [];
const ids = new Set();
const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));

for (const capability of capabilities) {
  const id = capability?.id ?? '<missing>';
  assert(errors, /^[a-z0-9_]+$/.test(id), `Invalid capability id: ${id}`);
  assert(errors, !ids.has(id), `Duplicate capability id: ${id}`);
  ids.add(id);
  assert(errors, STATUSES.includes(capability.status), `${id}: unsupported status ${capability.status}`);
  if (STATUSES.includes(capability.status)) counts[capability.status] += 1;
  assert(errors, ['P0', 'P1', 'P2'].includes(capability.severity), `${id}: invalid severity.`);
  assert(errors, typeof capability.authority === 'string' && capability.authority.length > 0, `${id}: authority is required.`);
  assert(errors, typeof capability.finding === 'string' && capability.finding.length >= 10, `${id}: finding is required.`);
  assert(errors, typeof capability.nextGate === 'string' && capability.nextGate.length >= 10, `${id}: nextGate is required.`);
  assert(errors, typeof capability.maturityBoundary === 'string' && capability.maturityBoundary.length >= 10, `${id}: maturityBoundary is required.`);
  assert(errors, typeof capability.operationalProof === 'boolean', `${id}: operationalProof must be boolean.`);

  const evidence = capability.evidence ?? {};
  for (const kind of ['implementation', 'tests', 'workflows']) {
    const paths = evidence[kind];
    assert(errors, Array.isArray(paths), `${id}: evidence.${kind} must be an array.`);
    if (!Array.isArray(paths)) continue;
    assert(errors, new Set(paths).size === paths.length, `${id}: duplicate evidence paths in ${kind}.`);
    for (const path of paths) {
      assert(errors, typeof path === 'string' && path.length > 0 && existsSync(resolve(path)), `${id}: evidence path does not exist: ${path}`);
    }
  }

  if (capability.status === 'IMPLEMENTED_AND_VERIFIED') {
    assert(errors, evidence.implementation?.length > 0, `${id}: verified capability requires implementation evidence.`);
    assert(errors, evidence.tests?.length > 0, `${id}: verified capability requires test evidence.`);
    assert(errors, evidence.workflows?.length > 0, `${id}: verified capability requires workflow evidence.`);
    assert(errors, !/in[- ]?memory/i.test(capability.authority), `${id}: in-memory authority cannot be industrially verified.`);
  }

  if (capability.operationalProof) {
    assert(errors, capability.status === 'IMPLEMENTED_AND_VERIFIED', `${id}: operationalProof=true requires IMPLEMENTED_AND_VERIFIED.`);
  }
}

for (const id of REQUIRED_CAPABILITIES) {
  assert(errors, ids.has(id), `Required capability is missing: ${id}`);
}

assert(errors, inventory.summary?.total === capabilities.length, 'summary.total does not match capability count.');
for (const status of STATUSES) {
  assert(errors, inventory.summary?.[status] === counts[status], `summary.${status}=${inventory.summary?.[status]} but calculated ${counts[status]}.`);
}

const unresolvedP0 = capabilities.filter(
  (capability) => capability.severity === 'P0' && (!capability.operationalProof || capability.status !== 'IMPLEMENTED_AND_VERIFIED'),
);
const operationallyAccepted = inventory.decision?.productionOperationallyAccepted === true;

if (unresolvedP0.length > 0) {
  assert(errors, inventory.overallStatus === 'NO_GO', 'Unresolved P0 capabilities require overallStatus=NO_GO.');
  assert(errors, !operationallyAccepted, 'Unresolved P0 capabilities prohibit productionOperationallyAccepted=true.');
}
if (operationallyAccepted) {
  assert(errors, inventory.overallStatus === 'PRODUCTION_OPERATIONALLY_ACCEPTED', 'Accepted decision requires PRODUCTION_OPERATIONALLY_ACCEPTED.');
  assert(errors, unresolvedP0.length === 0, 'Operational acceptance requires zero unresolved P0 capabilities.');
  assert(errors, inventory.decision.reasonCodes.length === 0, 'Operational acceptance requires no blocking reason codes.');
}

const report = {
  schemaVersion: 1,
  repository: inventory.repository,
  programIssue: inventory.programIssue,
  inventoryBaselineCommit: inventory.baselineCommit,
  validatedCommit,
  validatedAt: new Date().toISOString(),
  inventoryPath: 'docs/platform-v7/autopilot/industrial-readiness-inventory.json',
  overallStatus: inventory.overallStatus,
  productionOperationallyAccepted: operationallyAccepted,
  valid: errors.length === 0,
  summary: {
    ...counts,
    total: capabilities.length,
    implementationVerifiedPercent: capabilities.length
      ? Number(((counts.IMPLEMENTED_AND_VERIFIED / capabilities.length) * 100).toFixed(2))
      : 0,
    operationallyProven: capabilities.filter((capability) => capability.operationalProof).length,
    unresolvedP0: unresolvedP0.map(({ id, status, nextGate, maturityBoundary }) => ({
      id,
      status,
      nextGate,
      maturityBoundary,
    })),
  },
  errors,
};

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (errors.length) {
  console.error(`Industrial readiness inventory is invalid (${errors.length} error(s)).`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Industrial readiness inventory is valid: ${counts.IMPLEMENTED_AND_VERIFIED}/${capabilities.length} capabilities implementation-verified.`);
console.log(`Operationally proven capabilities: ${report.summary.operationallyProven}/${capabilities.length}.`);
console.log(`Unresolved P0 capabilities: ${unresolvedP0.length}.`);
console.log(`Overall status: ${inventory.overallStatus}.`);
console.log(`Validation report: ${REPORT_PATH}`);
