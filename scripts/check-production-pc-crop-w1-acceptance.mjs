import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export const TARGET_MIGRATIONS = Object.freeze({
  '20260904120000_organization_capability_authority': '76ed191c53692f735bda03dfe27fae36d7f13f76837b6b21f5ea185e65c885ef',
  '20260904210000_provider_registry_authority': '8319788c3e02c692b39ce35a55b37704a08354f4a41e362b7348233e3669c49d',
  '20260904230000_integration_binding_authority': '7f990604f5824090a62305a5e0e568e12aa1fef3b3f1b73fff0b910cc7c95132',
  '20260905010000_commercial_rules_authority': '61ced1969badeb3cd257b3c8ca6fba037a3a6ffb19d60a8bbeef82e877c587a4',
  '20260905030000_service_marketplace_authority': 'cb936ef015f11aecf1e1f750807cd0af712284874ab8e5fcb99801507561c8e3',
  '20260905040000_inventory_reservation_authority': 'f10e5d8abb3247087f8b97c01b063700f7ba29f5cbcf30d209c5a6fa587b4ff4',
  '20260905100000_auction_inventory_binding': '3659a16fe4e5e5a2a755ab9510835239efa641d0c6a1991ab21f7b1f904174dd',
});
export const TARGET_TABLES = Object.freeze([
  ...['organization_capability_assignments', 'organization_capability_events', 'providers', 'provider_capabilities',
    'service_offerings', 'provider_registry_evidence', 'provider_registry_events', 'integration_bindings',
    'integration_capability_evidence', 'integration_binding_events', 'commercial_rule_sets', 'commercial_rule_packs',
    'commercial_decisions', 'commercial_rule_events', 'service_marketplace_requests', 'service_marketplace_quotes',
    'service_marketplace_events'].map(name => `public.${name}`),
  ...['availability_policies', 'batches', 'positions', 'reservations', 'availability_snapshots', 'command_events'].map(name => `inventory.${name}`),
  'auction.inventory_bindings',
]);
const SAFE_ERROR = /^[A-Z][A-Z0-9_]{2,95}$/;
export function blocked(code) { throw new Error(code); }
export function errorCode(error) { return SAFE_ERROR.test(error?.message ?? '') ? error.message : 'UNCLASSIFIED_PROBE_FAILURE'; }
export function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
const LEDGER_COUNTS = ['ROWS', 'MATCHED', 'DRIFTED', 'UNKNOWN', 'DUPLICATES', 'UNFINISHED', 'ROLLED_BACK', 'LEGACY_INITIAL_MARKERS'];
const LEDGER_BLOCKERS = ['APPLIED_MIGRATION_CHECKSUM_DRIFT', 'UNFINISHED_MIGRATION', 'UNRECOGNIZED_APPLIED_MIGRATION', 'DUPLICATE_APPLIED_MIGRATION', 'PENDING_SET_NOT_EXACT_SEVEN'];
// Diagnostic only: this observation is never consulted by migration admission.
export function ledgerDiagnostics(manifest, ledger) {
  const counts = Object.fromEntries(LEDGER_COUNTS.map(key => [key, 0]));
  const names = new Set();
  const fingerprints = [];
  for (const row of ledger) {
    counts.ROWS++;
    fingerprints.push(sha256(JSON.stringify([row.migration_name, row.checksum, row.finished_at, row.rolled_back_at])));
    if (row.rolled_back_at != null) { counts.ROLLED_BACK++; continue; }
    if (row.finished_at == null) { counts.UNFINISHED++; continue; }
    if (names.has(row.migration_name)) counts.DUPLICATES++;
    names.add(row.migration_name);
    if (!Object.hasOwn(manifest, row.migration_name)) { counts.UNKNOWN++; continue; }
    if (row.checksum === manifest[row.migration_name]) counts.MATCHED++;
    else counts.DRIFTED++;
    if (row.migration_name === '0001_postgresql_initial' && row.checksum === 'grainflow_v3_initial_postgresql') counts.LEGACY_INITIAL_MARKERS++;
  }
  return { ...counts, SHA256: sha256(JSON.stringify(fingerprints.sort())) };
}
export function probeErrorPayload(error) {
  const payload = { error: errorCode(error) };
  const drift = error?.checksumDrift;
  if (payload.error === 'APPLIED_MIGRATION_CHECKSUM_DRIFT' && drift
    && /^[0-9a-f]{64}$/.test(drift.migrationSha256 ?? '')
    && /^[0-9a-f]{64}$/.test(drift.expectedSha256 ?? '')
    && /^(?:[0-9a-f]{64}|INVALID)$/.test(drift.appliedSha256 ?? '')) {
    payload.checksumDrift = { migrationSha256: drift.migrationSha256, expectedSha256: drift.expectedSha256, appliedSha256: drift.appliedSha256 };
    if (/^[0-9a-f]{64}$/.test(drift.appliedValueSha256 ?? '')) payload.checksumDrift.appliedValueSha256 = drift.appliedValueSha256;
  }
  const ledger = error?.ledgerDiagnostics;
  if (LEDGER_BLOCKERS.includes(payload.error) && (payload.error !== 'APPLIED_MIGRATION_CHECKSUM_DRIFT' || payload.checksumDrift) && ledger
    && LEDGER_COUNTS.every(key => Number.isSafeInteger(ledger[key]) && ledger[key] >= 0 && ledger[key] <= 10000)
    && /^[0-9a-f]{64}$/.test(ledger.SHA256 ?? '')) {
    payload.ledgerDiagnostics = Object.fromEntries([...LEDGER_COUNTS, 'SHA256'].map(key => [key, ledger[key]]));
  }
  return payload;
}
export function probeDiagnostics(value) {
  const safe = probeErrorPayload({ message: value?.error, checksumDrift: value?.checksumDrift, ledgerDiagnostics: value?.ledgerDiagnostics });
  return Object.entries(safe.checksumDrift ?? {}).map(([key, hash]) =>
    `PC_W1_CHECKSUM_DRIFT_${{migrationSha256:'MIGRATION',expectedSha256:'EXPECTED',appliedSha256:'APPLIED',appliedValueSha256:'APPLIED_VALUE'}[key]}_SHA256=${hash}\n`).join('')
    + (safe.ledgerDiagnostics ? Object.entries(safe.ledgerDiagnostics).map(([key, value]) => `PC_W1_LEDGER_${key}=${value}\n`).join('') : '');
}
function sortedObject(value) { return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))); }
const MIGRATION_NAME = /^(?:0001_postgresql_initial|[0-9]{14}_[a-z0-9_]+)$/;

export function readMigrationManifest(root) {
  const result = {};
  for (const name of fs.readdirSync(root).sort()) {
    const entry = path.join(root, name);
    if (name === 'migration_lock.toml') {
      if (!fs.lstatSync(entry).isFile()) blocked('MIGRATION_LOCK_FILE_INVALID');
      continue;
    }
    if (!MIGRATION_NAME.test(name) || !fs.lstatSync(entry).isDirectory()) blocked('MIGRATION_DIRECTORY_INVALID');
    const file = path.join(entry, 'migration.sql');
    if (!fs.lstatSync(file).isFile()) blocked('MIGRATION_SQL_FILE_INVALID');
    result[name] = sha256(fs.readFileSync(file));
  }
  return validateManifest(result);
}

export function validateManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) blocked('REPOSITORY_MANIFEST_INVALID');
  for (const [name, checksum] of Object.entries(value)) {
    if (!MIGRATION_NAME.test(name) || !/^[0-9a-f]{64}$/.test(checksum)) blocked('REPOSITORY_MANIFEST_INVALID');
  }
  for (const [name, checksum] of Object.entries(TARGET_MIGRATIONS)) {
    if (value[name] !== checksum) blocked('ACCEPTED_MIGRATION_CHECKSUM_MISMATCH');
  }
  return sortedObject(value);
}
export function decodeManifest(value) {
  try { return validateManifest(JSON.parse(Buffer.from(value, 'base64').toString('utf8'))); }
  catch (error) { blocked(SAFE_ERROR.test(error?.message ?? '') ? error.message : 'REPOSITORY_MANIFEST_INVALID'); }
}
export function validateImageManifest(expected, actual) {
  if (JSON.stringify(validateManifest(expected)) !== JSON.stringify(validateManifest(actual))) blocked('IMAGE_MIGRATION_SET_MISMATCH');
}
export function classifyLedger(manifestInput, ledger) {
  const manifest = validateManifest(manifestInput);
  if (!Array.isArray(ledger)) blocked('MIGRATION_LEDGER_INVALID');
  const diagnostics = ledgerDiagnostics(manifest, ledger);
  try {
  if (ledger.some(row => row.finished_at == null && row.rolled_back_at == null)) blocked('UNFINISHED_MIGRATION');
  const applied = new Map();
  for (const row of ledger) {
    if (row.rolled_back_at != null || row.finished_at == null) continue;
    if (!Object.hasOwn(manifest, row.migration_name)) blocked('UNRECOGNIZED_APPLIED_MIGRATION');
    if (applied.has(row.migration_name)) blocked('DUPLICATE_APPLIED_MIGRATION');
    if (row.checksum !== manifest[row.migration_name]) {
      const error = new Error('APPLIED_MIGRATION_CHECKSUM_DRIFT');
      error.checksumDrift = { migrationSha256: sha256(row.migration_name), expectedSha256: manifest[row.migration_name],
        appliedSha256: typeof row.checksum === 'string' && /^[0-9a-f]{64}$/.test(row.checksum) ? row.checksum : 'INVALID',
        appliedValueSha256: sha256(JSON.stringify(row.checksum ?? null)) };
      throw error;
    }
    applied.set(row.migration_name, row);
  }
  const pending = Object.keys(manifest).filter(name => !applied.has(name));
  if (pending.length === 0) return { decision: 'VERIFIED_ALREADY_APPLIED', pendingCount: 0 };
  if (JSON.stringify(pending) !== JSON.stringify(Object.keys(TARGET_MIGRATIONS))) blocked('PENDING_SET_NOT_EXACT_SEVEN');
  return { decision: 'READY_EXACT_SEVEN', pendingCount: 7 };
  } catch (error) {
    if (LEDGER_BLOCKERS.includes(errorCode(error))) error.ledgerDiagnostics = diagnostics;
    throw error;
  }
}

export function validateApiEnvironment(env) {
  if (env.NODE_ENV !== 'production') blocked('API_NOT_PRODUCTION');
  for (const name of ['DEAL', 'DOCUMENT', 'SHIPMENT', 'LAB', 'PAYMENT']) {
    if (env[`PLATFORM_V7_${name}_REPOSITORY`] !== 'prisma') blocked('NON_POSTGRESQL_RUNTIME_AUTHORITY');
  }
  for (const [key, raw] of Object.entries(env)) {
    const value = String(raw ?? '').trim().toLowerCase();
    if (key.endsWith('_MODE') && ['stub', 'mock', 'fake', 'demo', 'sandbox', 'test'].includes(value)) blocked('NON_LIVE_INTEGRATION_MODE_ENABLED');
  }
  for (const key of ['AUTH_TEST_ACCOUNTS_ENABLED', 'ALLOW_RUNTIME_MUTATION']) {
    if (['1', 'true'].includes(String(env[key] ?? '').trim().toLowerCase())) blocked('TEST_RUNTIME_ENABLED');
  }
  if (['1', 'true'].includes(String(env.ROLE_ELIGIBILITY_ENFORCEMENT ?? '').trim().toLowerCase())) blocked('ELIGIBILITY_ENFORCEMENT_ENABLED');
  // The accepted API service defaults absent/empty shadow mode to true.
  if (String(env.ROLE_ELIGIBILITY_SHADOW_MODE || 'true').toLowerCase() !== 'true') blocked('ELIGIBILITY_SHADOW_NOT_CONFIRMED');
}

export function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || value.error) blocked(value?.error && SAFE_ERROR.test(value.error) ? value.error : 'SNAPSHOT_PROBE_INVALID');
  if (!/^[0-9A-F]{8}-[0-9A-F]{8}-[1-9][0-9]*$/.test(value.snapshot ?? '')) blocked('SNAPSHOT_TOKEN_INVALID');
  if (!/^pc_w1_[0-9a-f]{32}$/.test(value.nonce ?? '')) blocked('SNAPSHOT_NONCE_INVALID');
  for (const key of ['pid', 'databaseOid', 'roleOid']) if (!Number.isSafeInteger(value[key]) || value[key] <= 0) blocked('SNAPSHOT_IDENTITY_INVALID');
  if (!['READY_EXACT_SEVEN', 'VERIFIED_ALREADY_APPLIED'].includes(value.decision)) blocked('SNAPSHOT_DECISION_INVALID');
  if (value.pendingCount !== (value.decision === 'READY_EXACT_SEVEN' ? 7 : 0)) blocked('SNAPSHOT_PENDING_COUNT_INVALID');
  if (!/^[0-9a-f]{64}$/.test(value.environmentHash ?? '')) blocked('API_ENVIRONMENT_HASH_INVALID');
  if (value.tables !== (value.pendingCount === 7 ? 0 : 24)
    || !(value.pendingCount === 7 ? ['NOT_APPLIED'] : ['PASS','OBSERVED_NOT_MATCHED']).includes(value.structuralChecks)) blocked('SNAPSHOT_SCHEMA_INVALID');
  if (value.pendingCount === 0 && !/^[0-9a-f]{64}$/.test(value.catalogHash ?? '')) blocked('SNAPSHOT_CATALOG_HASH_INVALID');
  return value;
}
export function snapshotSql(input) {
  const value = validateSnapshot(input);
  return `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET TRANSACTION SNAPSHOT '${value.snapshot}';
SET LOCAL statement_timeout = '15000ms';
DO $pc_w1_identity$
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN RAISE EXCEPTION 'READ_ONLY_REQUIRED'; END IF;
  IF pg_is_in_recovery() THEN RAISE EXCEPTION 'PRIMARY_DATABASE_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datname=current_database() AND oid=${value.databaseOid})
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid=${value.pid} AND datid=${value.databaseOid}
      AND usesysid=${value.roleOid} AND application_name='${value.nonce}')
  THEN RAISE EXCEPTION 'API_MIGRATION_DATABASE_MISMATCH'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND (rolsuper OR rolcreaterole))
    OR NOT pg_has_role(current_user,(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public._prisma_migrations'::regclass),'USAGE')
  THEN RAISE EXCEPTION 'MIGRATION_PRINCIPAL_AUTHORITY_REQUIRED'; END IF;
END
$pc_w1_identity$;
COMMIT;
`;
}

export function validateMigrationImage(image, target, digest) {
  if (!/^[0-9a-f]{40}$/.test(target ?? '') || !/^ghcr\.io\/pachaninm-lab\/grainflow-migration@sha256:[0-9a-f]{64}$/.test(digest ?? '')) blocked('MIGRATION_IMAGE_REFERENCE_INVALID');
  if (!image?.RepoDigests?.includes(digest) || !/^sha256:[0-9a-f]{64}$/.test(image.Id ?? '')) blocked('MIGRATION_IMAGE_DIGEST_MISMATCH');
  const config = image.Config;
  if (config?.Labels?.['org.opencontainers.image.revision'] !== target) blocked('MIGRATION_IMAGE_REVISION_MISMATCH');
  if (!['nonroot', '65532', '65532:65532', 'nonroot:nonroot'].includes(config.User)) blocked('MIGRATION_IMAGE_USER_INVALID');
  if (config.WorkingDir !== '/app' || JSON.stringify(config.Entrypoint) !== JSON.stringify(['/nodejs/bin/node'])
    || JSON.stringify(config.Cmd) !== JSON.stringify(['node_modules/prisma/build/index.js','migrate','deploy','--schema','prisma/schema.prisma'])) blocked('MIGRATION_IMAGE_COMMAND_INVALID');
}

export function validateCompose(config) {
  const services = Object.entries(config?.services ?? {});
  const candidates = services.filter(([, service]) => /^ghcr\.io\/pachaninm-lab\/grainflow-migration(?::|@)/.test(service.image ?? ''));
  if (candidates.length !== 1) blocked('MIGRATION_SERVICE_AMBIGUOUS');
  const [name, migration] = candidates[0];
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) blocked('MIGRATION_SERVICE_NAME_INVALID');
  // Existing migration network and credentials stay authoritative. Arbitrary
  // bind mounts, alternate commands or root users must not replace image code.
  if (migration.volumes?.length || migration.configs?.length || migration.secrets?.length
    || migration.entrypoint != null || migration.command != null || migration.user != null || migration.working_dir != null
    || migration.privileged || migration.network_mode === 'host') blocked('MIGRATION_SERVICE_RUNTIME_OVERRIDE');
  if (!config.services.api) blocked('API_COMPOSE_SERVICE_MISSING');
  return name;
}

export function runtimeFingerprint(containers, excludedApi) {
  if (!Array.isArray(containers) || !containers.length) blocked('RUNTIME_CONTAINER_INVENTORY_EMPTY');
  const inventory = containers.filter(item => item.Id !== excludedApi).map(item => {
    if (!/^[0-9a-f]{64}$/.test(item.Id ?? '') || !item.State?.StartedAt || !/^sha256:[0-9a-f]{64}$/.test(item.Image ?? '')) blocked('RUNTIME_CONTAINER_IDENTITY_INVALID');
    if (item.State.Running && (String(item.Config?.Labels?.['com.docker.compose.service'] ?? '').includes('role-eligibility')
      || JSON.stringify(item.Config?.Cmd ?? []).includes('role-eligibility-worker'))) {
      const env=Object.fromEntries((item.Config?.Env ?? []).map(value => { const index=value.indexOf('='); return [value.slice(0,index),value.slice(index+1)]; }));
      if (env.ROLE_ELIGIBILITY_SHADOW_MODE !== 'true' || String(env.ROLE_ELIGIBILITY_ENFORCEMENT ?? '').trim().toLowerCase() === 'true') blocked('ELIGIBILITY_WORKER_NOT_SHADOW');
    }
    return { id: item.Id, image: item.Image, state: { running: item.State.Running, startedAt: item.State.StartedAt },
      config: item.Config, host: item.HostConfig, mounts: item.Mounts,
      networks: Object.fromEntries(Object.entries(item.NetworkSettings?.Networks ?? {}).map(([name, network]) => [name, {
        NetworkID: network.NetworkID, EndpointID: network.EndpointID, IPAddress: network.IPAddress,
      }]).sort(([a],[b]) => a.localeCompare(b))) };
  }).sort((a,b) => a.id.localeCompare(b.id));
  return sha256(JSON.stringify(inventory));
}

export const EVIDENCE_VALUES = Object.freeze({
  PC_W1_RESULT: /^(READY_EXACT_SEVEN|VERIFIED_ALREADY_APPLIED|MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE|BLOCKED)$/,
  PC_W1_ERROR: SAFE_ERROR,
  PC_W1_CHECKSUM_DRIFT_MIGRATION_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_CHECKSUM_DRIFT_EXPECTED_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_CHECKSUM_DRIFT_APPLIED_SHA256: /^(?:[0-9a-f]{64}|INVALID)$/,
  PC_W1_CHECKSUM_DRIFT_APPLIED_VALUE_SHA256: /^[0-9a-f]{64}$/,
  ...Object.fromEntries(LEDGER_COUNTS.map(key => [`PC_W1_LEDGER_${key}`, /^(?:0|[1-9][0-9]{0,3}|10000)$/])),
  PC_W1_LEDGER_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_TARGET_SHA: /^[0-9a-f]{40}$/,
  PC_W1_BASELINE_API_SHA: /^[0-9a-f]{40}$/,
  PC_W1_DATABASE_IDENTITY: /^PASS$/,
  PC_W1_PENDING_MIGRATIONS: /^(0|7)$/,
  PC_W1_SCHEMA_TABLES: /^(0|24)$/,
  PC_W1_SCHEMA_STRUCTURAL_CHECKS: /^(PASS|NOT_APPLIED|OBSERVED_NOT_MATCHED)$/,
  PC_W1_SCHEMA_CATALOG_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_API_ENVIRONMENT_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_NON_API_RUNTIME_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_RUNTIME_UNCHANGED: /^PASS$/,
  PC_W1_BACKUP_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_BACKUP_BYTES: /^[1-9][0-9]{0,19}$/,
  PC_W1_BACKUP_VERIFICATION: /^ARCHIVE_LIST_ONLY$/,
  PC_W1_DATABASE_ROLLBACK: /^NOT_REHEARSED$/,
  PC_W1_DATABASE_MUTATION: /^(NONE|BOUNDED_SEVEN_MIGRATIONS|MAY_HAVE_PARTIALLY_APPLIED)$/,
  PC_W1_AUTHENTICATED_ACCEPTANCE: /^NOT_EVIDENCED$/,
  PC_W1_FULL_ACCEPTANCE: /^NOT_EVIDENCED$/,
  PC_W1_LEGACY_LOT_ROLLBACK: /^DEGRADED_FAIL_CLOSED$/,
});
export function parseEvidence(raw, { requireTerminal = true } = {}) {
  const result = Object.create(null);
  for (const line of String(raw).trim().split(/\r?\n/)) {
    const separator = line.indexOf('=');
    const key = line.slice(0, separator), value = line.slice(separator + 1);
    if (separator < 1 || !Object.hasOwn(EVIDENCE_VALUES, key) || !EVIDENCE_VALUES[key].test(value)) blocked('UNSAFE_REMOTE_OUTPUT');
    if (Object.hasOwn(result, key)) blocked('DUPLICATE_REMOTE_EVIDENCE');
    result[key] = value;
  }
  if (requireTerminal && !result.PC_W1_RESULT) blocked('MISSING_TERMINAL_EVIDENCE');
  if (result.PC_W1_RESULT === 'BLOCKED' && !result.PC_W1_ERROR) blocked('MISSING_BLOCKER_CODE');
  const driftKeys = Object.keys(result).filter(key => key.startsWith('PC_W1_CHECKSUM_DRIFT_'));
  if (driftKeys.length && (![3,4].includes(driftKeys.length) || !result.PC_W1_CHECKSUM_DRIFT_MIGRATION_SHA256
    || !result.PC_W1_CHECKSUM_DRIFT_EXPECTED_SHA256 || !result.PC_W1_CHECKSUM_DRIFT_APPLIED_SHA256 || result.PC_W1_RESULT !== 'BLOCKED'
    || result.PC_W1_ERROR !== 'APPLIED_MIGRATION_CHECKSUM_DRIFT')) blocked('CONTRADICTORY_CHECKSUM_DIAGNOSTICS');
  const ledgerKeys = Object.keys(result).filter(key => key.startsWith('PC_W1_LEDGER_'));
  if (ledgerKeys.length) {
    const count = key => Number(result[`PC_W1_LEDGER_${key}`]);
    const blocker = result.PC_W1_ERROR;
    const requiredCount = {APPLIED_MIGRATION_CHECKSUM_DRIFT:'DRIFTED',UNFINISHED_MIGRATION:'UNFINISHED',UNRECOGNIZED_APPLIED_MIGRATION:'UNKNOWN',DUPLICATE_APPLIED_MIGRATION:'DUPLICATES'}[blocker];
    if (ledgerKeys.length !== LEDGER_COUNTS.length + 1 || result.PC_W1_RESULT !== 'BLOCKED'
      || !LEDGER_BLOCKERS.includes(blocker) || result.PC_W1_DATABASE_MUTATION !== 'NONE'
      || (blocker === 'APPLIED_MIGRATION_CHECKSUM_DRIFT' && driftKeys.length !== 4)
      || (requiredCount && count(requiredCount) < 1)
      || count('ROWS') !== ['MATCHED','DRIFTED','UNKNOWN','UNFINISHED','ROLLED_BACK'].reduce((n,key) => n+count(key),0)
      || count('DUPLICATES') > count('MATCHED')+count('DRIFTED')+count('UNKNOWN')
      || count('LEGACY_INITIAL_MARKERS') > count('DRIFTED')) blocked('CONTRADICTORY_LEDGER_DIAGNOSTICS');
  }
  if (result.PC_W1_RESULT && result.PC_W1_RESULT !== 'BLOCKED') {
    if (result.PC_W1_ERROR) blocked('CONTRADICTORY_REMOTE_EVIDENCE');
    for (const key of ['PC_W1_TARGET_SHA', 'PC_W1_BASELINE_API_SHA', 'PC_W1_DATABASE_IDENTITY', 'PC_W1_PENDING_MIGRATIONS',
      'PC_W1_SCHEMA_TABLES', 'PC_W1_SCHEMA_STRUCTURAL_CHECKS', 'PC_W1_RUNTIME_UNCHANGED', 'PC_W1_DATABASE_MUTATION',
      'PC_W1_AUTHENTICATED_ACCEPTANCE', 'PC_W1_FULL_ACCEPTANCE', 'PC_W1_LEGACY_LOT_ROLLBACK',
      'PC_W1_API_ENVIRONMENT_SHA256', 'PC_W1_NON_API_RUNTIME_SHA256', 'PC_W1_DATABASE_ROLLBACK']) {
      if (!result[key]) blocked('INCOMPLETE_REMOTE_EVIDENCE');
    }
    if (result.PC_W1_FULL_ACCEPTANCE !== 'NOT_EVIDENCED' || result.PC_W1_AUTHENTICATED_ACCEPTANCE !== 'NOT_EVIDENCED') blocked('FALSE_FUNCTIONAL_ACCEPTANCE');
    if (result.PC_W1_RESULT === 'MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE') {
      if (!result.PC_W1_BACKUP_SHA256 || !result.PC_W1_BACKUP_BYTES || !result.PC_W1_BACKUP_VERIFICATION || result.PC_W1_DATABASE_MUTATION !== 'BOUNDED_SEVEN_MIGRATIONS') blocked('MISSING_MUTATION_BACKUP_EVIDENCE');
    } else if (result.PC_W1_DATABASE_MUTATION !== 'NONE') blocked('UNEXPECTED_MUTATION_EVIDENCE');
    if (result.PC_W1_RESULT === 'READY_EXACT_SEVEN') {
      if (result.PC_W1_PENDING_MIGRATIONS !== '7' || result.PC_W1_SCHEMA_TABLES !== '0' || result.PC_W1_SCHEMA_STRUCTURAL_CHECKS !== 'NOT_APPLIED') blocked('PRE_MIGRATION_EVIDENCE_INVALID');
    } else if (!result.PC_W1_SCHEMA_CATALOG_SHA256) {
      blocked('MISSING_SCHEMA_CATALOG_EVIDENCE');
    }
    if (result.PC_W1_RESULT !== 'READY_EXACT_SEVEN' && (result.PC_W1_PENDING_MIGRATIONS !== '0' || result.PC_W1_SCHEMA_TABLES !== '24'
      || !['PASS','OBSERVED_NOT_MATCHED'].includes(result.PC_W1_SCHEMA_STRUCTURAL_CHECKS))) blocked('POST_MIGRATION_EVIDENCE_INVALID');
    if (result.PC_W1_RESULT === 'MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE' && result.PC_W1_SCHEMA_STRUCTURAL_CHECKS !== 'PASS') blocked('CATALOG_REFERENCE_REQUIRED');
  }
  return result;
}

async function observeSchema(tx, applied) {
  const rows = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS force,
    row_security_active(c.oid) AS active,CASE WHEN c.relowner=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass) THEN 'MIGRATION_OWNER' ELSE r.rolname END AS owner
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE n.nspname||'.'||c.relname = ANY($1::text[]) ORDER BY 1`, TARGET_TABLES);
  if (!applied) {
    if (rows.length) blocked('TARGET_SCHEMA_PREEXISTS');
    return { tables: 0, structuralChecks: 'NOT_APPLIED' };
  }
  if (rows.length !== 24 || rows.some(row => !row.rls || !row.force || !row.active)) blocked('TARGET_SCHEMA_RLS_INVALID');
  const authorities = await tx.$queryRawUnsafe(`SELECT r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,
    EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid=r.oid OR m.member=r.oid) AS membership
    FROM pg_catalog.pg_roles r WHERE r.rolname='pc_inventory_authority'`);
  if (authorities.length !== 1 || Object.values(authorities[0]).some(value => value !== false)) blocked('INVENTORY_AUTHORITY_INVALID');
  for (const table of rows.filter(row => row.name.startsWith('inventory.') || row.name === 'auction.inventory_bindings')) {
    if (table.owner !== 'pc_inventory_authority') blocked('INVENTORY_TABLE_OWNER_INVALID');
  }
  const functions = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||p.proname AS name,p.prosecdef,p.proconfig,r.rolname::text AS owner,
    pg_get_functiondef(p.oid) AS definition,
    EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute,
    has_function_privilege(current_user,p.oid,'EXECUTE') AS executable
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
    WHERE p.oid IN (to_regprocedure('inventory.execute_command(jsonb)'),to_regprocedure('auction.register_inventory_lot(jsonb)')) ORDER BY 1`);
  if (functions.length !== 2 || functions.some(row => !row.prosecdef || row.owner !== 'pc_inventory_authority' || row.public_execute || !row.executable
    || !row.proconfig?.includes('row_security=on') || !row.proconfig.some(value => /^search_path=pg_catalog, public, (inventory|auction, inventory)$/.test(value)))) blocked('INVENTORY_COMMAND_AUTHORITY_INVALID');
  const triggers = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,t.tgname::text,t.tgenabled::text,t.tgdeferrable,t.tginitdeferred,
    pn.nspname||'.'||p.proname AS function,pg_get_triggerdef(t.oid) AS definition
    FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
    WHERE NOT t.tgisinternal AND (n.nspname||'.'||c.relname=ANY($1::text[]) OR (n.nspname='auction' AND c.relname='lots')) ORDER BY 1,2`, TARGET_TABLES);
  if (triggers.some(row => row.tgenabled !== 'O' && row.tgenabled !== 'A')) blocked('TARGET_TRIGGER_DISABLED');
  for (const [relation, trigger, fn] of [
    ['public.organization_capability_assignments','organization_capability_assignment_guard','public.app_organization_capability_guard_assignment'],
    ['public.organization_capability_events','organization_capability_event_guard','public.app_organization_capability_guard_event'],
    ['public.providers','provider_registry_provider_guard','public.app_provider_registry_guard_provider'],
    ['public.provider_capabilities','provider_registry_capability_guard','public.app_provider_registry_guard_capability'],
    ['public.service_offerings','provider_registry_offering_guard','public.app_provider_registry_guard_offering'],
    ['public.provider_registry_evidence','provider_registry_evidence_guard','public.app_provider_registry_guard_evidence'],
    ['public.provider_registry_events','provider_registry_event_guard','public.app_provider_registry_guard_event'],
    ['public.integration_bindings','integration_binding_guard','public.app_integration_binding_guard'],
    ['public.integration_capability_evidence','integration_capability_evidence_guard','public.app_integration_capability_evidence_guard'],
    ['public.integration_binding_events','integration_binding_event_guard','public.app_integration_binding_event_guard'],
    ['public.commercial_rule_sets','commercial_rule_set_guard','public.app_commercial_version_guard'],
    ['public.commercial_rule_packs','commercial_rule_pack_guard','public.app_commercial_version_guard'],
    ['public.commercial_decisions','commercial_decision_guard','public.app_commercial_decision_guard'],
    ['public.commercial_rule_events','commercial_rule_event_guard','public.app_commercial_rule_event_guard'],
    ['public.commercial_rule_sets','commercial_rule_set_evidence_guard','public.app_commercial_version_evidence_guard'],
    ['public.commercial_rule_packs','commercial_rule_pack_evidence_guard','public.app_commercial_version_evidence_guard'],
    ['public.service_marketplace_requests','service_marketplace_request_guard','public.app_service_marketplace_request_guard'],
    ['public.service_marketplace_quotes','service_marketplace_quote_guard','public.app_service_marketplace_quote_guard'],
    ['public.service_marketplace_events','service_marketplace_event_guard','public.app_service_marketplace_event_guard'],
    ['public.service_marketplace_requests','service_marketplace_request_evidence_guard','public.app_service_marketplace_evidence_guard'],
    ...['batches','positions','reservations','availability_snapshots','command_events'].flatMap(table =>
      ['inventory_private_write','inventory_no_truncate'].map(trigger => [`inventory.${table}`,trigger,'inventory.private_write_guard'])),
    ['inventory.availability_policies','inventory_policy_immutable','inventory.private_write_guard'],
    ['inventory.availability_policies','inventory_policy_no_truncate','inventory.private_write_guard'],
    ['auction.lots','auction_inventory_lot_write','auction.inventory_lot_write_guard'],
    ['auction.lots','auction_inventory_registration_evidence','auction.inventory_registration_evidence_guard'],
    ['inventory.reservations','auction_bound_reservation_guard','auction.inventory_reservation_guard'],
    ['auction.inventory_bindings','auction_inventory_binding_immutable','inventory.private_write_guard'],
    ['auction.inventory_bindings','auction_inventory_binding_no_truncate','inventory.private_write_guard'],
  ]) if (!triggers.some(row => row.relation === relation && row.tgname === trigger && row.function === fn)) blocked('TARGET_TRIGGER_MISSING');
  const deferred = triggers.find(row => row.tgname === 'auction_inventory_registration_evidence');
  if (!deferred.tgdeferrable || !deferred.tginitdeferred) blocked('DEFERRED_EVIDENCE_TRIGGER_INVALID');
  const policies = await tx.$queryRawUnsafe(`SELECT schemaname||'.'||tablename AS relation,policyname::text,permissive,roles::text[],cmd,qual,with_check
    FROM pg_catalog.pg_policies WHERE schemaname||'.'||tablename=ANY($1::text[]) ORDER BY 1,2`, TARGET_TABLES);
  if (TARGET_TABLES.some(table => !policies.some(policy => policy.relation === table))) blocked('TARGET_POLICY_MISSING');
  const policy = await tx.$queryRawUnsafe('SELECT id,version::text AS version,definition FROM inventory.availability_policies ORDER BY id');
  const expectedPolicy = { basis:'declaredQuantity',exclusiveBuckets:['availableQuantity','reservedQuantity','committedQuantity','blockedQuantity','disputedQuantity','depletedQuantity'],
    formula:'declared - reserved - committed - blocked - disputed - depleted',independentMeasures:['confirmedQuantity','shippedQuantity','acceptedQuantity','soldQuantity'],
    supportedCommands:['DECLARE','RESERVE','RELEASE'],independentVerificationCreated:false,financialObligationCreated:false };
  if (policy.length !== 1 || policy[0].id !== 'DECLARED_CAPACITY_V1' || policy[0].version !== '1'
    || JSON.stringify(sortedObject(policy[0].definition)) !== JSON.stringify(sortedObject(expectedPolicy))) blocked('STATIC_AVAILABILITY_POLICY_INVALID');
  const constraints = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,k.conname::text,k.contype::text,k.convalidated,k.condeferrable,k.condeferred,
    pg_get_constraintdef(k.oid) AS definition FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname||'.'||c.relname=ANY($1::text[])
      OR (n.nspname='auction' AND c.relname='lots' AND k.conname='auction_lot_inventory_binding_fk') ORDER BY 1,2`, TARGET_TABLES);
  const bindingFk = constraints.find(row => row.conname === 'auction_lot_inventory_binding_fk');
  if (!bindingFk?.convalidated || !bindingFk.condeferrable || !bindingFk.condeferred || constraints.some(row => !row.convalidated)) blocked('TARGET_CONSTRAINT_INVALID');
  const columns = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,a.attnum,a.attname::text,
    format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attidentity::text,a.attgenerated::text
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped AND n.nspname||'.'||c.relname=ANY($1::text[]) ORDER BY 1,a.attnum`, TARGET_TABLES);
  const indexes = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname||'.'||c.relname=ANY($1::text[]) ORDER BY 1,4`, TARGET_TABLES);
  if (indexes.some(row => !row.indisvalid || !row.indisready)) blocked('TARGET_INDEX_INVALID');
  const grants = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,
    CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      THEN 'MIGRATION_OWNER' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
    WHERE n.nspname||'.'||c.relname=ANY($1::text[]) ORDER BY 1,2,3,4`, TARGET_TABLES);
  const guardFunctions = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef,p.proconfig,CASE WHEN p.proowner=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      THEN 'MIGRATION_OWNER' ELSE pg_get_userbyid(p.proowner) END AS owner,pg_get_functiondef(p.oid) AS definition,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC'
      WHEN a.grantee=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass) THEN 'MIGRATION_OWNER'
      ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY
      CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      THEN 'MIGRATION_OWNER' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable)
      FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a) AS grants
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND
      (n.nspname='inventory' OR (n.nspname='auction' AND (p.proname LIKE '%inventory%' OR p.proname='register_verified_lot'))
      OR (n.nspname='public' AND p.proname SIMILAR TO 'app_(organization_capability|provider_registry|integration_binding|integration_capability|commercial|service_marketplace)%'))
    ORDER BY 1,2`);
  const catalogHash=sha256(JSON.stringify({ rows, functions, triggers, policies, constraints, policy, columns, indexes, grants, guardFunctions }));
  const expected=process.env.PC_W1_EXPECTED_CATALOG_SHA256 ?? '';
  if (expected && (!/^[0-9a-f]{64}$/.test(expected) || expected !== catalogHash)) blocked('SCHEMA_CATALOG_MISMATCH');
  return { tables:24,structuralChecks:expected ? 'PASS' : 'OBSERVED_NOT_MATCHED',catalogHash };
}

export async function runtimeProbe(phase) {
  if (!['pre', 'post'].includes(phase)) blocked('PROBE_PHASE_INVALID');
  validateApiEnvironment(process.env);
  const manifest = decodeManifest(process.env.PC_W1_EXPECTED_MIGRATIONS_B64 ?? '');
  const require = createRequire('/app/package.json');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let releaseResolve, releaseReject;
  const released = new Promise((resolve, reject) => { releaseResolve = resolve; releaseReject = reject; });
  released.catch(() => {});
  input.on('line', line => line === 'finish' ? releaseResolve() : releaseReject(new Error('PROBE_CONTROL_INVALID')));
  input.on('close', () => releaseReject(new Error('PROBE_CONTROL_CLOSED')));
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15000ms'");
      const principal = await tx.$queryRawUnsafe(`SELECT r.oid::integer AS oid,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,
        EXISTS(SELECT 1 FROM pg_catalog.pg_roles privileged WHERE (privileged.rolsuper OR privileged.rolbypassrls)
          AND pg_has_role(current_user,privileged.oid,'MEMBER')) AS privileged_membership
        FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`);
      if (principal.length !== 1 || ['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','privileged_membership'].some(key => principal[0][key] !== false)) blocked('API_DATABASE_PRINCIPAL_NOT_CONFINED');
      const ledger = await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name');
      const classification = classifyLedger(manifest, ledger);
      if (phase === 'post' && classification.decision !== 'VERIFIED_ALREADY_APPLIED') blocked('POST_MIGRATION_LEDGER_INCOMPLETE');
      const schema = await observeSchema(tx, classification.pendingCount === 0);
      const nonce = `pc_w1_${crypto.randomBytes(16).toString('hex')}`;
      await tx.$queryRawUnsafe("SELECT set_config('application_name',$1,true)", nonce);
      const identity = await tx.$queryRawUnsafe(`SELECT pg_backend_pid() AS pid,(SELECT oid::integer FROM pg_catalog.pg_database WHERE datname=current_database()) AS "databaseOid",
        pg_export_snapshot() AS snapshot,current_setting('transaction_read_only') AS mode,pg_is_in_recovery() AS recovery`);
      if (identity[0]?.mode !== 'on' || identity[0]?.recovery !== false) blocked('READ_ONLY_PRIMARY_REQUIRED');
      const environmentHash = sha256(JSON.stringify(sortedObject(Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PC_W1_'))))));
      process.stdout.write(JSON.stringify({ ...identity[0], roleOid: principal[0].oid, nonce, ...classification, ...schema, environmentHash }) + '\n');
      const timer = setTimeout(() => releaseReject(new Error('PROBE_CONTROL_TIMEOUT')), 180_000);
      try { await released; } finally { clearTimeout(timer); }
    }, { isolationLevel: 'RepeatableRead', timeout: 200_000, maxWait: 10_000 });
    process.stdout.write('{"released":true}\n');
  } finally { input.close(); await prisma.$disconnect(); }
}

export function checkSources(root) {
  const script = fs.readFileSync(path.join(root, 'scripts/production-pc-crop-w1-migrations.sh'), 'utf8');
  for (const marker of ['PC_W1_MIGRATION_DIGEST', 'snapshot-sql', 'READ_ONLY', '--snapshot=', '--format=custom',
    'PC_W1_LEGACY_LOT_ROLLBACK DEGRADED_FAIL_CLOSED', 'PC_W1_FULL_ACCEPTANCE NOT_EVIDENCED',
    'PC_W1_BASELINE_API_SHA', 'PC_W1_EXPECTED_MIGRATIONS_B64', 'MIGRATION_SERVICE_AMBIGUOUS', 'NON_API_RUNTIME_CHANGED']) {
    assert.ok(script.includes(marker), `Missing migration boundary: ${marker}`);
  }
  assert.doesNotMatch(script, /\b(?:DROP|TRUNCATE)\s+(?:TABLE|SCHEMA)|migrate\s+resolve|production-full-stack|AUTH_MAIL_PROVISION|ROLE_ELIGIBILITY_ENFORCEMENT=true/);
  assert.doesNotMatch(script, /--no-acl|--disable-triggers|--enable-row-security/);
  assert.ok(script.includes('exec 2>/dev/null'), 'Raw remote diagnostics must not become public evidence');
}

const args = process.argv.slice(2);
if (process.argv[1] === '--runtime-probe') {
  runtimeProbe(process.argv[2]).catch(error => { process.stdout.write(JSON.stringify(probeErrorPayload(error)) + '\n'); process.exitCode = 1; });
} else if (process.argv[1] === '--runtime-tool' || (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)) {
  try {
    if (args[0] === 'snapshot-sql') process.stdout.write(snapshotSql(JSON.parse(fs.readFileSync(0, 'utf8'))));
    else if (args[0] === 'image-manifest') validateImageManifest(decodeManifest(process.env.PC_W1_EXPECTED_MIGRATIONS_B64 ?? ''), JSON.parse(fs.readFileSync(0, 'utf8')));
    else if (args[0] === 'verify-image-files') validateImageManifest(decodeManifest(process.env.PC_W1_EXPECTED_MIGRATIONS_B64 ?? ''), readMigrationManifest('/app/prisma/migrations'));
    else if (args[0] === 'image') validateMigrationImage(JSON.parse(fs.readFileSync(0, 'utf8'))[0], args[1], args[2]);
    else if (args[0] === 'compose') process.stdout.write(validateCompose(JSON.parse(fs.readFileSync(0, 'utf8'))));
    else if (args[0] === 'runtime-fingerprint') process.stdout.write(runtimeFingerprint(JSON.parse(fs.readFileSync(0, 'utf8')), args[1]));
    else if (args[0] === 'probe-error') {
      const value=JSON.parse(fs.readFileSync(0,'utf8'));
      if(value.error) process.stdout.write(SAFE_ERROR.test(value.error) ? value.error : 'UNCLASSIFIED_PROBE_FAILURE');
    }
    else if (args[0] === 'probe-diagnostics') process.stdout.write(probeDiagnostics(JSON.parse(fs.readFileSync(0,'utf8'))));
    else if (args[0] === 'evidence') { parseEvidence(fs.readFileSync(0, 'utf8')); console.log('PC_W1_EVIDENCE_CONTRACT=PASS'); }
    else if (args[0] === 'probe-field') {
      const value = validateSnapshot(JSON.parse(fs.readFileSync(0, 'utf8')));
      if (!['snapshot','decision','pendingCount','tables','structuralChecks','catalogHash','environmentHash'].includes(args[1])) blocked('PROBE_FIELD_INVALID');
      process.stdout.write(String(value[args[1]] ?? ''));
    } else { checkSources(args[0] ?? process.cwd()); console.log('PC_W1_SOURCE_CONTRACT=PASS'); }
  } catch (error) { console.error(errorCode(error)); process.exitCode = 1; }
}
