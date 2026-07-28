#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, '../..');
const registryPath = resolve(
  repositoryRoot,
  'docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json',
);
const schemaPath = resolve(
  repositoryRoot,
  'docs/platform-v7/crop-platform/agricultural-government-systems.registry.schema.v1.json',
);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function assertExactKeys(value, expected, context) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${context} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(JSON.stringify(actual) === JSON.stringify(wanted), `${context} has unexpected shape: ${actual.join(', ')}`);
}

function assertUnique(values, context) {
  assert(new Set(values).size === values.length, `${context} must be unique`);
}

function assertEnum(value, allowed, context) {
  assert(allowed.includes(value), `${context} has unsupported value ${JSON.stringify(value)}`);
}

function assertHttpsUri(value, context) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${context} is not a valid URL`);
  }
  assert(parsed.protocol === 'https:', `${context} must use https`);
  return parsed;
}

function sameSet(actual, expected, context) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  assert(JSON.stringify(left) === JSON.stringify(right), `${context} mismatch: ${left.join(', ')}`);
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const registryText = readFileSync(registryPath, 'utf8');
const registry = JSON.parse(registryText);
const checks = [];

function pass(code, detail) {
  checks.push({ code, status: 'PASS', detail });
}

assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema must use draft 2020-12');
assert(schema.type === 'object', 'schema root must be an object');
assert(schema.additionalProperties === false, 'schema root must reject additional properties');
assert(schema.$defs?.system?.additionalProperties === false, 'system schema must reject additional properties');
assert(schema.$defs?.coverageEntry?.additionalProperties === false, 'coverage schema must reject additional properties');
pass('SCHEMA_STRICTNESS', 'Draft 2020-12 and closed object shapes are declared.');

assertExactKeys(registry, [
  '$schema',
  'schemaVersion',
  'registryVersion',
  'generatedAt',
  'evidenceCutoff',
  'operationalStatus',
  'productionHosting',
  'policies',
  'inventoryAuthorities',
  'systems',
  'coverage',
  'forbiddenClaims',
], 'registry');
assert(registry.$schema === './agricultural-government-systems.registry.schema.v1.json', 'registry schema reference mismatch');
assert(registry.schemaVersion === 'pc-crop.agricultural-government-systems.registry.v1', 'registry schema version mismatch');
assert(/^\d+\.\d+\.\d+$/u.test(registry.registryVersion), 'registry version must be semver');
assert(!Number.isNaN(Date.parse(registry.generatedAt)), 'generatedAt must be an ISO date-time');
assert(/^\d{4}-\d{2}-\d{2}$/u.test(registry.evidenceCutoff), 'evidenceCutoff must be an ISO date');
assert(registry.operationalStatus === 'NOT_ATTESTED', 'operational status may not exceed NOT_ATTESTED');
assert(registry.productionHosting === 'REG_RU_VPS_ONLY', 'production hosting boundary changed');
pass('ROOT_MATURITY', 'Registry is NOT_ATTESTED and bound to REG_RU_VPS_ONLY.');

assertExactKeys(registry.policies, [
  'defaultIntegrationStatus',
  'defaultPlatformState',
  'credentialMaterialStored',
  'credentialReferencesOnly',
  'tenantIsolationAssessment',
  'tenantIsolationRequirement',
  'publicRegistryRule',
  'writeEnablementRule',
], 'policies');
assert(registry.policies.defaultIntegrationStatus === 'NOT_ASSESSED', 'default integration status must fail closed');
assert(registry.policies.defaultPlatformState === 'DISABLED', 'default platform state must be disabled');
assert(registry.policies.credentialMaterialStored === false, 'credential material may not be stored');
assert(registry.policies.credentialReferencesOnly === true, 'only credential references are allowed');
assert(registry.policies.tenantIsolationAssessment === 'NOT_ASSESSED', 'tenant isolation must remain unassessed');
assert(
  registry.policies.tenantIsolationRequirement === 'SERVER_DERIVED_RBAC_RLS_REQUIRED_BEFORE_ENABLEMENT',
  'tenant isolation requirement changed',
);
pass('GLOBAL_FAIL_CLOSED_POLICY', 'Credentials, tenant isolation and writes remain fail closed.');

const inventoryKeys = [
  'inventoryCode',
  'title',
  'officialLocator',
  'verificationStatus',
  'verifiedAt',
  'coverageCodes',
];
const inventoryCodes = registry.inventoryAuthorities.map((inventory) => {
  assertExactKeys(inventory, inventoryKeys, `inventory ${inventory.inventoryCode ?? '<missing>'}`);
  assert(/^[A-Z0-9_]{3,80}$/u.test(inventory.inventoryCode), 'invalid inventory code');
  assertHttpsUri(inventory.officialLocator, `inventory ${inventory.inventoryCode} locator`);
  assertEnum(
    inventory.verificationStatus,
    ['VERIFIED_PUBLIC', 'VERIFIED_INDEXED', 'OFFICIAL_LOCATOR_ACCESS_FAILED'],
    `inventory ${inventory.inventoryCode} status`,
  );
  assert(inventory.verifiedAt === registry.evidenceCutoff, `inventory ${inventory.inventoryCode} verification is stale`);
  assert(Array.isArray(inventory.coverageCodes) && inventory.coverageCodes.length > 0, 'inventory coverage is empty');
  assertUnique(inventory.coverageCodes, `inventory ${inventory.inventoryCode} coverage`);
  return inventory.inventoryCode;
});
assertUnique(inventoryCodes, 'inventory codes');
pass('INVENTORY_AUTHORITIES', `${inventoryCodes.length} official inventory authorities are registered.`);

const systemKeys = [
  'systemCode',
  'officialName',
  'shortName',
  'kind',
  'domain',
  'inventoryCodes',
  'parentSystemCode',
  'responsibleAuthority',
  'applicability',
  'evidenceClass',
  'integrationStatus',
  'accessMode',
  'platformState',
  'officialLocators',
  'apiContract',
  'readEvidence',
  'writeEvidence',
  'platformReadEnabled',
  'platformWriteEnabled',
  'credentialRequirement',
  'signatureRequirement',
  'blockers',
];
const locatorKeys = ['url', 'role', 'verifiedAt', 'retrievalStatus'];
const apiKeys = ['status', 'version', 'artifacts'];
const apiArtifactKeys = ['label', 'sha256'];
const kinds = ['SYSTEM', 'PLATFORM', 'UMBRELLA', 'COMPONENT', 'PUBLIC_REGISTRY', 'TRANSPORT', 'PUBLIC_INFORMATION_RESOURCE'];
const domains = ['MCX', 'PLANT_PRODUCTION', 'VETERINARY', 'PHYTOSANITARY', 'CHEMICAL_TRACEABILITY', 'ACCREDITATION', 'TRANSPORT', 'TAX', 'CUSTOMS', 'AML', 'INTERAGENCY'];
const applicability = ['CORE_CROP', 'CONDITIONAL_CROP', 'ADJACENT', 'OUT_OF_SCOPE_CURRENT'];
const evidenceClasses = ['OFFICIAL_PRIMARY', 'OFFICIAL_SUBORDINATE', 'OFFICIAL_COMPONENT_HELP'];
const integrationStatuses = ['CONTRACT_PINNED', 'NOT_ASSESSED', 'DECLARATION_ONLY'];
const accessModes = ['PUBLIC_REGISTRY', 'PUBLIC_INFORMATION_ONLY', 'OFFICIAL_ACCESS_REQUIRED'];
const platformStates = ['DISABLED', 'SANDBOX_ONLY'];
const readEvidence = ['PUBLIC_QUERY_DOCUMENTED', 'OFFICIAL_API_DOCUMENTED', 'PORTAL_ONLY', 'NOT_ASSESSED', 'NOT_APPLICABLE'];
const writeEvidence = ['OFFICIAL_API_DOCUMENTED', 'PORTAL_ONLY', 'NOT_ASSESSED', 'NOT_APPLICABLE'];
const requirementValues = ['REQUIRED', 'NOT_REQUIRED', 'NOT_ASSESSED'];
const officialHosts = [
  'mcx.gov.ru',
  'specagro.ru',
  'pop-ntor.mcx.ru',
  'usmt-nr.mcx.ru',
  'nsi.mcx.ru',
  'sp-form.mcx.ru',
  'fgis-saturn.ru',
  'fsvps.gov.ru',
  'help.vetrf.ru',
  'pub.fsa.gov.ru',
  'mintrans.gov.ru',
  'egrul.nalog.ru',
  'smev3.gosuslugi.ru',
  'customs.gov.ru',
  'www.fedsfm.ru',
];

const systemsByCode = new Map();
for (const system of registry.systems) {
  assertExactKeys(system, systemKeys, `system ${system.systemCode ?? '<missing>'}`);
  assert(/^[A-Z0-9_]{3,100}$/u.test(system.systemCode), `invalid system code ${system.systemCode}`);
  assert(!systemsByCode.has(system.systemCode), `duplicate system ${system.systemCode}`);
  systemsByCode.set(system.systemCode, system);
  assertEnum(system.kind, kinds, `${system.systemCode} kind`);
  assertEnum(system.domain, domains, `${system.systemCode} domain`);
  assertEnum(system.applicability, applicability, `${system.systemCode} applicability`);
  assertEnum(system.evidenceClass, evidenceClasses, `${system.systemCode} evidence class`);
  assertEnum(system.integrationStatus, integrationStatuses, `${system.systemCode} integration status`);
  assertEnum(system.accessMode, accessModes, `${system.systemCode} access mode`);
  assertEnum(system.platformState, platformStates, `${system.systemCode} platform state`);
  assertEnum(system.readEvidence, readEvidence, `${system.systemCode} read evidence`);
  assertEnum(system.writeEvidence, writeEvidence, `${system.systemCode} write evidence`);
  assertEnum(system.credentialRequirement, requirementValues, `${system.systemCode} credential requirement`);
  assertEnum(system.signatureRequirement, requirementValues, `${system.systemCode} signature requirement`);
  assert(system.platformReadEnabled === false, `${system.systemCode} platform read must be disabled`);
  assert(system.platformWriteEnabled === false, `${system.systemCode} platform write must be disabled`);
  assert(Array.isArray(system.inventoryCodes) && system.inventoryCodes.length > 0, `${system.systemCode} lacks inventory`);
  assertUnique(system.inventoryCodes, `${system.systemCode} inventories`);
  assert(Array.isArray(system.officialLocators) && system.officialLocators.length > 0, `${system.systemCode} lacks locator`);
  for (const locator of system.officialLocators) {
    assertExactKeys(locator, locatorKeys, `${system.systemCode} locator`);
    const parsed = assertHttpsUri(locator.url, `${system.systemCode} locator`);
    assert(officialHosts.includes(parsed.hostname), `${system.systemCode} locator host is not an approved official host`);
    assertEnum(
      locator.role,
      ['OFFICIAL_INVENTORY', 'OFFICIAL_SYSTEM_PORTAL', 'OFFICIAL_HELP', 'OFFICIAL_PUBLIC_REGISTRY', 'OFFICIAL_ACCESS_GUIDE', 'OFFICIAL_TECHNICAL_PORTAL'],
      `${system.systemCode} locator role`,
    );
    assert(locator.verifiedAt === registry.evidenceCutoff, `${system.systemCode} locator verification is stale`);
    assertEnum(
      locator.retrievalStatus,
      ['VERIFIED_PUBLIC', 'VERIFIED_INDEXED', 'OFFICIAL_LOCATOR_ACCESS_FAILED'],
      `${system.systemCode} locator retrieval status`,
    );
  }
  assertExactKeys(system.apiContract, apiKeys, `${system.systemCode} API contract`);
  assertEnum(system.apiContract.status, ['PINNED', 'NOT_ASSESSED', 'NOT_APPLICABLE'], `${system.systemCode} API status`);
  assert(Array.isArray(system.apiContract.artifacts), `${system.systemCode} API artifacts must be an array`);
  for (const artifact of system.apiContract.artifacts) {
    assertExactKeys(artifact, apiArtifactKeys, `${system.systemCode} API artifact`);
    assert(/^[a-f0-9]{64}$/u.test(artifact.sha256), `${system.systemCode} has invalid API artifact hash`);
  }
  if (system.apiContract.status === 'PINNED') {
    assert(typeof system.apiContract.version === 'string' && system.apiContract.version.length > 0, `${system.systemCode} pinned API lacks version`);
    assert(system.apiContract.artifacts.length > 0, `${system.systemCode} pinned API lacks hashes`);
  } else {
    assert(system.apiContract.artifacts.length === 0, `${system.systemCode} unpinned API may not carry authoritative hashes`);
  }
  assert(Array.isArray(system.blockers) && system.blockers.length > 0, `${system.systemCode} must declare blockers`);
  assertUnique(system.blockers, `${system.systemCode} blockers`);
  if (system.integrationStatus === 'NOT_ASSESSED' && !['PUBLIC_REGISTRY', 'PUBLIC_INFORMATION_ONLY'].includes(system.accessMode)) {
    assert(system.accessMode === 'OFFICIAL_ACCESS_REQUIRED', `${system.systemCode} unknown access must fail closed`);
  }
  if (system.kind === 'PUBLIC_REGISTRY') {
    assert(system.accessMode === 'PUBLIC_REGISTRY', `${system.systemCode} public registry access mode mismatch`);
    assert(
      system.officialLocators.some((locator) => locator.role === 'OFFICIAL_PUBLIC_REGISTRY'),
      `${system.systemCode} public registry lacks an official registry locator`,
    );
  }
}
pass('SYSTEM_SHAPE_AND_MATURITY', `${systemsByCode.size} systems/components are structurally valid and disabled.`);

for (const inventory of registry.inventoryAuthorities) {
  for (const systemCode of inventory.coverageCodes) {
    const system = systemsByCode.get(systemCode);
    assert(system, `${inventory.inventoryCode} references missing system ${systemCode}`);
    assert(system.inventoryCodes.includes(inventory.inventoryCode), `${systemCode} does not bind back to ${inventory.inventoryCode}`);
  }
}
for (const system of registry.systems) {
  for (const inventoryCode of system.inventoryCodes) {
    const inventory = registry.inventoryAuthorities.find((item) => item.inventoryCode === inventoryCode);
    assert(inventory, `${system.systemCode} references missing inventory ${inventoryCode}`);
    assert(inventory.coverageCodes.includes(system.systemCode), `${inventoryCode} omits ${system.systemCode}`);
  }
  if (system.parentSystemCode !== null) {
    assert(systemsByCode.has(system.parentSystemCode), `${system.systemCode} parent is missing`);
  }
}
pass('BIDIRECTIONAL_INVENTORY_LINKS', 'Every inventory and system reference is bidirectional.');

const mcxExpected = [
  'MCX_ECP_APK',
  'EFGIS_ZSN',
  'MCX_IAS_NTOR_SH',
  'FGIS_USMT',
  'MCX_KIS_REPORTING',
  'FGIS_GRAIN',
  'FGIS_SEED',
  'FGIAS_PR',
  'MCX_OFFICIAL_WEBSITE',
];
const mcxInventory = registry.inventoryAuthorities.find((item) => item.inventoryCode === 'MCX_CURRENT_GIS_LIST');
sameSet(mcxInventory.coverageCodes, mcxExpected, 'current Ministry inventory');
pass('MCX_CURRENT_LIST_COVERAGE', 'All 9 entries from the current Ministry inventory are represented.');

const vetisExpected = [
  'VETIS_ARGUS',
  'VETIS_ASSOL',
  'VETIS_ATLAS',
  'VETIS_VESTA',
  'VETIS_API',
  'VETIS_GALEN',
  'VETIS_HERMES',
  'VETIS_DUMA',
  'VETIS_IKAR',
  'VETIS_IRENA',
  'VETIS_MERCURY',
  'VETIS_PASSPORT',
  'VETIS_SIRANO',
  'VETIS_TOR',
  'VETIS_HORRIOT',
  'VETIS_CERBERUS',
  'VETIS_ECERT',
];
const vetisInventory = registry.inventoryAuthorities.find((item) => item.inventoryCode === 'VETIS_CURRENT_COMPONENT_NAVIGATION');
sameSet(vetisInventory.coverageCodes, vetisExpected, 'VetIS component inventory');
for (const code of vetisExpected) {
  assert(systemsByCode.get(code).parentSystemCode === 'FGIS_VETIS', `${code} must be a VetIS component`);
}
pass('VETIS_COMPONENT_COVERAGE', 'VetIS umbrella and 17 current help-navigation components are represented.');

for (const code of ['FGIS_SATURN', 'FGIS_ARGUS_FITO', 'FGIS_VETIS', 'VETIS_MERCURY', 'FGIS_ROSACCREDITATION', 'GIS_EPD', 'GIS_EPD_OPERATOR_REGISTRY']) {
  assert(systemsByCode.has(code), `critical system ${code} is missing`);
}
pass('CRITICAL_SYSTEM_COVERAGE', 'Saturn, Argus-Fito, VetIS/Mercury, Rosaccreditation and GIS EPD are present.');

const fgisGrain = systemsByCode.get('FGIS_GRAIN');
assert(fgisGrain.integrationStatus === 'CONTRACT_PINNED', 'FGIS Grain must be contract pinned');
assert(fgisGrain.platformState === 'SANDBOX_ONLY', 'FGIS Grain may not exceed SANDBOX_ONLY');
assert(fgisGrain.apiContract.version === '1.0.23', 'FGIS Grain API version mismatch');
sameSet(
  fgisGrain.apiContract.artifacts.map((artifact) => artifact.sha256),
  [
    '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7',
    '4fc7cc075b956f0adca26331a99627d07cde77d63ec2fc017d0cbbc5f701c87a',
  ],
  'FGIS Grain pinned hashes',
);
const otherPinned = registry.systems.filter((system) => system.systemCode !== 'FGIS_GRAIN' && system.apiContract.status === 'PINNED');
assert(otherPinned.length === 0, 'only FGIS Grain has a pinned API contract in this slice');
pass('FGIS_GRAIN_MATURITY_CAP', 'API 1.0.23 is hash-pinned but remains NOT_ATTESTED and SANDBOX_ONLY.');

const gisEpd = systemsByCode.get('GIS_EPD');
assert(gisEpd.accessMode === 'OFFICIAL_ACCESS_REQUIRED', 'GIS EPD direct access may not be claimed');
assert(
  gisEpd.blockers.includes('DIRECT_PARTICIPANT_CONNECTION_IS_NOT_AVAILABLE_USE_ACCREDITED_IS_EPD_OPERATOR'),
  'GIS EPD accredited-operator boundary is missing',
);
const operatorRegistry = systemsByCode.get('GIS_EPD_OPERATOR_REGISTRY');
assert(operatorRegistry.kind === 'PUBLIC_REGISTRY', 'GIS EPD operator registry must be modeled separately');
pass('GIS_EPD_OPERATOR_BOUNDARY', 'Direct GIS EPD access and accredited IS EPD operator registry are separate facts.');

for (const code of ['FSA_CERTIFICATE_REGISTRY', 'FSA_DECLARATION_REGISTRY', 'FSA_ACCREDITED_PERSONS_REGISTRY']) {
  const row = systemsByCode.get(code);
  assert(row.kind === 'PUBLIC_REGISTRY', `${code} must remain a public registry`);
  assert(row.parentSystemCode === 'FGIS_ROSACCREDITATION', `${code} must belong to FGIS Rosaccreditation`);
  assert(row.platformReadEnabled === false && row.platformWriteEnabled === false, `${code} may not be called integrated`);
}
pass('ROSACCREDITATION_BOUNDARY', 'FGIS umbrella and individual public registries are classified without a live API claim.');

assertExactKeys(registry.coverage, ['publicUiProviders', 'integrationSdkAdapters'], 'coverage');
const coverageKeys = ['code', 'classification', 'targetSystemCodes', 'observedPath', 'observedState', 'nextEvidence'];
const classifications = [
  'GOVERNMENT_SYSTEM_DECLARATION',
  'ADJACENT_SYSTEM_DECLARATION',
  'TRANSPORT_DECLARATION',
  'NON_GOVERNMENT_PROVIDER_DECLARATION',
  'VENDOR_DECLARATION',
];
const observedStates = ['MANUAL_ROUTE', 'SIMULATION_ONLY', 'TEST_DECLARATION', 'MOCK_ADAPTER'];
for (const [groupName, entries] of Object.entries(registry.coverage)) {
  assert(Array.isArray(entries), `${groupName} must be an array`);
  assertUnique(entries.map((entry) => entry.code), `${groupName} codes`);
  for (const entry of entries) {
    assertExactKeys(entry, coverageKeys, `${groupName} ${entry.code}`);
    assertEnum(entry.classification, classifications, `${entry.code} classification`);
    assertEnum(entry.observedState, observedStates, `${entry.code} observed state`);
    assert(Array.isArray(entry.targetSystemCodes), `${entry.code} targets must be an array`);
    assertUnique(entry.targetSystemCodes, `${entry.code} targets`);
    for (const target of entry.targetSystemCodes) {
      assert(systemsByCode.has(target), `${entry.code} references missing target ${target}`);
    }
    assert(!/live|production.enabled|confirmed.live/iu.test(entry.observedState), `${entry.code} contains a live claim`);
  }
}

const expectedUi = [
  'sber_safe_deals',
  'sber_business_id',
  'sber_credit',
  'fgis_grain',
  'edo_saby',
  'edo_diadoc',
  'gps_wialon',
  'logistics_sphere',
];
const expectedSdk = [
  'FGIS_ZERNO',
  'FNS',
  'DIADOK',
  'CRYPTOPRO_DSS',
  'BANK',
  'GPS',
  'FTS',
  'RSHN',
  'AML_ROSFINMONITORING',
  'RZD_ETRAN',
  'GIS_EPD',
  'BKI_NBKI',
  'TAKSKOM',
  'MARINE_TRAFFIC',
  'SMEV',
];
sameSet(registry.coverage.publicUiProviders.map((entry) => entry.code), expectedUi, 'public UI provider coverage');
sameSet(registry.coverage.integrationSdkAdapters.map((entry) => entry.code), expectedSdk, 'integration SDK adapter coverage');
assert(
  registry.coverage.publicUiProviders.find((entry) => entry.code === 'fgis_grain').observedState === 'MANUAL_ROUTE',
  'public FGIS Grain status must remain manual',
);
const sphere = registry.coverage.publicUiProviders.find((entry) => entry.code === 'logistics_sphere');
assert(sphere.classification === 'NON_GOVERNMENT_PROVIDER_DECLARATION', 'Sphere may not be classified as a government system');
assert(sphere.targetSystemCodes.includes('GIS_EPD_OPERATOR_REGISTRY'), 'Sphere must point to operator-registry verification');
assert(
  registry.coverage.integrationSdkAdapters.every((entry) => entry.observedState === 'MOCK_ADAPTER'),
  'integration SDK adapters must remain classified as mocks',
);
pass('LEGACY_CODE_COVERAGE', 'All 8 public UI provider codes and 15 SDK adapter codes are classified exactly once.');

const dangerousKey = /^(password|secret|secretValue|apiKey|accessToken|refreshToken|privateKey|credentialValue)$/iu;
function inspectSecrets(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectSecrets(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert(!dangerousKey.test(key), `secret-bearing key is forbidden at ${path}.${key}`);
      inspectSecrets(child, `${path}.${key}`);
    }
  }
}
inspectSecrets(registry);
for (const pattern of [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
]) {
  assert(!pattern.test(registryText), `registry contains secret-like material matching ${pattern}`);
}
pass('NO_SECRET_MATERIAL', 'No credential values, tokens or private-key material are stored.');

for (const claim of [
  'CONFIRMED_LIVE',
  'PRODUCTION_INTEGRATION_ENABLED',
  'PUBLIC_WEB_PAGE_EQUALS_ATTESTED_API',
  'VENDOR_IS_AN_ACCREDITED_IS_EPD_OPERATOR_WITHOUT_CURRENT_REGISTRY_EVIDENCE',
]) {
  assert(registry.forbiddenClaims.includes(claim), `forbidden claim ${claim} is missing`);
}
assertUnique(registry.forbiddenClaims, 'forbidden claims');
pass('FORBIDDEN_CLAIMS', `${registry.forbiddenClaims.length} explicit maturity overclaims are prohibited.`);

const scopeGuardIndex = process.argv.indexOf('--scope-guard');
if (scopeGuardIndex >= 0) {
  const baseRef = process.argv[scopeGuardIndex + 1];
  assert(baseRef, '--scope-guard requires a base ref');
  const changed = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
  const allowed = new Set([
    '.github/workflows/pc-crop-10a.yml',
    'docs/platform-v7/autopilot/autopilot-state.json',
    'docs/platform-v7/autopilot/scopes/pc-crop-10a-government-systems-registry.json',
    'docs/platform-v7/crop-platform/agricultural-government-systems.registry.schema.v1.json',
    'docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json',
    'scripts/pc-crop-10a/verify.mjs',
  ]);
  const outside = changed.filter((path) => !allowed.has(path));
  assert(outside.length === 0, `scope guard rejected paths: ${outside.join(', ')}`);
  pass('SCOPE_GUARD', `${changed.length} changed paths are inside PC-CROP-10A.`);
}

const result = {
  schemaVersion: 'pc-crop.agricultural-government-systems.acceptance.v1',
  status: 'PASS',
  operationalStatus: registry.operationalStatus,
  productionHosting: registry.productionHosting,
  evidenceCutoff: registry.evidenceCutoff,
  counts: {
    inventoryAuthorities: registry.inventoryAuthorities.length,
    systems: registry.systems.length,
    ministryCurrentEntries: mcxInventory.coverageCodes.length,
    vetisComponents: vetisInventory.coverageCodes.length,
    publicUiProviders: registry.coverage.publicUiProviders.length,
    integrationSdkAdapters: registry.coverage.integrationSdkAdapters.length,
  },
  checks,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
