#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, '../..');

const paths = {
  authoritySchema: resolve(repositoryRoot, 'apps/tai/knowledge-sources/AP-14F1A-PUBLIC-CORPUS-AUTHORITY.schema.v1.json'),
  authority: resolve(repositoryRoot, 'apps/tai/knowledge-sources/AP-14F1A-PUBLIC-CORPUS-AUTHORITY.v1.json'),
  primaryMigration: resolve(repositoryRoot, 'apps/api/prisma/migrations/20260728182500_tai_ap14f1a_public_corpus_authority/migration.sql'),
  correctionMigration: resolve(repositoryRoot, 'apps/api/prisma/migrations/20260728182600_tai_ap14f1a_record_artifact_fix/migration.sql'),
  acceptanceSql: resolve(repositoryRoot, 'scripts/tai-ap-14f1a/postgresql-acceptance.sql'),
  scope: resolve(repositoryRoot, 'docs/platform-v7/autopilot/scopes/tai-ap-14f1a-3346.json'),
};

const expectedPaths = [
  '.github/workflows/tai-ap-14f1a.yml',
  'apps/api/prisma/migrations/20260728182500_tai_ap14f1a_public_corpus_authority/migration.sql',
  'apps/api/prisma/migrations/20260728182600_tai_ap14f1a_record_artifact_fix/migration.sql',
  'apps/tai/knowledge-sources/AP-14F1A-PUBLIC-CORPUS-AUTHORITY.schema.v1.json',
  'apps/tai/knowledge-sources/AP-14F1A-PUBLIC-CORPUS-AUTHORITY.v1.json',
  'docs/platform-v7/autopilot/scopes/tai-ap-14f1a-3346.json',
  'scripts/tai-ap-14f1a/postgresql-acceptance.sql',
  'scripts/tai-ap-14f1a/verify.mjs',
];

const expectedRoles = ['tai_knowledge_ingestor', 'tai_knowledge_reader'];
const expectedTables = [
  'tai_public_corpus_quarantine_events',
  'tai_public_corpus_snapshot_members',
  'tai_public_corpus_snapshots',
  'tai_public_source_admissions',
  'tai_public_source_artifacts',
  'tai_public_source_versions',
  'tai_public_source_withdrawals',
];
const expectedFunctions = [
  'tai_knowledge.add_snapshot_member',
  'tai_knowledge.create_snapshot',
  'tai_knowledge.decide_artifact',
  'tai_knowledge.record_artifact',
  'tai_knowledge.record_withdrawal',
  'tai_knowledge.register_source',
  'tai_knowledge.register_source_version',
  'tai_knowledge.seal_snapshot',
  'tai_knowledge.withdraw_snapshot',
];
const expectedEntities = ['ARTIFACT', 'SNAPSHOT', 'SOURCE', 'SOURCE_VERSION'];
const expectedForbidden = [
  'CABINET_ACCESS',
  'CHUNKING',
  'CONNECTED_LIVE_TRAINED_CLAIM',
  'CONTRACTED_DATA',
  'CORPUS_PARSE',
  'CREDENTIAL_STORAGE',
  'EMBEDDING',
  'EXTERNAL_WRITE',
  'MODEL_TRAINING',
  'PRODUCTION_DEPLOYMENT',
  'REAL_SOURCE_ADMISSION',
  'SOURCE_FETCH',
  'TENANT_LIVE_DATA',
  'VECTOR_INDEX',
];
const mandatoryInvariants = [
  'PUBLIC_OFFICIAL_DATA_PLANE_ONLY',
  'LOWERCASE_SHA256_REQUIRED',
  'HTTPS_OFFICIAL_LOCATOR_REQUIRED',
  'HOST_PIN_REQUIRED',
  'CURRENT_RIGHTS_DECISION_REQUIRED',
  'SHARED_INDEX_DEFAULT_FALSE',
  'MODEL_WEIGHTS_ALWAYS_FALSE',
  'ARTIFACT_PROVENANCE_COMPLETE_BEFORE_ADMISSION',
  'QUARANTINE_ATOMICALLY_REVOKES_RETRIEVAL',
  'WITHDRAWAL_ATOMICALLY_REVOKES_RETRIEVAL',
  'DIRECT_DML_REVOKED_FROM_RUNTIME_ROLES',
  'HARD_DELETE_DENIED_FOR_ALL_AUTHORITY_TABLES',
  'IDEMPOTENT_DUPLICATE_AND_CONFLICT_REJECTION',
  'IMMUTABLE_AUDIT_AND_EVIDENCE_HISTORY',
  'UNSUPPORTED_OR_STALE_MATERIAL_ABSTAINS',
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readText(path, label) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    fail(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameSet(actual, expected, context) {
  const left = [...actual].sort((a, b) => a.localeCompare(b, 'en'));
  const right = [...expected].sort((a, b) => a.localeCompare(b, 'en'));
  assert(canonicalJson(left) === canonicalJson(right), `${context} mismatch: ${left.join(', ')}`);
}

function assertUnique(values, context) {
  assert(new Set(values).size === values.length, `${context} must be unique`);
}

function assertExactKeys(value, expected, context) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${context} must be an object`);
  sameSet(Object.keys(value), expected, `${context} keys`);
}

function assertIsoDateTime(value, context) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(value), `${context} must be an ISO date-time`);
  assert(!Number.isNaN(Date.parse(value)), `${context} is invalid`);
}

function countMatches(text, expression) {
  return [...text.matchAll(expression)].length;
}

function requireTokens(text, tokens, context) {
  for (const token of tokens) assert(text.includes(token), `${context} is missing ${token}`);
}

function validateAuthority(candidate) {
  assertExactKeys(candidate, [
    '$schema',
    'schemaVersion',
    'authorityVersion',
    'generatedAt',
    'operationalStatus',
    'productionHosting',
    'dataPlane',
    'postgresqlMajor',
    'migration',
    'roles',
    'tables',
    'controlledFunctions',
    'retrievalView',
    'stateMachines',
    'invariants',
    'forbiddenCapabilities',
  ], 'authority');

  assert(candidate.$schema === './AP-14F1A-PUBLIC-CORPUS-AUTHORITY.schema.v1.json', 'authority schema reference changed');
  assert(candidate.schemaVersion === 'tai.ap14f1a-public-corpus-authority.v1', 'authority schema version changed');
  assert(/^\d+\.\d+\.\d+$/u.test(candidate.authorityVersion), 'authority version must be semantic');
  assertIsoDateTime(candidate.generatedAt, 'generatedAt');
  assert(candidate.operationalStatus === 'NOT_ATTESTED', 'authority maturity may not exceed NOT_ATTESTED');
  assert(candidate.productionHosting === 'REG_RU_VPS_ONLY', 'production hosting boundary changed');
  assert(candidate.dataPlane === 'PUBLIC_OFFICIAL', 'shared authority must be PUBLIC_OFFICIAL only');
  assert(candidate.postgresqlMajor === 16, 'PostgreSQL major must be 16');
  assert(candidate.migration === expectedPaths[1], 'primary migration path changed');

  const roleCodes = candidate.roles.map((role) => role.code);
  assertUnique(roleCodes, 'role codes');
  sameSet(roleCodes, expectedRoles, 'authority roles');
  for (const role of candidate.roles) {
    assertExactKeys(role, ['code', 'loginAllowed', 'directDmlAllowed', 'controlledExecuteAllowed', 'retrievalReadAllowed'], `${role.code} role`);
    assert(role.loginAllowed === false, `${role.code} must remain NOLOGIN`);
    assert(role.directDmlAllowed === false, `${role.code} direct DML must remain forbidden`);
    assert(role.retrievalReadAllowed === true, `${role.code} must read the controlled retrieval view`);
    if (role.code === 'tai_knowledge_ingestor') assert(role.controlledExecuteAllowed === true, 'ingestor controlled execution must be enabled');
    if (role.code === 'tai_knowledge_reader') assert(role.controlledExecuteAllowed === false, 'reader mutation execution must be disabled');
  }

  const tableNames = candidate.tables.map((table) => table.name);
  assertUnique(tableNames, 'authority table names');
  sameSet(tableNames, expectedTables, 'authority tables');
  for (const table of candidate.tables) {
    assertExactKeys(table, ['name', 'purpose', 'appendOnly', 'hardDeleteDenied', 'dataPlaneColumn'], `${table.name} table`);
    assert(table.hardDeleteDenied === true, `${table.name} must deny hard delete`);
    assert(typeof table.purpose === 'string' && table.purpose.length >= 20, `${table.name} purpose is incomplete`);
  }
  for (const appendOnlyTable of [
    'tai_public_corpus_quarantine_events',
    'tai_public_source_withdrawals',
    'tai_public_corpus_snapshot_members',
  ]) {
    assert(candidate.tables.find((table) => table.name === appendOnlyTable)?.appendOnly === true, `${appendOnlyTable} must be append-only`);
  }

  const functionNames = candidate.controlledFunctions.map((entry) => entry.name);
  assertUnique(functionNames, 'controlled function names');
  sameSet(functionNames, expectedFunctions, 'controlled functions');
  for (const entry of candidate.controlledFunctions) {
    assertExactKeys(entry, ['name', 'securityDefiner', 'ingestorExecute', 'readerExecute', 'failClosed'], `${entry.name} function`);
    assert(entry.securityDefiner === true, `${entry.name} must be SECURITY DEFINER`);
    assert(entry.ingestorExecute === true, `${entry.name} must be available to the ingestor role`);
    assert(entry.readerExecute === false, `${entry.name} must not be available to the reader role`);
    assert(entry.failClosed === true, `${entry.name} must fail closed`);
  }

  assertExactKeys(candidate.retrievalView, [
    'name',
    'securityBarrier',
    'requiresCurrentRights',
    'excludesQuarantine',
    'excludesWithdrawal',
    'excludesUnsealedSnapshots',
  ], 'retrieval view');
  assert(candidate.retrievalView.name === 'tai_public_corpus_retrieval_entries', 'retrieval view name changed');
  assert(Object.entries(candidate.retrievalView).filter(([key]) => key !== 'name').every(([, value]) => value === true), 'all retrieval fail-closed controls must be true');

  const entities = candidate.stateMachines.map((machine) => machine.entity);
  assertUnique(entities, 'state-machine entities');
  sameSet(entities, expectedEntities, 'state machines');
  for (const machine of candidate.stateMachines) {
    assert(machine.states.includes(machine.initialState), `${machine.entity} initial state must be declared`);
    for (const terminal of machine.terminalStates) assert(machine.states.includes(terminal), `${machine.entity} terminal state ${terminal} is undeclared`);
  }

  assertUnique(candidate.invariants, 'authority invariants');
  for (const invariant of mandatoryInvariants) assert(candidate.invariants.includes(invariant), `authority invariant missing: ${invariant}`);
  sameSet(candidate.forbiddenCapabilities, expectedForbidden, 'forbidden capabilities');

  return {
    roles: roleCodes.length,
    tables: tableNames.length,
    functions: functionNames.length,
    invariants: candidate.invariants.length,
  };
}

const authoritySchema = parseJson(paths.authoritySchema, 'authority schema');
const authority = parseJson(paths.authority, 'authority registry');
const primaryMigration = readText(paths.primaryMigration, 'primary migration');
const correctionMigration = readText(paths.correctionMigration, 'correction migration');
const acceptanceSql = readText(paths.acceptanceSql, 'PostgreSQL acceptance');
const scope = parseJson(paths.scope, 'scope manifest');
const checks = [];

function pass(code, detail) {
  checks.push({ code, status: 'PASS', detail });
}

assert(authoritySchema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'authority schema must use JSON Schema draft 2020-12');
assert(authoritySchema.type === 'object' && authoritySchema.additionalProperties === false, 'authority schema root must be closed');
for (const [name, definition] of Object.entries(authoritySchema.$defs ?? {})) {
  assert(definition.type === 'object' && definition.additionalProperties === false, `authority definition ${name} must be a closed object`);
}
const counts = validateAuthority(authority);
pass('AUTHORITY_CONTRACT', `${counts.roles} roles, ${counts.tables} tables, ${counts.functions} controlled functions and ${counts.invariants} invariants validate.`);

for (const [label, mutate] of [
  ['data plane expansion', (value) => { value.dataPlane = 'TENANT_LIVE'; }],
  ['reader DML permission', (value) => { value.roles.find((role) => role.code === 'tai_knowledge_reader').directDmlAllowed = true; }],
  ['hard delete permission', (value) => { value.tables[0].hardDeleteDenied = false; }],
  ['non-definer mutation function', (value) => { value.controlledFunctions[0].securityDefiner = false; }],
  ['retrieval withdrawal leak', (value) => { value.retrievalView.excludesWithdrawal = false; }],
  ['removed source-fetch prohibition', (value) => { value.forbiddenCapabilities = value.forbiddenCapabilities.filter((entry) => entry !== 'SOURCE_FETCH'); }],
]) {
  const probe = structuredClone(authority);
  mutate(probe);
  let rejected = false;
  try {
    validateAuthority(probe);
  } catch {
    rejected = true;
  }
  assert(rejected, `unsafe authority mutation was accepted: ${label}`);
}
pass('NEGATIVE_MUTATION_PROBES', 'Six unsafe authority mutations fail closed.');

const createdTables = [...primaryMigration.matchAll(/CREATE TABLE\s+([a-z0-9_]+)/giu)].map((match) => match[1]);
assertUnique(createdTables, 'migration CREATE TABLE targets');
sameSet(createdTables, expectedTables, 'migration authority tables');
assert(countMatches(primaryMigration, /CREATE TABLE\s+/giu) === 7, 'migration must create exactly seven authority tables');

requireTokens(primaryMigration, [
  "CREATE SCHEMA IF NOT EXISTS tai_knowledge",
  "CREATE ROLE tai_knowledge_ingestor NOLOGIN",
  "CREATE ROLE tai_knowledge_reader NOLOGIN",
  "NOBYPASSRLS",
  "data_plane = 'PUBLIC_OFFICIAL'",
  "content_sha256 ~ '^[a-f0-9]{64}$'",
  "model_weights_allowed = false",
  "CREATE VIEW tai_public_corpus_retrieval_entries",
  "WITH (security_barrier = true)",
  "rights_review_due_at >= current_date",
  "latest_withdrawal.action IS DISTINCT FROM 'WITHDRAW'",
  "CREATE OR REPLACE FUNCTION tai_knowledge.deny_hard_delete()",
  "CREATE OR REPLACE FUNCTION tai_knowledge.deny_append_only_mutation()",
], 'primary migration');

for (const tableName of expectedTables) {
  assert(primaryMigration.includes(`ON ${tableName}`), `${tableName} is missing trigger or index authority evidence`);
  assert(primaryMigration.includes(`REVOKE ALL ON TABLE ${tableName}`), `${tableName} direct DML revoke is missing`);
}
for (const functionName of expectedFunctions) {
  const shortName = functionName.split('.')[1];
  const combined = `${primaryMigration}\n${correctionMigration}`;
  assert(combined.includes(`FUNCTION ${functionName}(`), `${functionName} is missing from migrations`);
  assert(combined.includes(`GRANT EXECUTE ON FUNCTION ${functionName}(`), `${functionName} ingestor grant is missing`);
  const functionStart = combined.indexOf(`FUNCTION ${functionName}(`);
  const functionSlice = combined.slice(functionStart, functionStart + 2500);
  assert(functionSlice.includes('SECURITY DEFINER'), `${functionName} must be SECURITY DEFINER`);
  assert(!shortName.includes('fetch'), `${functionName} may not fetch sources`);
}
assert(correctionMigration.includes('SELECT sv.*'), 'record_artifact correction must bind only the source-version row type');
assert(!correctionMigration.includes('s.id AS source_id'), 'record_artifact correction must not contain an extra row field');
assert(!/official\.example\.test/iu.test(primaryMigration + correctionMigration), 'migrations must not admit synthetic or real source rows');
assert(!/\b(CREATE EXTENSION|COPY\s+.*FROM\s+PROGRAM|dblink|http_get|curl|wget)\b/iu.test(primaryMigration + correctionMigration), 'migration contains an external-access capability');
pass('POSTGRESQL_AUTHORITY_STATIC', 'Seven tables, two NOLOGIN roles, nine controlled functions, delete guards and a security-barrier retrieval view are present.');

requireTokens(acceptanceSql, [
  "current_setting('server_version_num')",
  "expected 7 authority tables",
  "direct authority DML must remain revoked",
  "forbidden data plane mutation was accepted",
  "uppercase digest was accepted",
  "quarantined artifact remained retrievable",
  "withdrawn source version remained retrievable",
  "restored source version did not return to retrieval",
  "hard delete was accepted",
  "append-only quarantine mutation was accepted",
  "withdrawn snapshot remained retrievable",
  "synthetic.official.manual",
  "official.example.test",
  "'operationalStatus', 'NOT_ATTESTED'",
], 'PostgreSQL acceptance');
assert(!/\.ru\b|\.gov\b|\.рф/iu.test(acceptanceSql), 'acceptance must not claim or contact a real source host');
assert(countMatches(acceptanceSql, /tai_knowledge\.register_source\(/gu) >= 3, 'acceptance must cover idempotency and conflict for source registration');
assert(countMatches(acceptanceSql, /tai_knowledge\.decide_artifact\(/gu) >= 3, 'acceptance must cover admit, quarantine and re-admit');
assert(countMatches(acceptanceSql, /tai_knowledge\.record_withdrawal\(/gu) >= 2, 'acceptance must cover withdraw and restore');
pass('POSTGRESQL_ACCEPTANCE_CONTRACT', 'Synthetic-only positive, idempotency, conflict, privilege, quarantine, withdrawal, restore and immutable-evidence probes are present.');

assertExactKeys(scope, [
  'schemaVersion',
  'branch',
  'status',
  'issue',
  'baseCommit',
  'productionHosting',
  'operationalStatus',
  'allowedPaths',
  'boundaries',
  'acceptance',
], 'scope manifest');
assert(scope.schemaVersion === 'platform-v7.concurrent-scope.v1', 'scope schema version changed');
assert(scope.branch === 'agent/tai-ap-14f1a-public-corpus-authority-3346', 'scope branch mismatch');
assert(scope.status === 'active', 'scope must remain active');
assert(scope.issue === 3346, 'scope issue mismatch');
assert(scope.baseCommit === 'b82c07cf28c13f9652f87cd14fdc2a75164b8e1b', 'scope base commit changed');
assert(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope hosting boundary changed');
assert(scope.operationalStatus === 'NOT_ATTESTED', 'scope maturity boundary changed');
sameSet(scope.allowedPaths, expectedPaths, 'scope allowed paths');
assert(Object.values(scope.boundaries).every((value) => value === true), 'all scope boundaries must remain enabled');
assert(scope.acceptance.postgresqlMajor === 16, 'scope PostgreSQL major mismatch');
assert(scope.acceptance.authorityTableCount === 7, 'scope table count mismatch');
assert(scope.acceptance.exactMainCommitStatusRequired === true, 'observable exact-main status is required');
pass('SOURCE_CONTROLLED_SCOPE', 'Eight paths are authorized for the PostgreSQL-only slice.');

const scopeGuardIndex = process.argv.indexOf('--scope-guard');
if (scopeGuardIndex !== -1) {
  const baseRef = process.argv[scopeGuardIndex + 1];
  assert(baseRef, '--scope-guard requires a base ref');
  execFileSync('git', ['merge-base', '--is-ancestor', scope.baseCommit, 'HEAD'], { cwd: repositoryRoot, stdio: 'pipe' });
  execFileSync('git', ['merge-base', '--is-ancestor', baseRef, 'HEAD'], { cwd: repositoryRoot, stdio: 'pipe' });
  const changed = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], { cwd: repositoryRoot, encoding: 'utf8' })
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
  assertUnique(changed, 'changed paths');
  for (const file of changed) assert(expectedPaths.includes(file), `out-of-scope path changed: ${file}`);
  assert(changed.includes('docs/platform-v7/autopilot/scopes/tai-ap-14f1a-3346.json'), 'source-controlled scope manifest must be in the diff');
  pass('EXACT_ANCESTRY_AND_DIFF', `${baseRef} and governed base are ancestors; ${changed.length} changed paths are in scope.`);
}

const report = {
  status: 'PASS',
  slice: 'TAI-AP-14F1A',
  issue: 3346,
  operationalStatus: authority.operationalStatus,
  productionHosting: authority.productionHosting,
  counts: {
    roles: counts.roles,
    authorityTables: counts.tables,
    controlledFunctions: counts.functions,
    invariants: counts.invariants,
    negativeMutationProbes: 6,
  },
  boundaries: {
    sourceFetch: false,
    realSourceAdmission: false,
    corpusParse: false,
    chunking: false,
    embeddingsOrVectorIndex: false,
    cabinetAccess: false,
    credentials: false,
    tenantLiveOrContractedData: false,
    modelTraining: false,
    runtimeExternalWrite: false,
    productionDeployment: false,
  },
  checks,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
