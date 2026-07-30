#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const ISSUE = 3504;
const TENANT_READ_MERGE_SHA = '0402b22e80641b5b696e23127e0d5dad3126417a';
const PATHS = {
  lock: 'docs/platform-v7/autopilot/project-locks/pc-crop-remainder.json',
  scope: 'docs/platform-v7/autopilot/scopes/pc-crop-10d-final-truth.json',
  registry: 'docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json',
  bindings: 'docs/platform-v7/crop-platform/agricultural-government-systems.authority-bindings.v1.json',
  schema: 'docs/platform-v7/crop-platform/agricultural-government-systems.final-truth.schema.v1.json',
  truth: 'docs/platform-v7/crop-platform/agricultural-government-systems.final-truth.v1.json',
  readiness: 'docs/platform-v7/crop-platform/agricultural-government-systems.readiness.v2.json',
  verifier: 'scripts/pc-crop-10d/verify.mjs',
  workflow: '.github/workflows/pc-crop-10d.yml',
};
const OUTPUT = 'artifacts/pc-crop-10d/acceptance.json';
const EXPECTED_SLICES = [
  'PC-CROP-08A',
  'PC-CROP-08B',
  'PC-CROP-08C',
  'PC-CROP-08D',
  'PC-CROP-08E',
  'PC-CROP-08F',
  'PC-CROP-08H',
  'PC-CROP-08I',
  'PC-CROP-10A',
  'PC-CROP-10C',
];
const EXPECTED_V1_SLICES = EXPECTED_SLICES.slice(0, 9);
const EXPECTED_PATH_BINDINGS = new Map([
  [
    'apps/api/prisma/migrations/20260730101500_fgis_grain_tenant_read_authority/migration.sql',
    '82bce49e0ce3b0869e2fac175d50f46741599c36',
  ],
  [
    'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository.ts',
    'f163496ee68230a94d78d930938a27aa98f16285',
  ],
  [
    'docs/platform-v7/autopilot/scopes/pc-crop-10c.json',
    '272982af037c0667a9e1f111783ead998d858849',
  ],
]);
const failures = [];

function text(path) {
  return fs.readFileSync(path, 'utf8');
}

function json(path) {
  try {
    return JSON.parse(text(path));
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
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitSucceeds(...args) {
  try {
    execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateLockAndScope(lock, scope, target = failures) {
  check(lock.schemaVersion === 'platform-v7.active-project-lock.v1', 'project lock schema mismatch', target);
  check(lock.id === 'PC-CROP-REMAINDER' && lock.status === 'active', 'active project lock missing', target);
  check(lock.activeIssue === ISSUE && lock.activeSlice === 'PC-CROP-10D', 'project lock does not point to PC-CROP-10D', target);
  check(same(lock.sequence, ['PC-CROP-10D']), 'project lock terminal sequence mismatch', target);
  check(lock.operationalStatus === 'NOT_ATTESTED', 'project lock status elevated', target);
  check(lock.productionHosting === 'REG_RU_VPS_ONLY', 'project lock hosting authority changed', target);

  check(scope.id === `PC-CROP-10D-FINAL-TRUTH-${ISSUE}`, 'scope id mismatch', target);
  check(scope.branch === 'agent/pc-crop-10d-final-truth', 'scope branch mismatch', target);
  check(scope.projectLockId === lock.id, 'scope project-lock binding mismatch', target);
  check(scope.issue === ISSUE && scope.activeSlice === lock.activeSlice, 'scope issue/slice mismatch', target);
  check(scope.operationalStatus === 'NOT_ATTESTED', 'scope status elevated', target);
  check(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope hosting authority changed', target);
  check(scope.boundaries && Object.values(scope.boundaries).every((value) => value === false), 'scope weakens a boundary', target);

  const required = [PATHS.workflow, PATHS.scope, PATHS.schema, PATHS.truth, PATHS.readiness, PATHS.verifier];
  check(same(scope.allowedPaths, required), 'scope allowed-path set or order mismatch', target);
  check(!(scope.allowedPaths || []).some((path) => path.includes('**')), 'scope contains a wildcard', target);

  const baseRef = process.env.BASE_REF;
  if (baseRef) {
    const changed = git('diff', '--name-only', `${baseRef}...HEAD`).split('\n').filter(Boolean).sort();
    check(same(changed, [...required].sort()), `changed path set mismatch: ${changed.join(',')}`, target);
  }
}

function validateSchema(schema, target = failures) {
  check(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'final-truth schema draft mismatch', target);
  check(schema.type === 'object' && schema.additionalProperties === false, 'final-truth schema must be closed', target);
  check(schema.properties?.operationalStatus?.const === 'NOT_ATTESTED', 'schema status boundary weakened', target);
  check(schema.properties?.productionHosting?.const === 'REG_RU_VPS_ONLY', 'schema hosting authority weakened', target);
  check(schema.properties?.acceptedAuthoritySlices?.minItems === 10, 'schema accepted-slice minimum mismatch', target);
  check(schema.properties?.acceptedAuthoritySlices?.maxItems === 10, 'schema accepted-slice maximum mismatch', target);
  check(schema.properties?.repositoryCompletion?.properties?.internalRepositoryRemainderComplete?.const === true, 'schema internal completion fact missing', target);
  check(schema.properties?.repositoryCompletion?.properties?.liveCompletionClaimed?.const === false, 'schema permits a live completion claim', target);
  check(schema.properties?.externalIndustrialReadiness?.properties?.industrialLiveReady?.const === false, 'schema permits industrial live readiness', target);
  check(schema.properties?.externalIndustrialReadiness?.properties?.implementationAuthorized?.const === false, 'schema authorizes external implementation', target);
  check(schema.$defs?.terminalAuthority?.additionalProperties === false, 'terminal authority schema is open', target);
  check(schema.$defs?.terminalAuthority?.properties?.pr?.const === 3454, 'terminal authority PR binding missing', target);
}

function validateImmutableAuthority(binding, expected, label, target = failures) {
  exactKeys(binding, ['path', 'mergeSha', 'blobSha'], label, target);
  check(binding.path === expected.path, `${label} path mismatch`, target);
  check(binding.mergeSha === expected.mergeSha, `${label} merge SHA mismatch`, target);
  check(binding.blobSha === expected.blobSha, `${label} blob SHA mismatch`, target);
  check(gitSucceeds('merge-base', '--is-ancestor', binding.mergeSha, 'HEAD'), `${label} merge is outside exact-head ancestry`, target);
  if (gitSucceeds('cat-file', '-e', `${binding.mergeSha}:${binding.path}`)) {
    check(git('rev-parse', `${binding.mergeSha}:${binding.path}`) === binding.blobSha, `${label} accepted blob drift`, target);
  } else {
    target.push(`${label} accepted path is unavailable`);
  }
  check(git('rev-parse', `HEAD:${binding.path}`) === binding.blobSha, `${label} current blob drift`, target);
}

function validateV1Authorities(bindings, target = failures) {
  check(bindings.schemaVersion === 'pc-crop.agricultural-government-systems.authority-bindings.v1', 'v1 bindings schema mismatch', target);
  check(bindings.operationalStatus === 'NOT_ATTESTED', 'v1 bindings status elevated', target);
  check(bindings.productionHosting === 'REG_RU_VPS_ONLY', 'v1 bindings hosting authority changed', target);
  check((bindings.runtimeAuthorities || []).length === 9, 'v1 runtime authority count drift', target);
  check(
    same((bindings.runtimeAuthorities || []).map((item) => item.slice), EXPECTED_V1_SLICES),
    'v1 runtime authority slice order drift',
    target,
  );
  check(
    (bindings.runtimeAuthorities || []).every((item) => item.liveEvidence === 'ABSENT'),
    'v1 runtime authority fabricated live evidence',
    target,
  );
  check(
    (bindings.declarationBindings || []).length === 23
      && bindings.declarationBindings.every((item) => item.liveStatus === 'NOT_LIVE'),
    'v1 declaration truth drift',
    target,
  );
}

function validateTerminalAuthority(authority, target = failures) {
  exactKeys(
    authority,
    ['slice', 'pr', 'mergeSha', 'exactMainStatusContext', 'pathBindings', 'operationalStatus', 'externalLiveEvidence'],
    'terminalAuthority',
    target,
  );
  check(authority.slice === 'PC-CROP-10C' && authority.pr === 3454, 'terminal authority identity mismatch', target);
  check(authority.mergeSha === TENANT_READ_MERGE_SHA, 'terminal authority merge SHA mismatch', target);
  check(authority.exactMainStatusContext === 'PC-CROP-10C exact-main', 'terminal exact-main status context mismatch', target);
  check(authority.operationalStatus === 'NOT_ATTESTED' && authority.externalLiveEvidence === 'ABSENT', 'terminal authority fabricates live evidence', target);
  check(gitSucceeds('merge-base', '--is-ancestor', authority.mergeSha, 'HEAD'), 'PC-CROP-10C merge is outside exact-head ancestry', target);

  check((authority.pathBindings || []).length === EXPECTED_PATH_BINDINGS.size, 'terminal path binding count mismatch', target);
  const seen = new Set();
  for (const binding of authority.pathBindings || []) {
    exactKeys(binding, ['path', 'blobSha'], `terminalPath:${binding?.path}`, target);
    check(EXPECTED_PATH_BINDINGS.get(binding.path) === binding.blobSha, `terminal path blob declaration mismatch: ${binding.path}`, target);
    check(!seen.has(binding.path), `duplicate terminal path binding: ${binding.path}`, target);
    seen.add(binding.path);
    if (gitSucceeds('cat-file', '-e', `${authority.mergeSha}:${binding.path}`)) {
      check(git('rev-parse', `${authority.mergeSha}:${binding.path}`) === binding.blobSha, `terminal accepted blob drift: ${binding.path}`, target);
    } else {
      target.push(`terminal accepted path unavailable: ${binding.path}`);
    }
    check(git('rev-parse', `HEAD:${binding.path}`) === binding.blobSha, `terminal current blob drift: ${binding.path}`, target);
  }
}

function validateTruth(truth, target = failures) {
  exactKeys(
    truth,
    [
      '$schema',
      'schemaVersion',
      'generatedAt',
      'projectLockId',
      'sourceTechnicalSpecification',
      'operationalStatus',
      'productionHosting',
      'immutableAuthorities',
      'acceptedAuthoritySlices',
      'terminalAuthority',
      'repositoryCompletion',
      'fgisGrain',
      'externalIndustrialReadiness',
      'forbiddenConclusions',
    ],
    'finalTruth',
    target,
  );
  check(truth.$schema === './agricultural-government-systems.final-truth.schema.v1.json', 'final-truth schema reference mismatch', target);
  check(truth.schemaVersion === 'pc-crop.agricultural-government-systems.final-truth.v1', 'final-truth version mismatch', target);
  check(truth.projectLockId === 'PC-CROP-REMAINDER', 'final-truth project lock mismatch', target);
  check(truth.sourceTechnicalSpecification === 'Остаток_ТЗ_Прозрачная_Цена_растениеводство', 'final-truth source mismatch', target);
  check(truth.operationalStatus === 'NOT_ATTESTED', 'final-truth status elevated', target);
  check(truth.productionHosting === 'REG_RU_VPS_ONLY', 'final-truth hosting authority changed', target);
  check(same(truth.acceptedAuthoritySlices, EXPECTED_SLICES), 'accepted authority slices mismatch', target);

  validateImmutableAuthority(
    truth.immutableAuthorities?.registryV1,
    {
      path: PATHS.registry,
      mergeSha: '0446f477e418e6dcbd97faa627b1ef7b57b4fa4e',
      blobSha: '0b790f54599302edeaa46e9ea4e64fbc4f3a8442',
    },
    'registryV1',
    target,
  );
  validateImmutableAuthority(
    truth.immutableAuthorities?.authorityBindingsV1,
    {
      path: PATHS.bindings,
      mergeSha: 'd1be70ecf8f5ba10792cf6d671d1c9504f4b0422',
      blobSha: '601e8193e90f6af16e23e7e5cbf7df93d7a5148b',
    },
    'authorityBindingsV1',
    target,
  );
  validateTerminalAuthority(truth.terminalAuthority, target);

  exactKeys(
    truth.repositoryCompletion,
    ['completionSlice', 'internalRepositoryRemainderComplete', 'implementationSequenceClosed', 'liveCompletionClaimed'],
    'repositoryCompletion',
    target,
  );
  check(truth.repositoryCompletion?.completionSlice === 'PC-CROP-10D', 'completion slice mismatch', target);
  check(truth.repositoryCompletion?.internalRepositoryRemainderComplete === true, 'internal repository completion missing', target);
  check(truth.repositoryCompletion?.implementationSequenceClosed === true, 'implementation sequence remains open', target);
  check(truth.repositoryCompletion?.liveCompletionClaimed === false, 'live completion fabricated', target);

  const grain = truth.fgisGrain || {};
  check(grain.systemCode === 'FGIS_GRAIN' && grain.apiContractVersion === '1.0.23', 'FGIS Grain contract binding mismatch', target);
  check(grain.acceptedRuntimeAuthorities === 9, 'FGIS Grain accepted authority count mismatch', target);
  check(grain.tenantAuthorizedReadAuthority === 'ACCEPTED_DISABLED_BY_DEFAULT', 'tenant-read authority state mismatch', target);
  check(grain.allowedReadOperations === 19 && grain.rejectedMutationOperations === 38, 'operation classification count mismatch', target);
  check(grain.platformReadEnabled === false && grain.platformWriteEnabled === false, 'FGIS Grain access enabled without evidence', target);
  check(grain.externalProviderE2E === 'ABSENT' && grain.productionAttestation === 'ABSENT', 'external evidence fabricated', target);

  const external = truth.externalIndustrialReadiness || {};
  check(external.industrialLiveReady === false, 'industrial live readiness fabricated', target);
  check(external.assessment === 'NOT_ASSESSED', 'external assessment fabricated', target);
  check(external.implementationAuthorized === false, 'external implementation authorized', target);
  check((external.blockers || []).length >= 5, 'external blockers incomplete', target);
  check((truth.forbiddenConclusions || []).includes('INTERNAL_REPOSITORY_COMPLETION_MEANS_LIVE'), 'internal/live truth separation missing', target);
}

function validateReadiness(readiness, target = failures) {
  exactKeys(
    readiness,
    [
      'schemaVersion',
      'generatedAt',
      'sourceFinalTruth',
      'operationalStatus',
      'productionHosting',
      'internalRepositoryRemainderComplete',
      'industrialLiveReady',
      'counts',
      'fgisGrain',
      'declarationTruth',
      'externalAssessment',
      'forbiddenConclusions',
    ],
    'readinessV2',
    target,
  );
  check(readiness.schemaVersion === 'pc-crop.agricultural-government-systems.readiness.v2', 'readiness v2 schema mismatch', target);
  check(readiness.sourceFinalTruth === './agricultural-government-systems.final-truth.v1.json', 'readiness final-truth binding mismatch', target);
  check(readiness.operationalStatus === 'NOT_ATTESTED' && readiness.productionHosting === 'REG_RU_VPS_ONLY', 'readiness boundary mismatch', target);
  check(readiness.internalRepositoryRemainderComplete === true, 'readiness omits internal completion', target);
  check(readiness.industrialLiveReady === false, 'readiness fabricates industrial live completion', target);
  check(readiness.counts?.acceptedAuthoritySlices === 10, 'readiness accepted slice count mismatch', target);
  check(readiness.counts?.acceptedFgisGrainRuntimeSlices === 9, 'readiness FGIS runtime count mismatch', target);
  check(readiness.counts?.publicUiDeclarations === 8 && readiness.counts?.integrationSdkDeclarations === 15, 'readiness declaration count mismatch', target);
  check(readiness.counts?.liveDeclarations === 0, 'readiness fabricates a live declaration', target);
  check(readiness.counts?.credentialReferencesPresent === 0 && readiness.counts?.credentialMaterialPresent === 0, 'readiness fabricates credential evidence', target);
  check(readiness.fgisGrain?.tenantAuthorizedAdapterPresent === true, 'readiness omits accepted tenant adapter', target);
  check(readiness.fgisGrain?.tenantAuthorizedAdapterState === 'ACCEPTED_DISABLED_BY_DEFAULT', 'readiness adapter state mismatch', target);
  check(readiness.fgisGrain?.platformReadEnabled === false && readiness.fgisGrain?.platformWriteEnabled === false, 'readiness enables FGIS access', target);
  check(readiness.fgisGrain?.externalProviderE2E === 'ABSENT' && readiness.fgisGrain?.productionAttestation === 'ABSENT', 'readiness fabricates external evidence', target);
  check(readiness.externalAssessment?.assessment === 'NOT_ASSESSED', 'readiness fabricates external assessment', target);
  check(readiness.externalAssessment?.implementationAuthorized === false, 'readiness authorizes external implementation', target);
  check(readiness.externalAssessment?.liveStatus === 'NOT_LIVE', 'readiness elevates external live status', target);
}

function validateNoSecrets(scope, truth, readiness, target = failures) {
  const corpus = JSON.stringify({ scope, truth, readiness });
  const forbidden = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(?:password|passwd|token|api[_-]?key|secret)\s*[=:]\s*["']?[^\s"']{8,}/i,
    /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/i,
    /https?:\/\/(?:localhost|127\.0\.0\.1|10\.|192\.168\.)/i,
  ];
  for (const pattern of forbidden) check(!pattern.test(corpus), `secret/private endpoint pattern found: ${pattern}`, target);
}

function validateAll(input, target = failures) {
  validateLockAndScope(input.lock, input.scope, target);
  validateSchema(input.schema, target);
  validateV1Authorities(input.bindings, target);
  validateTruth(input.truth, target);
  validateReadiness(input.readiness, target);
  validateNoSecrets(input.scope, input.truth, input.readiness, target);
}

const input = {
  lock: json(PATHS.lock),
  scope: json(PATHS.scope),
  bindings: json(PATHS.bindings),
  schema: json(PATHS.schema),
  truth: json(PATHS.truth),
  readiness: json(PATHS.readiness),
};

validateAll(input);

if (process.argv.includes('--self-test')) {
  const mutations = [
    ['fake-live', (copy) => { copy.truth.externalIndustrialReadiness.industrialLiveReady = true; }],
    ['missing-10c', (copy) => { copy.truth.acceptedAuthoritySlices.pop(); }],
    ['registry-drift', (copy) => { copy.truth.immutableAuthorities.registryV1.blobSha = '1'.repeat(40); }],
    ['write-enable', (copy) => { copy.readiness.fgisGrain.platformWriteEnabled = true; }],
    ['external-authorization', (copy) => { copy.readiness.externalAssessment.implementationAuthorized = true; }],
  ];
  for (const [name, mutate] of mutations) {
    const copy = structuredClone(input);
    mutate(copy);
    const local = [];
    validateAll(copy, local);
    check(local.length > 0, `negative mutation accepted: ${name}`);
  }

  const injected = structuredClone(input);
  injected.readiness.injected = 'api_key=supersecretvalue';
  const local = [];
  validateNoSecrets(injected.scope, injected.truth, injected.readiness, local);
  check(local.length > 0, 'secret injection accepted');
}

const report = {
  schemaVersion: 'pc-crop-10d.acceptance.v1',
  issue: ISSUE,
  slice: 'PC-CROP-10D',
  exactHead: git('rev-parse', 'HEAD'),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  projectLockId: input.lock.id,
  operationalStatus: input.truth.operationalStatus,
  productionHosting: input.truth.productionHosting,
  internalRepositoryRemainderComplete:
    input.truth.repositoryCompletion.internalRepositoryRemainderComplete,
  industrialLiveReady:
    input.truth.externalIndustrialReadiness.industrialLiveReady,
  counts: {
    acceptedAuthoritySlices: input.truth.acceptedAuthoritySlices.length,
    acceptedFgisGrainRuntimeSlices: input.truth.fgisGrain.acceptedRuntimeAuthorities,
    liveDeclarations: input.readiness.counts.liveDeclarations,
    externalProviderE2E: input.truth.fgisGrain.externalProviderE2E,
  },
  digests: {
    finalTruthSha256: sha256(text(PATHS.truth)),
    readinessV2Sha256: sha256(text(PATHS.readiness)),
  },
  boundaries: {
    credentialsPresent: false,
    networkAccess: false,
    runtimeMutation: false,
    productionActivation: false,
    externalImplementationAuthorization: false,
    taiOrQwenScope: false,
  },
  failures,
};

fs.mkdirSync('artifacts/pc-crop-10d', { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
