#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const registryPath = resolve(root, 'apps/tai/knowledge-sources/AP-14F1B-SOURCE-ADMISSION.v1.json');
const schemaPath = resolve(root, 'apps/tai/knowledge-sources/AP-14F1B-SOURCE-ADMISSION.schema.v1.json');
const scopePath = resolve(root, 'docs/platform-v7/autopilot/scopes/tai-ap-14f1b-3355.json');
const dependencyCommit = 'fcd0a372fb3a94ba36408479bd1b18f33b16c4e8';

const expectedPaths = [
  '.github/workflows/tai-ap-14f1b.yml',
  'apps/tai/knowledge-sources/AP-14F1B-SOURCE-ADMISSION.schema.v1.json',
  'apps/tai/knowledge-sources/AP-14F1B-SOURCE-ADMISSION.v1.json',
  'docs/platform-v7/autopilot/scopes/tai-ap-14f1b-3355.json',
  'scripts/tai-ap-14f1b/verify.mjs',
].sort();

const expectedBindings = new Map([
  ['AP14F0_KNOWLEDGE_AUTHORITY', {
    path: 'apps/tai/knowledge-sources/AP-14F0-KNOWLEDGE-AUTHORITY.v1.json',
    blob: '8c0ad9a7c9165d78cfe9a885a01c0f80dc0f0029',
    role: 'RIGHTS_BOUNDARY',
  }],
  ['AP14D_OFFICIAL_SOURCE_CATALOG', {
    path: 'apps/tai/knowledge-sources/official-sources.v1.json',
    blob: '3d20165c12aefe02cf85c736ff38581d593b914b',
    role: 'SOURCE_CATALOG',
  }],
  ['AP14D_SOURCE_AUTHORITY', {
    path: 'apps/tai/knowledge-sources/AP-14D-SOURCE-AUTHORITY.v1.json',
    blob: 'e732620aefa8120f81033e9faca2dba53e6fe5a6',
    role: 'SOURCE_SPECIFIC_AUTHORITY',
  }],
  ['PC_CROP_10A_GOVERNMENT_SYSTEMS', {
    path: 'docs/platform-v7/crop-platform/agricultural-government-systems.registry.v1.json',
    blob: '0b790f54599302edeaa46e9ea4e64fbc4f3a8442',
    role: 'SYSTEM_AND_LOCATOR_INVENTORY',
  }],
]);

const decisionForClass = new Map([
  ['OFFICIAL_MANUAL', 'AP14F0-OFFICIAL_MANUAL-DEFAULT'],
  ['OFFICIAL_REGULATION', 'AP14F0-OFFICIAL_REGULATION-DEFAULT'],
  ['OPEN_DATASET', 'AP14F0-OPEN_DATASET-DEFAULT'],
  ['PUBLIC_REGISTRY', 'AP14F0-PUBLIC_REGISTRY-DEFAULT'],
]);

const quarantineReasons = new Set([
  'RIGHTS_UNRESOLVED', 'RIGHTS_EXPIRED', 'PROVENANCE_INCOMPLETE',
  'HOST_MISMATCH', 'DIGEST_MISMATCH', 'FRESHNESS_EXPIRED',
  'PRIVACY_OR_SECRET', 'TENANT_OR_CONTRACT_DATA', 'MIME_OR_SIZE_POLICY',
  'CONTENT_SAFETY', 'PARSER_FAILURE', 'WITHDRAWN_SOURCE',
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
    fail(`${label} invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return new Set(values).size === values.length;
}

function setEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function closedObjectSchemas(node, path = '#', errors = []) {
  if (node === null || typeof node !== 'object') return errors;
  if (!Array.isArray(node) && node.type === 'object' && node.additionalProperties !== false) {
    errors.push(`${path} object schema is not closed`);
  }
  if (Array.isArray(node)) {
    node.forEach((entry, index) => closedObjectSchemas(entry, `${path}/${index}`, errors));
  } else {
    Object.entries(node).forEach(([key, value]) => closedObjectSchemas(value, `${path}/${key}`, errors));
  }
  return errors;
}

function inventoryMap(registry) {
  return new Map(registry.inventoryAuthorities.map((entry) => [entry.inventoryCode, {
    uri: entry.officialLocator,
    coverage: new Set(entry.coverageCodes),
  }]));
}

function validate(candidate, authority, context = 'registry') {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(`${context}:${message}`);
  };

  check(candidate.schemaVersion === 'tai.ap14f1b-source-admission.v1', 'schema version');
  check(candidate.dependencyCommit === dependencyCommit, 'dependency commit');
  check(candidate.operationalStatus === 'NOT_ATTESTED', 'operational status');
  check(candidate.productionHosting === 'REG_RU_VPS_ONLY', 'production hosting');
  check(candidate.globalPolicy.networkFetchEnabled === false, 'network fetch enabled');
  check(candidate.globalPolicy.sharedRagEnabled === false, 'shared RAG enabled');
  check(candidate.globalPolicy.modelWeightsAllowed === false, 'model weights enabled');
  check(candidate.globalPolicy.credentialsAllowed === false, 'credentials enabled');
  check(candidate.globalPolicy.protectedCabinetAccessAllowed === false, 'cabinet access enabled');
  check(
    setEqual(new Set(candidate.globalPolicy.quarantineReasons), quarantineReasons),
    'quarantine reason set',
  );

  const profiles = new Map(candidate.parserProfiles.map((profile) => [profile.code, profile]));
  check(profiles.size === 5, 'parser profile count');
  for (const profile of profiles.values()) {
    check(profile.executionEnabled === false, `${profile.code} execution`);
    check(profile.activeContentAllowed === false, `${profile.code} active content`);
    check(profile.externalRelationshipsAllowed === false, `${profile.code} external relationships`);
    check(profile.nestedArchivesAllowed === false, `${profile.code} nested archives`);
    check(profile.promptInstructionDisposition === 'QUARANTINE', `${profile.code} prompt policy`);
    check(profile.maximumInputBytes <= 50_000_000, `${profile.code} input bytes`);
    check(profile.maximumArchiveEntries <= 500, `${profile.code} archive entries`);
    check(profile.maximumDecompressionRatio <= 50, `${profile.code} decompression ratio`);
  }

  check(candidate.sources.length === 10, 'source count');
  check(unique(candidate.sources.map((source) => source.sourceId)), 'source IDs not unique');
  check(unique(candidate.sources.map((source) => source.familyCode)), 'family codes not unique');

  for (const source of candidate.sources) {
    const prefix = source.sourceId;
    check(source.dataPlane === 'PUBLIC_OFFICIAL', `${prefix} data plane`);
    check(source.evidenceRefs.length > 0, `${prefix} evidence references missing`);
    check(source.rights.sourceSpecificEvidence.length > 0, `${prefix} rights evidence missing`);
    check(decisionForClass.get(source.sourceClass) === source.rights.decisionRef, `${prefix} decision ref`);

    const f0Decision = authority.f0Decisions.get(source.rights.decisionRef);
    check(Boolean(f0Decision), `${prefix} missing AP-14F0 decision`);
    if (f0Decision) {
      check(f0Decision.sourceClassCode === source.sourceClass, `${prefix} AP-14F0 class drift`);
      check(f0Decision.sharedIndexAllowed === false, `${prefix} inherited shared index`);
      check(f0Decision.modelWeightsAllowed === false, `${prefix} inherited model weights`);
    }

    check(
      ['METADATA_ONLY', 'RIGHTS_UNRESOLVED'].includes(source.rights.disposition),
      `${prefix} unsafe rights disposition`,
    );
    for (const field of ['bulkCollectionAllowed', 'redistributionAllowed', 'sharedIndexAllowed', 'modelWeightsAllowed']) {
      check(source.rights[field] === false, `${prefix} rights ${field}`);
    }
    for (const field of ['enabled', 'sourceFetchEnabled', 'parserExecutionEnabled', 'sharedRagAllowed', 'modelWeightsAllowed']) {
      check(source.admission[field] === false, `${prefix} admission ${field}`);
    }

    let uri;
    try {
      uri = new URL(source.transport.officialUri);
    } catch {
      check(false, `${prefix} invalid URI`);
      continue;
    }
    check(uri.protocol === 'https:', `${prefix} HTTPS`);
    check(uri.username === '' && uri.password === '' && uri.hash === '', `${prefix} URI secrets or fragment`);
    check(uri.hostname === source.transport.hostPin, `${prefix} host pin`);
    check(source.transport.allowedHosts.includes(uri.hostname), `${prefix} host allowlist`);
    check(source.transport.pathPrefixes.some((path) => uri.pathname.startsWith(path)), `${prefix} path scope`);
    check(source.transport.httpsOnly === true, `${prefix} HTTPS policy`);
    check(source.transport.publicDnsOnly === true, `${prefix} DNS policy`);
    check(source.transport.credentialsAllowed === false, `${prefix} credentials policy`);
    check(source.transport.cookiesAllowed === false, `${prefix} cookies policy`);
    check(source.transport.sameHostRedirectRequired === true, `${prefix} redirect host policy`);
    check(source.transport.maximumRedirects <= 3, `${prefix} redirect bound`);

    const sourceProfiles = source.parserProfileCodes.map((code) => profiles.get(code));
    check(sourceProfiles.length > 0 && sourceProfiles.every(Boolean), `${prefix} parser profile ref`);
    const coveredMedia = new Set(sourceProfiles.filter(Boolean).flatMap((profile) => profile.mediaTypes));
    check(source.contentPolicy.allowedMediaTypes.every((media) => coveredMedia.has(media)), `${prefix} media coverage`);
    const maximumProfileBytes = Math.max(...sourceProfiles.filter(Boolean).map((profile) => profile.maximumInputBytes), 0);
    check(source.contentPolicy.maximumBytes <= maximumProfileBytes, `${prefix} byte bound`);
    check(source.contentPolicy.maximumArchiveEntries <= 500, `${prefix} archive bound`);
    check(source.contentPolicy.maximumDecompressionRatio <= 50, `${prefix} decompression bound`);
    for (const field of ['nestedArchivesAllowed', 'personalDataAllowed', 'credentialMaterialAllowed', 'cabinetMaterialAllowed', 'tenantOrContractDataAllowed']) {
      check(source.contentPolicy[field] === false, `${prefix} content ${field}`);
    }

    const reviewed = Date.parse(`${source.freshness.rightsReviewedAt}T00:00:00Z`);
    const due = Date.parse(`${source.freshness.rightsReviewDueAt}T00:00:00Z`);
    check(Number.isFinite(reviewed) && Number.isFinite(due) && due > reviewed, `${prefix} rights review dates`);
    check(source.freshness.availabilityAlarmAfterFailures <= 5, `${prefix} availability alarm`);
    check(Object.values(source.quarantine).every((value) => value === 'QUARANTINE'), `${prefix} quarantine policy`);

    for (const evidenceRef of source.evidenceRefs) {
      const separator = evidenceRef.indexOf(':');
      const kind = evidenceRef.slice(0, separator);
      const id = evidenceRef.slice(separator + 1);
      check(separator > 0 && id.length > 0, `${prefix} malformed evidence ref`);
      if (kind === 'AP14D_CATALOG') {
        const entry = authority.catalogSources.get(id);
        check(Boolean(entry), `${prefix} missing catalog ref ${id}`);
        if (entry) {
          check(entry.entrypoint_uri === source.transport.officialUri, `${prefix} catalog URI drift`);
          check(entry.allowed_hosts.includes(source.transport.hostPin), `${prefix} catalog host drift`);
        }
      } else if (kind === 'AP14D_AUTHORITY') {
        const entry = authority.ap14dDecisions.get(id);
        check(Boolean(entry), `${prefix} missing authority ref ${id}`);
        if (entry) check(entry.official_uri === source.transport.officialUri, `${prefix} authority URI drift`);
      } else if (kind === 'PC_CROP_10A') {
        const entry = authority.inventoryLocators.get(id);
        check(Boolean(entry), `${prefix} missing inventory ref ${id}`);
        if (entry) {
          const exactUri = entry.uri === source.transport.officialUri;
          const coveredSystem = source.systemCodes.some((code) => entry.coverage.has(code));
          check(exactUri || coveredSystem, `${prefix} inventory ref does not bind URI/system`);
        }
      } else {
        check(false, `${prefix} unsupported evidence kind ${kind}`);
      }
    }
    for (const code of source.systemCodes) {
      check(authority.systemCodes.has(code), `${prefix} unknown system code ${code}`);
    }
  }

  check(candidate.sources.every((source) => source.rights.disposition !== 'ALLOWED_SHARED_RAG'), 'shared RAG source exists');
  return errors;
}

const schema = parse(schemaPath, 'schema');
const registry = parse(registryPath, 'registry');
const scope = parse(scopePath, 'scope');
assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema draft');
assert(schema.additionalProperties === false, 'schema root not closed');
const schemaErrors = closedObjectSchemas(schema);
assert(schemaErrors.length === 0, schemaErrors.join('\n'));
assert(scope.issue === 3355, 'scope issue');
assert(scope.baseCommit === dependencyCommit, 'scope base');
assert(scope.operationalStatus === 'NOT_ATTESTED', 'scope status');
assert(setEqual(new Set(scope.allowedPaths), new Set(expectedPaths)), 'scope path set');

assert(registry.authorityBindings.length === 4, 'authority binding count');
assert(unique(registry.authorityBindings.map((binding) => binding.code)), 'authority binding uniqueness');
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
const pcRegistry = bound.PC_CROP_10A_GOVERNMENT_SYSTEMS;
const authority = {
  f0Decisions: new Map(bound.AP14F0_KNOWLEDGE_AUTHORITY.reuseDecisions.map((entry) => [entry.decisionId, entry])),
  catalogSources: new Map(bound.AP14D_OFFICIAL_SOURCE_CATALOG.sources.map((entry) => [entry.source_id, entry])),
  ap14dDecisions: new Map(bound.AP14D_SOURCE_AUTHORITY.decisions.map((entry) => [entry.source_id, entry])),
  inventoryLocators: inventoryMap(pcRegistry),
  systemCodes: new Set(pcRegistry.systems.map((entry) => entry.systemCode)),
};

const errors = validate(registry, authority);
assert(errors.length === 0, errors.join('\n'));

const probes = [
  ['shared_rag_enabled', (value) => { value.sources[0].admission.sharedRagAllowed = true; }],
  ['fetch_enabled', (value) => { value.sources[0].admission.sourceFetchEnabled = true; }],
  ['host_mismatch', (value) => { value.sources[0].transport.hostPin = 'evil.example'; }],
  ['http_downgrade', (value) => { value.sources[0].transport.officialUri = 'http://specagro.ru/fgis/ok'; }],
  ['parser_execution', (value) => { value.parserProfiles[0].executionEnabled = true; }],
  ['rights_promotion', (value) => { value.sources[0].rights.disposition = 'ALLOWED_SHARED_RAG'; }],
  ['evidence_removed', (value) => { value.sources[0].evidenceRefs = []; }],
  ['review_expired', (value) => { value.sources[0].freshness.rightsReviewDueAt = '2026-07-27'; }],
  ['unsupported_mime', (value) => { value.sources[0].contentPolicy.allowedMediaTypes.push('application/pdf'); }],
  ['oversized_payload', (value) => { value.sources[0].contentPolicy.maximumBytes = 50_000_001; }],
];
for (const [name, mutate] of probes) {
  const candidate = clone(registry);
  mutate(candidate);
  assert(validate(candidate, authority, `probe:${name}`).length > 0, `negative mutation ${name} passed`);
}

let changedPaths = [];
const scopeIndex = process.argv.indexOf('--scope-guard');
if (scopeIndex !== -1) {
  const base = process.argv[scopeIndex + 1];
  assert(base, '--scope-guard requires a base ref');
  git('merge-base', '--is-ancestor', base, 'HEAD');
  changedPaths = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean).sort();
  assert(setEqual(new Set(changedPaths), new Set(expectedPaths)), `changed path set: ${changedPaths.join(', ')}`);
}

const dispositions = registry.sources.reduce((result, source) => {
  result[source.rights.disposition] = (result[source.rights.disposition] ?? 0) + 1;
  return result;
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
