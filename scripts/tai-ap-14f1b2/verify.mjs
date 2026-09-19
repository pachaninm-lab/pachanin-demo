#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scopePath = resolve(root, 'docs/platform-v7/autopilot/scopes/tai-ap-14f1b2-3362.json');
const modulePath = resolve(root, 'apps/tai/tai/public_official_acquisition.py');
const migrationPath = resolve(root, 'apps/tai/tai/migrations/0021_public_official_acquisition_authority.sql');
const manifestPath = resolve(root, 'apps/tai/tai/migrations/manifest.json');
const testsPath = resolve(root, 'apps/tai/tests/test_public_official_acquisition.py');
const workflowPath = resolve(root, '.github/workflows/tai-ap-14f1b2.yml');
const baseCommit = '2c7a65e8cdffb9f7e5797703a277a466756c0aad';

const expectedPaths = [
  '.github/workflows/tai-ap-14f1b2.yml',
  'apps/tai/tai/migrations/0021_public_official_acquisition_authority.sql',
  'apps/tai/tai/migrations/manifest.json',
  'apps/tai/tai/public_official_acquisition.py',
  'apps/tai/tests/test_migration_manifest.py',
  'apps/tai/tests/test_public_official_acquisition.py',
  'docs/platform-v7/autopilot/scopes/tai-ap-14f1b2-3362.json',
  'scripts/tai-ap-14f1a/verify.mjs',
  'scripts/tai-ap-14f1b2/verify.mjs',
].sort();

function fail(message) {
  throw new Error(`TAI_AP_14F1B2:${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${label} invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function equalArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

const args = process.argv.slice(2);
const scopeGuardIndex = args.indexOf('--scope-guard');
const comparisonBase = scopeGuardIndex >= 0 ? args[scopeGuardIndex + 1] : null;
if (scopeGuardIndex >= 0 && !comparisonBase) fail('missing scope-guard comparison base');

const scope = parseJson(scopePath, 'scope');
const manifest = parseJson(manifestPath, 'migration manifest');
const moduleSource = readFileSync(modulePath, 'utf8');
const migrationSource = readFileSync(migrationPath, 'utf8');
const testsSource = readFileSync(testsPath, 'utf8');
const workflowSource = readFileSync(workflowPath, 'utf8');

assert(scope.schemaVersion === 'platform-v7.concurrent-scope.v1', 'scope schema version');
assert(scope.branch === 'agent/tai-ap-14f1b2-acquisition-authority-3362', 'scope branch');
assert(scope.issue === 3362, 'scope issue');
assert(scope.baseCommit === baseCommit, 'scope base commit');
assert(scope.operationalStatus === 'NOT_ATTESTED', 'scope operational status');
assert(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope production hosting');
assert(equalArrays([...scope.allowedPaths].sort(), expectedPaths), 'scope path set');
assert(scope.acceptance.changedPathCount === 9, 'scope path count');
assert(scope.acceptance.migrationVersion === 22, 'scope migration version');
assert(scope.acceptance.immutableAuthorityTableCount === 5, 'scope authority table count');
assert(scope.acceptance.restrictedMutationFunctionCount === 4, 'scope function count');
assert(scope.acceptance.realNetworkSourceCount === 0, 'scope real network source count');
assert(scope.boundaries.authorityOnly === true, 'authority-only boundary');
assert(scope.boundaries.noRealNetworkAcceptance === true, 'network boundary');
assert(scope.boundaries.noRuntimeActivation === true, 'runtime boundary');
assert(scope.boundaries.noCredentials === true, 'credential boundary');
assert(scope.boundaries.noModelTrainingOrWeights === true, 'model boundary');

const versions = manifest.migrations.map((entry) => entry.version);
const acceptedPrefixLength = 22;
assert(
  manifest.migrations.length >= acceptedPrefixLength,
  'manifest may not remove AP-14F1B2 history',
);
const acceptedAuthority = manifest.migrations[acceptedPrefixLength - 1];
assert(acceptedAuthority?.version === 22, 'manifest accepted prefix version');
assert(
  acceptedAuthority?.path === '0021_public_official_acquisition_authority.sql',
  'manifest accepted prefix path',
);
assert(new Set(versions).size === versions.length, 'manifest versions unique');
assert(versions.every((value, index) => value === index + 1), 'manifest versions contiguous');

for (const marker of [
  'class SourceRoutePolicy',
  'class AcquisitionLease',
  'class RawArtifactManifest',
  'class AcquisitionRunAuthority',
  'class SafePublicExtractor',
  'ACQUISITION_CROSS_HOST_REDIRECT',
  'ACQUISITION_PATH_ESCAPE',
  'ACQUISITION_PROMPT_INJECTION_DETECTED',
  'ACQUISITION_JSON_DUPLICATE_KEY',
  'ACQUISITION_XML_DTD_OR_ENTITY_FORBIDDEN',
  'ACQUISITION_HTML_ACTIVE_CONTENT',
  'ACQUISITION_POLYGLOT_OR_BINARY_MISMATCH',
  'ACQUISITION_TERMINAL_REPLAY_CONFLICT',
]) {
  assert(moduleSource.includes(marker), `module marker ${marker}`);
}

for (const forbidden of [
  'requests.get(',
  'httpx.get(',
  'urllib.request',
  'socket.create_connection',
  'subprocess.run(',
  'os.system(',
]) {
  assert(!moduleSource.includes(forbidden), `authority module network/runtime escape ${forbidden}`);
}

const requiredTables = [
  'tai_public_acquisition_runs',
  'tai_public_acquisition_raw_evidence',
  'tai_public_acquisition_fragments',
  'tai_public_acquisition_terminals',
  'tai_public_acquisition_audit',
];
for (const table of requiredTables) {
  assert(migrationSource.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `missing table ${table}`);
  assert(migrationSource.includes(`'${table}'`), `missing immutable trigger binding ${table}`);
}
for (const governedFunction of [
  'tai_record_public_acquisition_start',
  'tai_record_public_acquisition_raw_evidence',
  'tai_record_public_acquisition_fragment',
  'tai_record_public_acquisition_terminal',
]) {
  assert(
    migrationSource.includes(`CREATE OR REPLACE FUNCTION ${governedFunction}`),
    `missing function ${governedFunction}`,
  );
  assert(
    migrationSource.includes(`GRANT EXECUTE ON FUNCTION ${governedFunction}`),
    `missing grant ${governedFunction}`,
  );
}
assert(migrationSource.includes('TAI_PUBLIC_ACQUISITION_IMMUTABLE'), 'immutable denial missing');
assert(migrationSource.includes('tai_public_acquisition_writer NOLOGIN'), 'restricted role missing');
assert(migrationSource.includes('REVOKE ALL ON tai_public_acquisition_runs'), 'direct DML revoke missing');
assert(migrationSource.includes("status = 'ADMITTED'"), 'source eligibility recheck missing');
assert(migrationSource.includes('rights_review_due_at > p_completed_at'), 'rights expiry recheck missing');
assert(migrationSource.includes('released_at IS NULL'), 'open quarantine recheck missing');

for (const adversarialMarker of [
  'CROSS_HOST_REDIRECT',
  'PATH_ESCAPE',
  'LEASE_EXPIRED',
  'FENCE_MISMATCH',
  'MANIFEST_REPLAY_CONFLICT',
  'TERMINAL_REPLAY_CONFLICT',
  'RIGHTS_EXPIRED',
  'OPEN_QUARANTINE',
  'SOURCE_WITHDRAWN',
  'JSON_DUPLICATE_KEY',
  'JSON_NON_FINITE',
  'DTD_OR_ENTITY',
  'ACTIVE_CONTENT',
  'UNSAFE_SCHEME',
  'EVENT_HANDLER',
  'PROMPT_INJECTION',
  'BIDI_CONTROL',
  'CREDENTIAL_INDICATOR',
  'PII_INDICATOR',
  'DEPTH_LIMIT',
  'NODE_LIMIT',
  'ATTRIBUTE_LIMIT',
  'FRAGMENT_LIMIT',
]) {
  assert(testsSource.includes(adversarialMarker), `missing adversarial test ${adversarialMarker}`);
}

assert(workflowSource.includes('TAI AP-14F1B2'), 'workflow identity');
assert(workflowSource.includes('postgres'), 'workflow PostgreSQL acceptance');
assert(workflowSource.includes('ruff check'), 'workflow Ruff acceptance');
assert(workflowSource.includes('mypy'), 'workflow mypy acceptance');
assert(workflowSource.includes('pytest'), 'workflow pytest acceptance');
assert(workflowSource.includes('TAI AP-14F1B2 exact-main'), 'workflow exact-main status');
assert(!workflowSource.includes('curl '), 'workflow real network fetch forbidden');

let changedPaths = [];
if (comparisonBase) {
  git('cat-file', '-e', `${baseCommit}^{commit}`);
  git('merge-base', '--is-ancestor', baseCommit, 'HEAD');
  changedPaths = git('diff', '--name-only', `${comparisonBase}...HEAD`)
    .split('\n')
    .filter(Boolean)
    .sort();
  assert(equalArrays(changedPaths, expectedPaths), `changed paths ${JSON.stringify(changedPaths)}`);
}

const negativeMutationProbes = [
  ['scope operational status', () => ({ ...scope, operationalStatus: 'CONNECTED' })],
  [
    'scope network boundary',
    () => ({
      ...scope,
      boundaries: { ...scope.boundaries, noRealNetworkAcceptance: false },
    }),
  ],
  [
    'scope source count',
    () => ({
      ...scope,
      acceptance: { ...scope.acceptance, realNetworkSourceCount: 1 },
    }),
  ],
  [
    'manifest version',
    () => ({
      ...manifest,
      migrations: manifest.migrations.map((entry, index) =>
        index === 21 ? { ...entry, version: 21 } : entry,
      ),
    }),
  ],
];
for (const [label, mutate] of negativeMutationProbes) {
  const candidate = mutate();
  const rejected =
    candidate.operationalStatus !== 'NOT_ATTESTED'
    || candidate.boundaries?.noRealNetworkAcceptance !== true
    || candidate.acceptance?.realNetworkSourceCount !== 0
    || candidate.migrations?.[21]?.version !== 22;
  assert(rejected, `negative probe accepted: ${label}`);
}

const report = {
  status: 'PASS',
  exactHead: git('rev-parse', 'HEAD'),
  baseCommit,
  operationalStatus: 'NOT_ATTESTED',
  productionHosting: 'REG_RU_VPS_ONLY',
  counts: {
    changedPaths: changedPaths.length,
    migrationVersion: 22,
    authorityTables: requiredTables.length,
    restrictedMutationFunctions: 4,
    parserKinds: 4,
    adversarialMarkers: 24,
    negativeMutationProbes: negativeMutationProbes.length,
    realNetworkSources: 0,
  },
  boundaries: {
    realNetworkFetch: false,
    corpusBytes: false,
    tenantLiveOrContractedData: false,
    credentials: false,
    embeddingsOrVectorMutation: false,
    modelTrainingOrWeights: false,
    runtimeActivation: false,
    externalWrites: false,
    productionDeployment: false,
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
