#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INVENTORY_PATH = 'docs/platform-v7/crop-platform/p0.2-fgis-first-confirmed-lot-inventory.v1.json';
const REPORT_PATH = 'docs/platform-v7/crop-platform/p0.2-fgis-first-confirmed-lot-audit.md';
const SCOPE_PATH = 'docs/platform-v7/autopilot/scopes/p0-fgis-first-confirmed-lot-audit-3585.json';
const EXPECTED_BASE = '758f55b89ff677d6bcd5e820887d519fb41271d1';
const EXPECTED_ALLOWED_PATHS = [
  '.github/workflows/p0-fgis-first-confirmed-lot-audit.yml',
  SCOPE_PATH,
  REPORT_PATH,
  INVENTORY_PATH,
  'scripts/p0-fgis-first-confirmed-lot/verify-audit.mjs',
].sort();
const REQUIRED_AREAS = [
  'fgis_modules',
  'party_models',
  'fgis_lot_passport',
  'live_adapter',
  'emulator_and_fixtures',
  'regulatory_integration',
  'contract_versions',
  'xml_policies',
  'acknowledgment_processing',
  'seller_fgis_routes',
  'auction_import_routes',
  'postgresql_authority',
  'integration_credentials',
  'queues_and_workers',
  'current_ui_surfaces',
  'tests',
  'production_evidence',
];
const REQUIRED_UNSAFE_FINDINGS = [
  'P0_UNSAFE_LEGACY_REST_ADAPTER',
  'P0_UNSAFE_MOCK_API_PUSH',
  'P0_UNSAFE_MOCK_SAGA',
  'P0_UNSAFE_LEGACY_WEBHOOKS',
  'P0_UNSAFE_FALSE_LIVE_CLAIM',
  'P0_UNSAFE_AUCTION_SOURCE_SELF_VERIFICATION',
  'P0_UNSAFE_IN_MEMORY_LOT_WRITES',
];
const REQUIRED_MISSING = [
  'FGIS_CONNECTION_SELLER_LIFECYCLE',
  'FGIS_PARTY_SNAPSHOT',
  'FGIS_PARTY_CURRENT',
  'FGIS_SYNC_RUN',
  'COMMODITY_RESERVATION_LEDGER',
  'PERSISTENT_LOT_PASSPORT',
  'FGIS_RECONCILIATION_CASE',
  'ATOMIC_CONFIRMED_LOT_PUBLICATION',
];
const REQUIRED_EXTERNAL_BLOCKERS = [
  'FGIS_RUNTIME_SOAP_ENDPOINTS',
  'FGIS_ENABLED_API_VERSION',
  'FGIS_REGISTERED_INITIATOR_CERTIFICATE',
  'FGIS_ORGANIZATION_DATA_SCOPE',
  'FGIS_SIGNATURE_CONFORMANCE',
  'FGIS_ADDITIONAL_NETWORK_AUTH',
];

function fail(message) {
  throw new Error(`P0.2 audit verification failed: ${message}`);
}

function readJson(path) {
  const absolute = resolve(ROOT, path);
  if (!existsSync(absolute)) fail(`missing ${path}`);
  return JSON.parse(readFileSync(absolute, 'utf8'));
}

function readText(path) {
  const absolute = resolve(ROOT, path);
  if (!existsSync(absolute)) fail(`missing ${path}`);
  return readFileSync(absolute, 'utf8');
}

function equalArray(left, right, label) {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    fail(`${label} mismatch: ${JSON.stringify(left)} != ${JSON.stringify(right)}`);
  }
}

function requireSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const missing = expected.filter((value) => !actualSet.has(value));
  if (missing.length > 0) fail(`${label} missing: ${missing.join(', ')}`);
}

function allStatuses(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) allStatuses(item, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [key, nested] of Object.entries(value)) {
    if (key === 'status' && typeof nested === 'string') output.push(nested);
    allStatuses(nested, output);
  }
  return output;
}

function assertContains(path, needles) {
  const content = readText(path);
  for (const needle of needles) {
    if (!content.includes(needle)) fail(`${path} no longer contains ${JSON.stringify(needle)}`);
  }
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

const inventory = readJson(INVENTORY_PATH);
const scope = readJson(SCOPE_PATH);
const report = readText(REPORT_PATH);

if (inventory.schemaVersion !== 'p0.2.fgis-first-confirmed-lot-audit.v1') {
  fail(`unexpected inventory schema ${inventory.schemaVersion}`);
}
if (inventory.issue?.number !== 3585) fail('issue must be #3585');
if (inventory.audit?.exactMainSha !== EXPECTED_BASE) fail('inventory exactMainSha drift');
if (scope.baseCommit !== EXPECTED_BASE) fail('scope baseCommit drift');
if (scope.issue !== 3585) fail('scope issue must be #3585');
if (scope.activeSlice !== 'P0.2-STAGE-1-AUDIT') fail('scope is not audit-only');
if (scope.operationalStatus !== 'NOT_ATTESTED') fail('scope operational status must be NOT_ATTESTED');
if (inventory.audit?.operationalStatus !== 'NOT_ATTESTED') fail('inventory operational status must be NOT_ATTESTED');
if (inventory.audit?.productionHosting !== 'REG_RU_VPS_ONLY') fail('production hosting boundary drift');
if (inventory.audit?.liveConfirmedCount !== 0) fail('LIVE_CONFIRMED count must remain zero');
if (inventory.verdict?.p0_2CommercialPathReady !== false) fail('commercial path cannot be marked ready');
if (inventory.verdict?.canonicalModule !== 'apps/api/src/modules/regulatory-integration/fgis-grain') {
  fail('canonical module drift');
}
if (inventory.verdict?.parallelFgisContourAllowed !== false) fail('parallel FGIS contour must be forbidden');
if (inventory.verdict?.nextSlice !== 'P0.2-1A-LEGACY-FGIS-QUARANTINE') fail('unsafe quarantine must remain first');

equalArray([...(scope.allowedPaths ?? [])].sort(), EXPECTED_ALLOWED_PATHS, 'scope allowedPaths');
if (scope.boundaries?.auditOnly !== true) fail('scope auditOnly must be true');
for (const key of [
  'applicationCodeChange',
  'databaseOrMigrationChange',
  'productionActivation',
  'providerCall',
  'credentialOrCertificateMaterial',
  'externalLiveClaim',
  'firstCustomerAccessChange',
]) {
  if (scope.boundaries?.[key] !== false) fail(`scope boundary ${key} must be false`);
}

if (!Array.isArray(inventory.requiredAuditAreas) || inventory.requiredAuditAreas.length !== 17) {
  fail('exactly 17 required audit areas are required');
}
equalArray(inventory.requiredAuditAreas.map((area) => area.key), REQUIRED_AREAS, 'required audit areas');
equalArray(inventory.requiredAuditAreas.map((area) => area.order), Array.from({ length: 17 }, (_, index) => index + 1), 'audit area order');

const taxonomy = new Set(inventory.statusTaxonomy ?? []);
for (const expected of [
  'LIVE_CONFIRMED',
  'TECHNICALLY_READY',
  'PARTIAL',
  'UI_ONLY',
  'API_ONLY',
  'TEST_ONLY',
  'EMULATOR',
  'FIXTURE',
  'DOCUMENT_ONLY',
  'UNSAFE',
  'DUPLICATE',
  'ABSENT',
  'EXTERNAL_BLOCKER',
]) {
  if (!taxonomy.has(expected)) fail(`status taxonomy missing ${expected}`);
}
for (const status of allStatuses(inventory)) {
  if (!taxonomy.has(status)) fail(`unknown status value ${status}`);
  if (status === 'LIVE_CONFIRMED') fail('no audited element may be LIVE_CONFIRMED');
}

requireSet(inventory.unsafeFindings?.map((finding) => finding.id) ?? [], REQUIRED_UNSAFE_FINDINGS, 'unsafe findings');
if (!inventory.unsafeFindings?.every((finding) => finding.status === 'UNSAFE')) fail('every unsafe finding must be UNSAFE');
requireSet(inventory.missingCapabilities?.map((finding) => finding.id) ?? [], REQUIRED_MISSING, 'missing capabilities');
if (!inventory.missingCapabilities?.every((finding) => finding.status === 'ABSENT')) fail('every missing capability must be ABSENT');
requireSet(inventory.externalBlockers?.map((finding) => finding.id) ?? [], REQUIRED_EXTERNAL_BLOCKERS, 'external blockers');
if (!inventory.externalBlockers?.every((finding) => finding.status === 'EXTERNAL_BLOCKER')) fail('every external blocker must be EXTERNAL_BLOCKER');

if (inventory.officialContract?.pinnedVersion !== '1.0.23') fail('pinned official version drift');
if (inventory.officialContract?.packageSha256 !== '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7') {
  fail('official package SHA-256 drift');
}
if (inventory.officialContract?.transport?.protocol !== 'SOAP_1_1') fail('official transport must be SOAP 1.1');
equalArray(inventory.officialContract.transport.operations, ['SendRequest', 'SendResponse', 'Ack'], 'SOAP operations');
if (inventory.officialContract.transport.documentationEndpointRuntimeAllowed !== false) fail('localhost WSDL endpoint must stay forbidden');
if (inventory.officialContract.operationCounts?.total !== 57
  || inventory.officialContract.operationCounts?.read !== 19
  || inventory.officialContract.operationCounts?.mutation !== 38) {
  fail('official operation counts drift');
}
equalArray(inventory.officialContract.p0_2ReadOperations.map((operation) => operation.code), ['GET_LIST_LOT', 'GET_LIST_SDIZ'], 'P0.2 provider reads');
if (!inventory.officialContract.recordLotMapping?.notPresentAsGenericFields?.includes('unit')) {
  fail('audit must prohibit inventing a RecordLotType unit');
}
for (const unconfirmed of ['mTLS requirement', 'IP allowlist requirement', 'OAuth', 'bearer token', 'client_secret', 'API login and password']) {
  if (!inventory.officialContract.notOfficiallyConfirmed?.includes(unconfirmed)) {
    fail(`unsupported auth claim boundary missing: ${unconfirmed}`);
  }
}

const sourceLock = readJson('docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.source-lock.json');
if (sourceLock.packageSha256 !== inventory.officialContract.packageSha256) fail('source lock package SHA mismatch');
if (sourceLock.boundaries?.credentialsPresent !== false
  || sourceLock.boundaries?.liveConnection !== false
  || sourceLock.boundaries?.confirmedLive !== false) {
  fail('source lock must remain non-live and credential-free');
}

const catalog = readJson('docs/platform-v7/crop-platform/fgis-grain-api-1.0.23.operation-catalog.json');
if (catalog.transport?.documentationEndpoint?.runtimeAllowed !== false) fail('catalog localhost endpoint must not be runtime-allowed');
if (catalog.business?.operationCount !== 57) fail('catalog operation count drift');
const catalogOperations = new Map(catalog.business.operations.map((operation) => [operation[0], operation]));
for (const code of ['GET_LIST_LOT', 'GET_LIST_SDIZ']) {
  if (catalogOperations.get(code)?.[3] !== 'READ') fail(`${code} must be an official READ operation`);
}

assertContains('apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.transport.ts', [
  'readonly available = false',
  'FGIS_GRAIN_READ_TRANSPORT_DISABLED',
  "operationalStatus: 'NOT_ATTESTED'",
]);
assertContains('apps/api/src/outbox-worker.module.ts', [
  'FailClosedFgisGrainProviderConfigurationPort',
  'FailClosedFgisGrainImmutablePayloadStorePort',
  'FailClosedFgisGrainCanonicalizationPort',
  'FailClosedFgisGrainSigningProviderPort',
  'FailClosedFgisGrainSignedEnvelopeAssemblerPort',
  'FailClosedFgisGrainSoapTransportPort',
]);
assertContains('packages/integration-sdk/src/live/live-fgis-zerno.adapter.ts', [
  'VENDOR MAPPING',
  "path: '/lots'",
]);
assertContains('packages/integration-sdk/src/registry.ts', ['new MockFgisZernoAdapter()']);
assertContains('apps/api/src/modules/integrations/integrations.service.ts', [
  "culture: 'wheat'",
  'volumeTons: 100',
  "status: 'MOCK_OK'",
]);
assertContains('apps/api/src/modules/integrations/edo-webhook.controller.ts', [
  "@Post('fgis')",
  'timestamp is optional in degraded mode',
  'processedEventIds = new Map',
]);
assertContains('apps/api/src/modules/admin/admin.controller.ts', [
  "ФГИС «Зерно» Saga Step (registerLot + confirmShipment)', status: 'live'",
]);
assertContains('apps/api/prisma/migrations/20260715013100_auction_atomic_execution/migration.sql', [
  'source_verified_at',
  "'BIDDING'",
  "'ADMITTED'",
]);
assertContains('apps/api/src/modules/lots/lots.service.ts', [
  "id: 'LOT-001'",
  "sellerOrgId: user?.orgId || 'demo-org'",
]);

for (const requiredReportText of [
  EXPECTED_BASE,
  'LIVE_CONFIRMED`: **0**',
  'P0.2-1A-LEGACY-FGIS-QUARANTINE',
  '7/7 suites, 63/63 tests PASS',
  'REG_RU_VPS_ONLY',
]) {
  if (!report.includes(requiredReportText)) fail(`report missing ${JSON.stringify(requiredReportText)}`);
}

try {
  git(['cat-file', '-e', `${EXPECTED_BASE}^{commit}`]);
  git(['merge-base', '--is-ancestor', EXPECTED_BASE, 'HEAD']);
} catch {
  fail(`exact main ${EXPECTED_BASE} is not an ancestor of HEAD`);
}

const committedPaths = git(['diff', '--name-only', `${EXPECTED_BASE}...HEAD`])
  .split('\n')
  .filter(Boolean)
  .sort();
const untrackedPaths = git(['ls-files', '--others', '--exclude-standard'])
  .split('\n')
  .filter(Boolean)
  .sort();
const changedPaths = [...new Set([...committedPaths, ...untrackedPaths])].sort();
const outOfScope = changedPaths.filter((path) => !EXPECTED_ALLOWED_PATHS.includes(path));
if (outOfScope.length > 0) fail(`out-of-scope paths since exact main: ${outOfScope.join(', ')}`);

console.log(JSON.stringify({
  status: 'PASS',
  schemaVersion: inventory.schemaVersion,
  issue: inventory.issue.number,
  exactMainSha: EXPECTED_BASE,
  operationalStatus: inventory.audit.operationalStatus,
  liveConfirmedCount: inventory.audit.liveConfirmedCount,
  requiredAuditAreas: inventory.requiredAuditAreas.length,
  unsafeFindings: inventory.unsafeFindings.length,
  missingCapabilities: inventory.missingCapabilities.length,
  externalBlockers: inventory.externalBlockers.length,
  nextSlice: inventory.verdict.nextSlice,
  changedPaths,
}, null, 2));
