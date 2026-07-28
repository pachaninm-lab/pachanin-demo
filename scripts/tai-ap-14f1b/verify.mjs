#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '../..');
const registryPath = resolve(
  root,
  'apps/tai/knowledge-sources/AP-14F1B-SOURCE-ADMISSION.v1.json',
);
const schemaPath = resolve(
  root,
  'apps/tai/knowledge-sources/AP-14F1B-SOURCE-ADMISSION.schema.v1.json',
);
const scopePath = resolve(
  root,
  'docs/platform-v7/autopilot/scopes/tai-ap-14f1b-3355.json',
);

const expectedPaths = [
  '.github/workflows/tai-ap-14f1b.yml',
  'apps/tai/knowledge-sources/AP-14F1B-SOURCE-ADMISSION.schema.v1.json',
  'apps/tai/knowledge-sources/AP-14F1B-SOURCE-ADMISSION.v1.json',
  'docs/platform-v7/autopilot/scopes/tai-ap-14f1b-3355.json',
  'scripts/tai-ap-14f1b/verify.mjs',
].sort();

const expectedBindings = new Map([
  [
    'AP14F0_KNOWLEDGE_AUTHORITY',
    {
      path: 'apps/tai/knowledge-sources/AP-14F0-KNOWLEDGE-AUTHORITY.v1.json',
      blob: '8c0ad9a7c9165d78cfe9a885a01c0f80dc0f0029',
      role: 'RIGHTS_BOUNDARY',
    },
  ],
  [
    'AP14D_OFFICIAL_SOURCE_CATALOG',
    {
      path: 'apps/tai/knowledge-sources/official-sources.v1.json',
      blob: '3d20165c12aefe02cf85c736ff38581d593b914b',
      role: 'SOURCE_CATALOG',
    },
  ],
  [
    'AP14D_SOURCE_AUTHORITY',
    {
      path: 'apps/tai/knowledge-sources/AP-14D-SOURCE-AUTHORITY.v1.json',
      blob: 'e732620aefa8120f81033e9faca2dba53e6fe5a6',
      role: 'SOURCE_SPECIFIC_AUTHORITY',
    },
  ],
  [
    'PC_CROP_10A_GOVERNMENT_SYSTEMS',
    {
      path: 'docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json',
      blob: '0b790f54599302edeaa46e9ea4e64fbc4f3a8442',
      role: 'SYSTEM_AND_LOCATOR_INVENTORY',
    },
  ],
]);

const requiredQuarantineReasons = [
  'CONTENT_SAFETY',
  'DIGEST_MISMATCH',
  'FRESHNESS_EXPIRED',
  'HOST_MISMATCH',
  'MIME_OR_SIZE_POLICY',
  'PARSER_FAILURE',
  'PRIVACY_OR_SECRET',
  'PROVENANCE_INCOMPLETE',
  'RIGHTS_EXPIRED',
  'RIGHTS_UNRESOLVED',
  'TENANT_OR_CONTRACT_DATA',
  'WITHDRAWN_SOURCE',
];

const decisionForClass = new Map([
  ['OFFICIAL_MANUAL', 'AP14F0-OFFICIAL_MANUAL-DEFAULT'],
  ['OFFICIAL_REGULATION', 'AP14F0-OFFICIAL_REGULATION-DEFAULT'],
  ['OPEN_DATASET', 'AP14F0-OPEN_DATASET-DEFAULT'],
  ['PUBLIC_REGISTRY', 'AP14F0-PUBLIC_REGISTRY-DEFAULT'],
]);

function fail(message) {
  throw new Error(`TAI_AP_14F1B:${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function parse(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort((a, b) => a.localeCompare(b, 'en'))
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameSet(actual, expected, context) {
  const left = [...actual].sort((a, b) => a.localeCompare(b, 'en'));
  const right = [...expected].sort((a, b) => a.localeCompare(b, 'en'));
  assert(canonical(left) === canonical(right), `${context} mismatch: ${left.join(', ')}`);
}

function assertUnique(values, context) {
  assert(new Set(values).size === values.length, `${context} must be unique`);
}

function assertDate(value, context) {
  assert(/^\d{4}-\d{2}-\d{2}$/u.test(value), `${context} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  assert(!Number.isNaN(parsed.getTime()), `${context} is invalid`);
  return parsed;
}

function collectSchemaObjects(node, path = '#', results = []) {
  if (node === null || typeof node !== 'object') return results;
  if (!Array.isArray(node) && node.type === 'object') results.push([path, node]);
  if (Array.isArray(node)) {
    node.forEach((entry, index) => collectSchemaObjects(entry, `${path}/${index}`, results));
  } else {
    for (const [key, value] of Object.entries(node)) {
      collectSchemaObjects(value, `${path}/${key}`, results);
    }
  }
  return results;
}

function inventoryLocatorMap(pcRegistry) {
  return new Map(
    pcRegistry.inventoryAuthorities.map((item) => [
      item.inventoryCode,
      {
        uri: item.officialLocator,
        host: new URL(item.officialLocator).hostname,
        coverage: new Set(item.coverageCodes),
      },
    ]),
  );
}

function validateRegistry(candidate, authorities, context = 'registry') {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(`${context}:${message}`);
  };

  check(candidate.schemaVersion === 'tai.ap14f1b-source-admission.v1', 'schemaVersion');
  check(candidate.dependencyCommit === 'fcd0a372fb3a94ba36408479bd1b18f33b16c4e8', 'dependencyCommit');
  check(candidate.operationalStatus === 'NOT_ATTESTED', 'operationalStatus');
  check(candidate.productionHosting === 'REG_RU_VPS_ONLY', 'productionHosting');
  check(candidate.globalPolicy.networkFetchEnabled === false, 'global network fetch must be false');
  check(candidate.globalPolicy.sharedRagEnabled === false, 'global shared RAG must be false');
  check(candidate.globalPolicy.modelWeightsAllowed === false, 'global model weights must be false');
  check(candidate.globalPolicy.credentialsAllowed === false, 'global credentials must be false');
  check(candidate.globalPolicy.protectedCabinetAccessAllowed === false, 'cabinet access must be false');
  sameSet(
    candidate.globalPolicy.quarantineReasons,
    requiredQuarantineReasons,
    `${context} quarantine reasons`,
  );

  const profiles = new Map(candidate.parserProfiles.map((profile) => [profile.code, profile]));
  check(profiles.size === 5, 'parser profile count must be 5');
  for (const profile of profiles.values()) {
    check(profile.executionEnabled === false, `${profile.code} execution must be disabled`);
    check(profile.activeContentAllowed === false, `${profile.code} active content`);
    check(profile.externalRelationshipsAllowed === false, `${profile.code} external relationships`);
    check(profile.nestedArchivesAllowed === false, `${profile.code} nested archives`);
    check(profile.promptInstructionDisposition === 'QUARANTINE', `${profile.code} prompt disposition`);
    check(profile.maximumInputBytes <= 50_000_000, `${profile.code} input bound`);
    check(profile.maximumArchiveEntries <= 500, `${profile.code} archive entries`);
    check(profile.maximumDecompressionRatio <= 50, `${profile.code} decompression ratio`);
  }

  const sources = candidate.sources;
  check(sources.length === 10, 'source count must be 10');
  assertUnique(sources.map((item) => item.sourceId), `${context} source ids`);
  assertUnique(sources.map((item) => item.familyCode), `${context} family codes`);

  for (const source of sources) {
    const prefix = `${source.sourceId}`;
    let uri;
    try {
      uri = new URL(source.transport.officialUri);
    } catch {
      check(false, `${prefix} invalid URI`);
      continue;
    }
    check(uri.protocol === 'https:', `${prefix} must use HTTPS`);
    check(uri.username === '' && uri.password === '', `${prefix} credentials in URI`);
    check(uri.hash === '', `${prefix} fragment forbidden`);
    check(uri.hostname === source.transport.hostPin, `${prefix} host pin mismatch`);
    check(source.transport.allowedHosts.includes(uri.hostname), `${prefix} host not allowed`);
    check(
      source.transport.pathPrefixes.some((entry) => uri.pathname.startsWith(entry)),
      `${prefix} path outside scope`,
    );
    check(source.transport.httpsOnly === true, `${prefix} HTTPS control`);
    check(source.transport.publicDnsOnly === true, `${prefix} public DNS control`);
    check(source.transport.credentialsAllowed === false, `${prefix} credentials control`);
    check(source.transport.cookiesAllowed === false, `${prefix} cookie control`);
    check(source.transport.sameHostRedirectRequired === true, `${prefix} redirect host control`);
    check(source.transport.maximumRedirects <= 3, `${prefix} redirect bound`);

    check(source.dataPlane === 'PUBLIC_OFFICIAL', `${prefix} data plane`);
    check(decisionForClass.get(source.sourceClass) === source.rights.decisionRef, `${prefix} rights decision`);
    const f0Decision = authorities.f0Decisions.get(source.rights.decisionRef);
    check(Boolean(f0Decision), `${prefix} unknown AP-14F0 decision`);
    if (f0Decision) {
      check(f0Decision.sourceClassCode === source.sourceClass, `${prefix} AP-14F0 class mismatch`);
      check(f0Decision.sharedIndexAllowed === false, `${prefix} inherited shared index must be false`);
      check(f0Decision.modelWeightsAllowed === false, `${prefix} inherited model weights must be false`);
    }

    check(
      ['METADATA_ONLY', 'RIGHTS_UNRESOLVED'].includes(source.rights.disposition),
      `${prefix} disposition cannot enable corpus use`,
    );
    check(source.rights.sourceSpecificEvidence.length > 0, `${prefix} rights evidence missing`);
    check(source.rights.bulkCollectionAllowed === false, `${prefix} bulk collection`);
    check(source.rights.redistributionAllowed === false, `${prefix} redistribution`);
    check(source.rights.sharedIndexAllowed === false, `${prefix} shared index`);
    check(source.rights.modelWeightsAllowed === false, `${prefix} model weights`);

    for (const field of [
      'enabled',
      'sourceFetchEnabled',
      'parserExecutionEnabled',
      'sharedRagAllowed',
      'modelWeightsAllowed',
    ]) {
      check(source.admission[field] === false, `${prefix} admission ${field}`);
    }

    const sourceProfiles = source.parserProfileCodes.map((code) => profiles.get(code));
    check(sourceProfiles.every(Boolean), `${prefix} unknown parser profile`);
    const profileMedia = new Set(
      sourceProfiles.filter(Boolean).flatMap((profile) => profile.mediaTypes),
    );
    check(
      source.contentPolicy.allowedMediaTypes.every((media) => profileMedia.has(media)),
      `${prefix} media not covered by parser profile`,
    );
    check(
      source.contentPolicy.maximumBytes <= Math.max(...sourceProfiles.filter(Boolean).map((p) => p.maximumInputBytes)),
      `${prefix} byte limit exceeds parser profile`,
    );
    check(source.contentPolicy.maximumArchiveEntries <= 500, `${prefix} archive entries`);
    check(source.contentPolicy.maximumDecompressionRatio <= 50, `${prefix} decompression ratio`);
    check(source.contentPolicy.nestedArchivesAllowed === false, `${prefix} nested archives`);
    check(source.contentPolicy.personalDataAllowed === false, `${prefix} personal data`);
    check(source.contentPolicy.credentialMaterialAllowed === false, `${prefix} credential material`);
    check(source.contentPolicy.cabinetMaterialAllowed === false, `${prefix} cabinet material`);
    check(source.contentPolicy.tenantOrContractDataAllowed === false, `${prefix} cross-plane material`);

    const reviewed = assertDate(source.freshness.rightsReviewedAt, `${prefix} rightsReviewedAt`);
    const due = assertDate(source.freshness.rightsReviewDueAt, `${prefix} rightsReviewDueAt`);
    check(due > reviewed, `${prefix} rights review due must follow review`);
    check(source.freshness.availabilityAlarmAfterFailures <= 5, `${prefix} availability alarm bound`);

    for (const value of Object.values(source.quarantine)) {
      check(value === 'QUARANTINE', `${prefix} quarantine must fail closed`);
    }

    for (const evidenceRef of source.evidenceRefs) {
      const [kind, id] = evidenceRef.split(':');
      if (kind === 'AP14D_CATALOG') {
        const entry = authorities.catalogSources.get(id);
        check(Boolean(entry), `${prefix} missing AP14D catalog ref ${id}`);
        if (entry) {
          check(entry.entrypoint_uri === source.transport.officialUri, `${prefix} AP14D URI drift`);
          check(entry.allowed_hosts.includes(source.transport.hostPin), `${prefix} AP14D host drift`);
        }
      } else if (kind === 'AP14D_AUTHORITY') {
        const entry = authorities.ap14dDecisions.get(id);
        check(Boolean(entry), `${prefix} missing AP14D authority ref ${id}`);
        if (entry) {
          check(entry.official_uri === source.transport.officialUri, `${prefix} authority URI drift`);
        }
      } else if (kind === 'PC_CROP_10A') {
        const entry = authorities.inventoryLocators.get(id);
        check(Boolean(entry), `${prefix} missing PC-CROP inventory ref ${id}`);
        if (entry) {
          const exactUri = entry.uri === source.transport.officialUri;
          const coveredSystem = source.systemCodes.some((code) => entry.coverage.has(code));
          check(exactUri || coveredSystem, `${prefix} inventory evidence does not bind URI or system`);
        }
      } else {
        check(false, `${prefix} unsupported evidence ref ${evidenceRef}`);
      }
    }

    for (const code of source.systemCodes) {
      check(authorities.systemCodes.has(code), `${prefix} unknown system code ${code}`);
    }
  }

  check(
    sources.filter((source) => source.rights.disposition === 'ALLOWED_SHARED_RAG').length === 0,
    'allowed shared RAG count must be zero',
  );
  return errors;
}

const schema = parse(schemaPath, 'AP-14F1B schema');
const registry = parse(registryPath, 'AP-14F1B registry');
const scope = parse(scopePath, 'AP-14F1B scope');

assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema draft');
assert(schema.additionalProperties === false, 'schema root must be closed');
for (const [path, node] of collectSchemaObjects(schema)) {
  assert(node.additionalProperties === false, `${path} object schema must be closed`);
}

assert(scope.issue === 3355, 'scope issue');
assert(scope.baseCommit === 'fcd0a372fb3a94ba36408479bd1b18f33b16c4e8', 'scope base');
assert(scope.operationalStatus === 'NOT_ATTESTED', 'scope status');
sameSet(scope.allowedPaths, expectedPaths, 'scope paths');

assert(registry.authorityBindings.length === 4, 'authority binding count');
assertUnique(registry.authorityBindings.map((entry) => entry.code), 'authority binding codes');
for (const binding of registry.authorityBindings) {
  const expected = expectedBindings.get(binding.code);
  assert(Boolean(expected), `unexpected authority binding ${binding.code}`);
  assert(binding.path === expected.path, `${binding.code} path drift`);
  assert(binding.gitBlobSha1 === expected.blob, `${binding.code} declared blob drift`);
  assert(binding.role === expected.role, `${binding.code} role drift`);
  assert(git('hash-object', binding.path) === binding.gitBlobSha1, `${binding.code} live blob mismatch`);
}

const bound = Object.fromEntries(
  registry.authorityBindings.map((binding) => [binding.code, parse(resolve(root, binding.path), binding.code)]),
);
const f0Decisions = new Map(
  bound.AP14F0_KNOWLEDGE_AUTHORITY.reuseDecisions.map((entry) => [entry.decisionId, entry]),
);
const catalogSources = new Map(
  bound.AP14D_OFFICIAL_SOURCE_CATALOG.sources.map((entry) => [entry.source_id, entry]),
);
const ap14dDecisions = new Map(
  bound.AP14D_SOURCE_AUTHORITY.decisions.map((entry) => [entry.source_id, entry]),
);
const pcRegistry = bound.PC_CROP_10A_GOVERNMENT_SYSTEMS;
const authorities = {
  f0Decisions,
  catalogSources,
  ap14dDecisions,
  inventoryLocators: inventoryLocatorMap(pcRegistry),
  systemCodes: new Set(pcRegistry.systems.map((entry) => entry.systemCode)),
};

const validationErrors = validateRegistry(registry, authorities);
assert(validationErrors.length === 0, validationErrors.join('\n'));

const probes = [
  ['shared_rag_enabled', (item) => { item.sources[0].admission.sharedRagAllowed = true; }],
  ['fetch_enabled', (item) => { item.sources[0].admission.sourceFetchEnabled = true; }],
  ['host_mismatch', (item) => { item.sources[0].transport.hostPin = 'evil.example'; }],
  ['http_downgrade', (item) => { item.sources[0].transport.officialUri = 'http://specagro.ru/fgis/ok'; }],
  ['parser_execution', (item) => { item.parserProfiles[0].executionEnabled = true; }],
  ['rights_promotion', (item) => { item.sources[0].rights.disposition = 'ALLOWED_SHARED_RAG'; }],
  ['evidence_removed', (item) => { item.sources[0].evidenceRefs = []; }],
  ['review_expired', (item) => { item.sources[0].freshness.rightsReviewDueAt = '2026-07-27'; }],
  ['unsupported_mime', (item) => { item.sources[0].contentPolicy.allowedMediaTypes.push('application/pdf'); }],
  ['oversized_payload', (item) => { item.sources[0].contentPolicy.maximumBytes = 50000001; }],
];

for (const [name, mutate] of probes) {
  const candidate = deepClone(registry);
  mutate(candidate);
  const errors = validateRegistry(candidate, authorities, `probe:${name}`);
  assert(errors.length > 0, `negative mutation ${name} did not fail closed`);
}

let changedPaths = [];
const scopeIndex = process.argv.indexOf('--scope-guard');
if (scopeIndex !== -1) {
  const base = process.argv[scopeIndex + 1];
  assert(base, '--scope-guard requires a base ref');
  git('merge-base', '--is-ancestor', base, 'HEAD');
  changedPaths = git('diff', '--name-only', `${base}...HEAD`)
    .split('\n')
    .filter(Boolean)
    .sort();
  sameSet(changedPaths, expectedPaths, 'changed paths');
}

const dispositions = registry.sources.reduce((counts, source) => {
  counts[source.rights.disposition] = (counts[source.rights.disposition] ?? 0) + 1;
  return counts;
}, {});

process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  slice: 'TAI-AP-14F1B',
  issue: 3355,
  operationalStatus: 'NOT_ATTESTED',
  productionHosting: 'REG_RU_VPS_ONLY',
  counts: {
    changedPaths: changedPaths.length,
    authorityBindings: registry.authorityBindings.length,
    parserProfiles: registry.parserProfiles.length,
    candidateSources: registry.sources.length,
    metadataOnly: dispositions.METADATA_ONLY ?? 0,
    rightsUnresolved: dispositions.RIGHTS_UNRESOLVED ?? 0,
    allowedSharedRag: dispositions.ALLOWED_SHARED_RAG ?? 0,
    quarantineReasons: registry.globalPolicy.quarantineReasons.length,
    negativeMutationProbes: probes.length,
  },
  boundaries: {
    networkFetch: false,
    corpusBytes: false,
    parserExecution: false,
    embeddingsOrVectorMutation: false,
    tenantLiveOrContractedAccess: false,
    credentials: false,
    modelWeights: false,
    runtimeActivation: false,
    productionDeployment: false,
  },
}, null, 2)}\n`);
