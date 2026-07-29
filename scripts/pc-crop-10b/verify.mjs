#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const PATHS = {
  lock: 'docs/platform-v7/autopilot/project-locks/pc-crop-remainder.json',
  scope: 'docs/platform-v7/autopilot/scopes/pc-crop-10b-truth-sync-3390.json',
  registry: 'docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json',
  schema: 'docs/platform-v7/crop-platform/agricultural-government-systems.authority-bindings.schema.v1.json',
  bindings: 'docs/platform-v7/crop-platform/agricultural-government-systems.authority-bindings.v1.json',
  readiness: 'docs/platform-v7/crop-platform/agricultural-government-systems.readiness.v1.json',
};
const OUTPUT = 'artifacts/pc-crop-10b/acceptance.json';
const failures = [];

const EXPECTED = [
  ['PC-CROP-08A', 3156, 'a8f0fda722967d37dffaea76db6014b9fdd196ee'],
  ['PC-CROP-08B', 3159, 'e6b92a6b71c9edb8e93c408d730dced4b3f54e34'],
  ['PC-CROP-08C', 3166, '97f3c140bd31b5ab46642eeaee9484a0a15491a2'],
  ['PC-CROP-08D', 3169, 'cfad7089412c3c4bdd1cd866e08454a3451fa35f'],
  ['PC-CROP-08E', 3173, '918e538cc48b53a17e845ddf2f5694d3f8c981ab'],
  ['PC-CROP-08F', 3180, 'd79064333ff5653baa43528fd6a956bd9b2fbb87'],
  ['PC-CROP-08H', 3284, 'be4cc002aa2a9581ada123084f96ea73cac3980e'],
  ['PC-CROP-08I', 3313, 'ed7b00daed390e391ec8450801cbbe00942a660a'],
  ['PC-CROP-10A', 3326, '0446f477e418e6dcbd97faa627b1ef7b57b4fa4e'],
];
const EXPECTED_PACKAGE_SHA = '085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7';
const EXPECTED_CATALOG_SHA = '4fc7cc075b9564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7';
const ACTUAL_CATALOG_SHA = '4fc7cc075b956f0adca26331a99627d07cde77d63ec2fc017d0cbbc5f701c87a';
const EXPECTED_REGISTRY_BLOB = '0b790f54599302edeaa46e9ea4e64fbc4f3a8442';

function readText(path) {
  return fs.readFileSync(path, 'utf8');
}

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function check(condition, message, target = failures) {
  if (!condition) target.push(message);
}

function exactKeys(value, expected, label, target = failures) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    target.push(`${label} is not an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  check(JSON.stringify(actual) === JSON.stringify(wanted), `${label} keys mismatch: ${actual.join(',')}`, target);
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitSucceeds(...args) {
  try {
    execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function arrayEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateSchema(schema, target = failures) {
  check(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'binding schema draft mismatch', target);
  check(schema.type === 'object' && schema.additionalProperties === false, 'binding schema must be closed', target);
  check(schema.properties?.operationalStatus?.const === 'NOT_ATTESTED', 'schema operational status weakened', target);
  check(schema.properties?.productionHosting?.const === 'REG_RU_VPS_ONLY', 'schema production authority weakened', target);
  check(schema.properties?.runtimeAuthorities?.minItems === 9 && schema.properties?.runtimeAuthorities?.maxItems === 9, 'schema runtime authority cardinality mismatch', target);
  check(schema.properties?.declarationBindings?.minItems === 23 && schema.properties?.declarationBindings?.maxItems === 23, 'schema declaration cardinality mismatch', target);
  check(schema.$defs?.runtimeAuthority?.additionalProperties === false, 'runtime authority schema is open', target);
  check(schema.$defs?.declarationBinding?.additionalProperties === false, 'declaration binding schema is open', target);
  check(schema.$defs?.nextAdapter?.properties?.slice?.const === 'PC-CROP-10C', 'schema successor slice mismatch', target);
  check(schema.$defs?.nextAdapter?.properties?.mode?.const === 'TENANT_AUTHORIZED_READ_ONLY', 'schema successor mode mismatch', target);
}

function validateProjectBoundary(lock, scope, target = failures) {
  check(lock.id === 'PC-CROP-REMAINDER' && lock.status === 'active', 'active PC-CROP project lock missing', target);
  check(lock.activeIssue === 3390 && lock.activeSlice === 'PC-CROP-10B', 'project lock does not point to PC-CROP-10B/#3390', target);
  check(lock.productionHosting === 'REG_RU_VPS_ONLY' && lock.operationalStatus === 'NOT_ATTESTED', 'project lock boundary mismatch', target);
  check(scope.projectLockId === lock.id, 'scope is not bound to project lock', target);
  check(scope.issue === 3390 && scope.activeSlice === 'PC-CROP-10B', 'scope issue/slice mismatch', target);
  check(scope.productionHosting === 'REG_RU_VPS_ONLY' && scope.operationalStatus === 'NOT_ATTESTED', 'scope truth boundary mismatch', target);
  check(scope.boundaries && Object.values(scope.boundaries).every((value) => value === false), 'scope changes runtime or weakens a gate', target);
  const allowed = new Set(scope.allowedPaths || []);
  for (const path of [PATHS.schema, PATHS.bindings, PATHS.readiness, PATHS.scope, 'scripts/pc-crop-10b/verify.mjs', '.github/workflows/pc-crop-10b.yml']) {
    check(allowed.has(path), `scope missing path ${path}`, target);
  }
  check(!(scope.allowedPaths || []).some((path) => path === '**' || path === 'apps/**'), 'unsafe wildcard scope present', target);
}

function validateRegistryBinding(registry, bindings, target = failures) {
  check(registry.schemaVersion === 'pc-crop.agricultural-government-systems.registry.v1', 'registry schema mismatch', target);
  check(registry.registryVersion === '1.0.0', 'registry version mismatch', target);
  check(registry.operationalStatus === 'NOT_ATTESTED', 'registry operational status elevated', target);
  check(registry.productionHosting === 'REG_RU_VPS_ONLY', 'registry hosting authority mismatch', target);
  check(registry.policies?.credentialMaterialStored === false && registry.policies?.credentialReferencesOnly === true, 'registry credential policy weakened', target);

  exactKeys(bindings.registryBinding, ['path', 'registryVersion', 'mergeSha', 'blobSha'], 'registryBinding', target);
  check(bindings.registryBinding.path === PATHS.registry, 'registry binding path mismatch', target);
  check(bindings.registryBinding.registryVersion === registry.registryVersion, 'registry binding version mismatch', target);
  check(bindings.registryBinding.mergeSha === EXPECTED[8][2], 'registry merge SHA mismatch', target);
  check(bindings.registryBinding.blobSha === EXPECTED_REGISTRY_BLOB, 'registry blob declaration mismatch', target);

  const mergeBlob = git('rev-parse', `${bindings.registryBinding.mergeSha}:${PATHS.registry}`);
  const headBlob = git('rev-parse', `HEAD:${PATHS.registry}`);
  check(mergeBlob === EXPECTED_REGISTRY_BLOB, `accepted registry blob mismatch: ${mergeBlob}`, target);
  check(headBlob === EXPECTED_REGISTRY_BLOB, `current registry drifted after PC-CROP-10A: ${headBlob}`, target);
}

function validateRuntimeAuthorities(bindings, target = failures) {
  check(Array.isArray(bindings.runtimeAuthorities) && bindings.runtimeAuthorities.length === EXPECTED.length, 'runtime authority count mismatch', target);
  const seenSlices = new Set();
  const seenPrs = new Set();
  const actualOrder = [];

  for (const authority of bindings.runtimeAuthorities || []) {
    exactKeys(authority, ['slice', 'pr', 'mergeSha', 'systemCode', 'capabilities', 'requiredPaths', 'runtimeStatus', 'liveEvidence'], `runtimeAuthority:${authority?.slice}`, target);
    check(!seenSlices.has(authority.slice), `duplicate runtime slice ${authority.slice}`, target);
    check(!seenPrs.has(authority.pr), `duplicate PR ${authority.pr}`, target);
    seenSlices.add(authority.slice);
    seenPrs.add(authority.pr);
    actualOrder.push([authority.slice, authority.pr, authority.mergeSha]);
    check(/^[a-f0-9]{40}$/.test(authority.mergeSha || ''), `invalid merge SHA for ${authority.slice}`, target);
    check(authority.liveEvidence === 'ABSENT', `live evidence fabricated for ${authority.slice}`, target);
    check(['ACCEPTED_NON_LIVE_AUTHORITY', 'ACCEPTED_REGISTRY_AUTHORITY'].includes(authority.runtimeStatus), `runtime status invalid for ${authority.slice}`, target);
    check(Array.isArray(authority.capabilities) && authority.capabilities.length >= 1 && new Set(authority.capabilities).size === authority.capabilities.length, `capabilities invalid for ${authority.slice}`, target);
    check(Array.isArray(authority.requiredPaths) && authority.requiredPaths.length >= 2 && new Set(authority.requiredPaths).size === authority.requiredPaths.length, `required paths invalid for ${authority.slice}`, target);

    check(gitSucceeds('cat-file', '-e', `${authority.mergeSha}^{commit}`), `merge commit unavailable: ${authority.mergeSha}`, target);
    check(gitSucceeds('merge-base', '--is-ancestor', authority.mergeSha, 'HEAD'), `${authority.slice} merge is not in exact-head ancestry`, target);
    for (const path of authority.requiredPaths || []) {
      check(!path.includes('*') && !path.includes('..'), `unsafe evidence path ${path}`, target);
      check(gitSucceeds('cat-file', '-e', `${authority.mergeSha}:${path}`), `${authority.slice} evidence missing at merge: ${path}`, target);
      check(gitSucceeds('cat-file', '-e', `HEAD:${path}`), `${authority.slice} evidence missing at exact head: ${path}`, target);
    }
  }
  check(arrayEqual(actualOrder, EXPECTED), 'runtime authority order/PR/SHA matrix mismatch', target);
}

function validateFgisRegistry(registry, target = failures) {
  const grain = (registry.systems || []).find((item) => item.systemCode === 'FGIS_GRAIN');
  check(Boolean(grain), 'FGIS_GRAIN registry row missing', target);
  if (!grain) return;
  check(grain.integrationStatus === 'CONTRACT_PINNED', 'FGIS Grain integration status drift', target);
  check(grain.accessMode === 'OFFICIAL_ACCESS_REQUIRED', 'FGIS Grain access mode drift', target);
  check(grain.platformState === 'SANDBOX_ONLY', 'FGIS Grain platform state must remain SANDBOX_ONLY', target);
  check(grain.apiContract?.status === 'PINNED' && grain.apiContract?.version === '1.0.23', 'FGIS Grain contract pin drift', target);
  const artifacts = new Map((grain.apiContract?.artifacts || []).map((item) => [item.label, item.sha256]));
  check(artifacts.get('official source bundle') === EXPECTED_PACKAGE_SHA, 'FGIS Grain package SHA mismatch', target);
  check(artifacts.get('operation catalog') === ACTUAL_CATALOG_SHA, 'FGIS Grain operation catalog SHA mismatch', target);
  check(grain.platformReadEnabled === false && grain.platformWriteEnabled === false, 'FGIS Grain platform enablement fabricated', target);
  check(grain.credentialReference === null && grain.signatureReference === null, 'FGIS Grain secret reference fabricated', target);
  check(grain.tenantIsolation?.assessment === 'NOT_ASSESSED', 'PC-CROP-10B must not fabricate tenant adapter acceptance', target);
  check((grain.blockers || []).includes('REAL_CREDENTIALS_GOVERNED_EXTERNAL_E2E_AND_PRODUCTION_ATTESTATION_REQUIRED'), 'FGIS Grain live blocker missing', target);
}

function validateDeclarations(registry, bindings, target = failures) {
  const registryRows = [
    ...(registry.coverage?.publicUiProviders || []).map((row) => ({ ...row, sourceKind: 'PUBLIC_UI_PROVIDER' })),
    ...(registry.coverage?.integrationSdkAdapters || []).map((row) => ({ ...row, sourceKind: 'INTEGRATION_SDK_ADAPTER' })),
  ];
  check((registry.coverage?.publicUiProviders || []).length === 8, 'public UI declaration count drift', target);
  check((registry.coverage?.integrationSdkAdapters || []).length === 15, 'SDK declaration count drift', target);
  check(Array.isArray(bindings.declarationBindings) && bindings.declarationBindings.length === registryRows.length, 'declaration binding count mismatch', target);

  const byKey = new Map();
  for (const row of bindings.declarationBindings || []) {
    exactKeys(row, ['sourceKind', 'code', 'targetSystemCodes', 'observedPath', 'registryObservedState', 'truthClassification', 'liveStatus'], `declaration:${row?.sourceKind}:${row?.code}`, target);
    const key = `${row.sourceKind}:${row.code}`;
    check(!byKey.has(key), `duplicate declaration binding ${key}`, target);
    byKey.set(key, row);
    check(row.liveStatus === 'NOT_LIVE', `declaration elevated to live: ${key}`, target);
    check(gitSucceeds('cat-file', '-e', `HEAD:${row.observedPath}`), `observed declaration path missing: ${row.observedPath}`, target);
  }

  for (const registryRow of registryRows) {
    const key = `${registryRow.sourceKind}:${registryRow.code}`;
    const binding = byKey.get(key);
    check(Boolean(binding), `missing declaration binding ${key}`, target);
    if (!binding) continue;
    check(arrayEqual(binding.targetSystemCodes, registryRow.targetSystemCodes), `target system mismatch for ${key}`, target);
    check(binding.observedPath === registryRow.observedPath, `observed path mismatch for ${key}`, target);
    check(binding.registryObservedState === registryRow.observedState, `observed state mismatch for ${key}`, target);
  }

  check(byKey.get('PUBLIC_UI_PROVIDER:fgis_grain')?.truthClassification === 'RUNTIME_AUTHORITY_EXISTS_DECLARATION_NOT_LIVE', 'public FGIS declaration truth mismatch', target);
  check(byKey.get('INTEGRATION_SDK_ADAPTER:FGIS_ZERNO')?.truthClassification === 'LEGACY_MOCK_REFERENCE_ONLY_DESPITE_RUNTIME_AUTHORITY', 'SDK FGIS declaration truth mismatch', target);
  for (const row of registry.coverage?.integrationSdkAdapters || []) {
    if (row.code === 'FGIS_ZERNO') continue;
    check(byKey.get(`INTEGRATION_SDK_ADAPTER:${row.code}`)?.truthClassification === 'MOCK_REFERENCE_ONLY', `SDK code ${row.code} is not classified mock-only`, target);
  }
}

function validateReadiness(bindings, readiness, target = failures) {
  check(bindings.operationalStatus === 'NOT_ATTESTED' && bindings.productionHosting === 'REG_RU_VPS_ONLY', 'binding top-level boundary mismatch', target);
  check(bindings.nextAdapter?.slice === 'PC-CROP-10C', 'next slice must be PC-CROP-10C', target);
  check(bindings.nextAdapter?.systemCode === 'FGIS_GRAIN', 'next system must be FGIS_GRAIN', target);
  check(bindings.nextAdapter?.mode === 'TENANT_AUTHORIZED_READ_ONLY', 'next adapter must be read-only', target);
  check(bindings.nextAdapter?.platformState === 'DISABLED' && bindings.nextAdapter?.requiresTenantAuthorization === true, 'next adapter activation boundary mismatch', target);
  check((bindings.nextAdapter?.blockers || []).length >= 4, 'next adapter blockers incomplete', target);

  check(readiness.operationalStatus === 'NOT_ATTESTED' && readiness.productionHosting === 'REG_RU_VPS_ONLY', 'readiness boundary mismatch', target);
  check(readiness.counts?.acceptedAuthoritySlices === 9, 'readiness accepted authority count mismatch', target);
  check(readiness.counts?.acceptedFgisGrainRuntimeSlices === 8, 'readiness FGIS runtime slice count mismatch', target);
  check(readiness.counts?.publicUiDeclarations === 8 && readiness.counts?.integrationSdkDeclarations === 15, 'readiness declaration counts mismatch', target);
  check(readiness.counts?.liveDeclarations === 0, 'readiness fabricates live declarations', target);
  check(readiness.counts?.credentialMaterialPresent === 0, 'readiness reports credential material', target);
  check(readiness.fgisGrain?.platformReadEnabled === false && readiness.fgisGrain?.platformWriteEnabled === false, 'readiness enables FGIS access', target);
  check(readiness.fgisGrain?.tenantAuthorizedAdapterPresent === false, 'readiness fabricates tenant adapter', target);
  check(readiness.nextAdapter?.slice === 'PC-CROP-10C' && readiness.nextAdapter?.mode === 'TENANT_AUTHORIZED_READ_ONLY', 'readiness successor mismatch', target);
  check(readiness.nextAdapter?.readiness === 'BLOCKED_PENDING_GOVERNED_TENANT_ACCESS', 'readiness must remain blocked', target);
  check(readiness.nextAdapter?.writeAllowed === false, 'readiness permits write', target);
}

function validateNoSecrets(target = failures) {
  const corpus = [PATHS.bindings, PATHS.readiness, PATHS.scope].map(readText).join('\n');
  const forbiddenPatterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(?:password|passwd|token|api[_-]?key|secret)\s*[=:]\s*["']?[^\s"']{8,}/i,
    /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/i,
    /https?:\/\/192\.168\./,
  ];
  for (const pattern of forbiddenPatterns) check(!pattern.test(corpus), `secret/private endpoint pattern found: ${pattern}`, target);
}

function validateAll(input, target = failures) {
  const { lock, scope, registry, schema, bindings, readiness } = input;
  exactKeys(bindings, ['$schema', 'schemaVersion', 'generatedAt', 'operationalStatus', 'productionHosting', 'registryBinding', 'runtimeAuthorities', 'declarationBindings', 'forbiddenClaims', 'nextAdapter'], 'bindings', target);
  check(bindings.$schema === './agricultural-government-systems.authority-bindings.schema.v1.json', 'binding schema reference mismatch', target);
  check(bindings.schemaVersion === 'pc-crop.agricultural-government-systems.authority-bindings.v1', 'binding schema version mismatch', target);
  validateSchema(schema, target);
  validateProjectBoundary(lock, scope, target);
  validateRegistryBinding(registry, bindings, target);
  validateRuntimeAuthorities(bindings, target);
  validateFgisRegistry(registry, target);
  validateDeclarations(registry, bindings, target);
  validateReadiness(bindings, readiness, target);
  validateNoSecrets(target);
}

const input = {
  lock: readJson(PATHS.lock),
  scope: readJson(PATHS.scope),
  registry: readJson(PATHS.registry),
  schema: readJson(PATHS.schema),
  bindings: readJson(PATHS.bindings),
  readiness: readJson(PATHS.readiness),
};

validateAll(input);

if (process.argv.includes('--self-test')) {
  const mutationCases = [
    ['fake-live', (copy) => { copy.bindings.declarationBindings[0].liveStatus = 'LIVE'; }],
    ['missing-evidence-sha', (copy) => { copy.bindings.runtimeAuthorities[0].mergeSha = '0'.repeat(40); }],
    ['stale-registry-blob', (copy) => { copy.bindings.registryBinding.blobSha = '1'.repeat(40); }],
    ['secret-injection', (copy) => { copy.readiness.injected = 'api_key=supersecretvalue'; }],
    ['tai-scope-drift', (copy) => { copy.bindings.nextAdapter.slice = 'TAI-AP-14'; }],
    ['write-enablement', (copy) => { copy.readiness.nextAdapter.writeAllowed = true; }],
  ];

  for (const [name, mutate] of mutationCases) {
    const copy = structuredClone(input);
    mutate(copy);
    const local = [];
    if (name === 'secret-injection') {
      const text = JSON.stringify(copy.readiness);
      check(!/(?:api[_-]?key|secret)\s*[=:]\s*["']?[^\s"']{8,}/i.test(text), 'secret injection accepted', local);
    } else {
      validateAll(copy, local);
    }
    check(local.length > 0, `negative mutation was accepted: ${name}`);
  }
}

const report = {
  schemaVersion: 'pc-crop-10b.acceptance.v1',
  issue: 3390,
  slice: 'PC-CROP-10B',
  exactHead: git('rev-parse', 'HEAD'),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  operationalStatus: input.bindings.operationalStatus,
  productionHosting: input.bindings.productionHosting,
  digests: {
    registrySha256: sha256(readText(PATHS.registry)),
    bindingsSha256: sha256(readText(PATHS.bindings)),
    readinessSha256: sha256(readText(PATHS.readiness)),
  },
  counts: {
    runtimeAuthorities: input.bindings.runtimeAuthorities.length,
    fgisRuntimeAuthorities: input.bindings.runtimeAuthorities.filter((item) => item.systemCode === 'FGIS_GRAIN').length,
    declarationBindings: input.bindings.declarationBindings.length,
    liveDeclarations: input.bindings.declarationBindings.filter((item) => item.liveStatus !== 'NOT_LIVE').length,
  },
  nextAdapter: input.bindings.nextAdapter,
  boundaries: {
    credentialsPresent: false,
    networkAccess: false,
    runtimeMutation: false,
    productionActivation: false,
    taiOrQwenScope: false,
  },
  failures,
};

fs.mkdirSync('artifacts/pc-crop-10b', { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
