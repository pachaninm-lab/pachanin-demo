#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, '../..');
const knowledgeRoot = resolve(repositoryRoot, 'apps/tai/knowledge-sources');

const paths = {
  authoritySchema: resolve(knowledgeRoot, 'AP-14F0-KNOWLEDGE-AUTHORITY.schema.v1.json'),
  authority: resolve(knowledgeRoot, 'AP-14F0-KNOWLEDGE-AUTHORITY.v1.json'),
  provenanceSchema: resolve(knowledgeRoot, 'AP-14F0-PROVENANCE.schema.v1.json'),
  quarantineSchema: resolve(knowledgeRoot, 'AP-14F0-QUARANTINE.schema.v1.json'),
  scope: resolve(repositoryRoot, 'docs/platform-v7/autopilot/scopes/tai-ap-14f0-3339.json'),
};

const expectedPaths = [
  '.github/workflows/tai-ap-14f0.yml',
  'apps/tai/knowledge-sources/AP-14F0-KNOWLEDGE-AUTHORITY.schema.v1.json',
  'apps/tai/knowledge-sources/AP-14F0-KNOWLEDGE-AUTHORITY.v1.json',
  'apps/tai/knowledge-sources/AP-14F0-PROVENANCE.schema.v1.json',
  'apps/tai/knowledge-sources/AP-14F0-QUARANTINE.schema.v1.json',
  'docs/platform-v7/autopilot/scopes/tai-ap-14f0-3339.json',
  'scripts/tai-ap-14f0/verify.mjs',
];

const expectedPlanes = ['CONTRACTED', 'PUBLIC_OFFICIAL', 'TENANT_LIVE'];
const expectedSourceClasses = [
  'CONTRACTED_API',
  'CONTRACTED_DATASET',
  'OFFICIAL_MANUAL',
  'OFFICIAL_REGULATION',
  'OPEN_DATASET',
  'PUBLIC_REGISTRY',
  'TENANT_API_RESPONSE',
  'TENANT_EXPORT',
];
const expectedForbiddenContent = [
  'AUTH_CREDENTIAL',
  'CABINET_DOCUMENT',
  'CROSS_TENANT_DATA',
  'ORGANIZATION_TRANSACTION',
  'PERSONAL_DATA',
  'SIGNATURE_OR_PRIVATE_KEY_MATERIAL',
  'TRADE_SECRET',
];
const expectedForbiddenClaims = [
  'COMPLETE_COVERAGE',
  'CONNECTED',
  'LICENSED_FOR_REUSE',
  'LIVE',
  'PRODUCTION_READY',
  'TRAINED_ON',
];
const expectedQuarantineReasons = [
  'AUTHORITY_REVIEW_OVERDUE',
  'CABINET_OR_CREDENTIAL_MATERIAL',
  'CROSS_TENANT_RISK',
  'DIGEST_MISMATCH',
  'HOST_NOT_PINNED',
  'PERSONAL_OR_SECRET_DATA',
  'PROMPT_INJECTION_OR_UNTRUSTED_INSTRUCTIONS',
  'PROVENANCE_INCOMPLETE',
  'REUSE_FORBIDDEN',
  'RIGHTS_UNRESOLVED',
  'SOURCE_STALE',
  'TENANT_BOUNDARY_MISSING',
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

function assertIsoDate(value, context) {
  assert(/^\d{4}-\d{2}-\d{2}$/u.test(value), `${context} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  assert(!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, `${context} is invalid`);
}

function assertIsoDateTime(value, context) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(value), `${context} must be an ISO date-time`);
  assert(!Number.isNaN(Date.parse(value)), `${context} is invalid`);
}

function compileDraft202012(rootSchema) {
  assert(rootSchema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema must use JSON Schema draft 2020-12');

  function resolveReference(reference) {
    assert(reference.startsWith('#/'), `only local JSON pointers are supported: ${reference}`);
    return reference.slice(2).split('/').reduce((value, token) => {
      const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
      assert(value !== null && typeof value === 'object' && key in value, `unresolved schema reference ${reference}`);
      return value[key];
    }, rootSchema);
  }

  function matchesType(value, type) {
    if (type === 'null') return value === null;
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    return typeof value === type;
  }

  function validFormat(value, format) {
    if (format === 'uri') {
      try {
        return Boolean(new URL(value).protocol);
      } catch {
        return false;
      }
    }
    if (format === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }
    if (format === 'date-time') return /^\d{4}-\d{2}-\d{2}T/u.test(value) && !Number.isNaN(Date.parse(value));
    fail(`unsupported schema format ${format}`);
  }

  function validateNode(schemaNode, value, instancePath = '$', schemaPath = '#') {
    const errors = [];
    const add = (message) => errors.push(`${instancePath}: ${message} (${schemaPath})`);

    if (schemaNode.$ref) return validateNode(resolveReference(schemaNode.$ref), value, instancePath, schemaNode.$ref);

    if (schemaNode.oneOf) {
      const results = schemaNode.oneOf.map((entry, index) => validateNode(entry, value, instancePath, `${schemaPath}/oneOf/${index}`));
      if (results.filter((entry) => entry.length === 0).length !== 1) add('must match exactly one oneOf branch');
      return errors;
    }

    if (schemaNode.allOf) {
      schemaNode.allOf.forEach((entry, index) => {
        errors.push(...validateNode(entry, value, instancePath, `${schemaPath}/allOf/${index}`));
      });
    }

    if (schemaNode.if && schemaNode.then) {
      const condition = validateNode(schemaNode.if, value, instancePath, `${schemaPath}/if`);
      if (condition.length === 0) errors.push(...validateNode(schemaNode.then, value, instancePath, `${schemaPath}/then`));
      if (condition.length !== 0 && schemaNode.else) errors.push(...validateNode(schemaNode.else, value, instancePath, `${schemaPath}/else`));
    }

    if (schemaNode.type !== undefined) {
      const accepted = Array.isArray(schemaNode.type) ? schemaNode.type : [schemaNode.type];
      if (!accepted.some((type) => matchesType(value, type))) {
        add(`expected type ${accepted.join('|')}`);
        return errors;
      }
    }

    if (schemaNode.const !== undefined && canonicalJson(value) !== canonicalJson(schemaNode.const)) {
      add(`must equal ${JSON.stringify(schemaNode.const)}`);
    }
    if (schemaNode.enum && !schemaNode.enum.some((entry) => canonicalJson(entry) === canonicalJson(value))) {
      add(`must be one of ${schemaNode.enum.join(', ')}`);
    }

    if (typeof value === 'string') {
      if (schemaNode.minLength !== undefined && [...value].length < schemaNode.minLength) add(`must contain at least ${schemaNode.minLength} characters`);
      if (schemaNode.maxLength !== undefined && [...value].length > schemaNode.maxLength) add(`must contain at most ${schemaNode.maxLength} characters`);
      if (schemaNode.pattern !== undefined && !new RegExp(schemaNode.pattern, 'u').test(value)) add(`must match ${schemaNode.pattern}`);
      if (schemaNode.format !== undefined && !validFormat(value, schemaNode.format)) add(`must satisfy format ${schemaNode.format}`);
    }

    if (typeof value === 'number') {
      if (schemaNode.minimum !== undefined && value < schemaNode.minimum) add(`must be >= ${schemaNode.minimum}`);
      if (schemaNode.maximum !== undefined && value > schemaNode.maximum) add(`must be <= ${schemaNode.maximum}`);
    }

    if (Array.isArray(value)) {
      if (schemaNode.minItems !== undefined && value.length < schemaNode.minItems) add(`must contain at least ${schemaNode.minItems} items`);
      if (schemaNode.maxItems !== undefined && value.length > schemaNode.maxItems) add(`must contain at most ${schemaNode.maxItems} items`);
      if (schemaNode.uniqueItems === true) {
        const entries = value.map(canonicalJson);
        if (new Set(entries).size !== entries.length) add('must contain unique items');
      }
      if (schemaNode.items) {
        value.forEach((entry, index) => errors.push(...validateNode(schemaNode.items, entry, `${instancePath}/${index}`, `${schemaPath}/items`)));
      }
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const requiredKey of schemaNode.required ?? []) {
        if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) add(`missing required property ${requiredKey}`);
      }
      for (const [key, entry] of Object.entries(value)) {
        if (schemaNode.properties?.[key]) {
          errors.push(...validateNode(schemaNode.properties[key], entry, `${instancePath}/${key}`, `${schemaPath}/properties/${key}`));
        } else if (schemaNode.additionalProperties === false) {
          add(`additional property ${key} is forbidden`);
        }
      }
    }

    return errors;
  }

  return (value) => validateNode(rootSchema, value);
}

const authoritySchema = parseJson(paths.authoritySchema, 'authority schema');
const authority = parseJson(paths.authority, 'authority registry');
const provenanceSchema = parseJson(paths.provenanceSchema, 'provenance schema');
const quarantineSchema = parseJson(paths.quarantineSchema, 'quarantine schema');
const scope = parseJson(paths.scope, 'scope manifest');
const checks = [];

function pass(code, detail) {
  checks.push({ code, status: 'PASS', detail });
}

function validateAuthority(candidate) {
  const schemaErrors = compileDraft202012(authoritySchema)(candidate);
  assert(schemaErrors.length === 0, `authority violates published schema:\n${schemaErrors.join('\n')}`);

  assertExactKeys(candidate, [
    '$schema',
    'schemaVersion',
    'authorityVersion',
    'generatedAt',
    'evidenceCutoff',
    'operationalStatus',
    'productionHosting',
    'defaultDisposition',
    'dataPlanes',
    'sourceClasses',
    'reuseDecisions',
    'globalControls',
    'forbiddenContentClasses',
    'forbiddenClaims',
    'provenanceSchema',
    'quarantineSchema',
  ], 'authority');

  assert(candidate.operationalStatus === 'NOT_ATTESTED', 'operational status may not exceed NOT_ATTESTED');
  assert(candidate.productionHosting === 'REG_RU_VPS_ONLY', 'production hosting boundary changed');
  assert(candidate.defaultDisposition === 'QUARANTINE', 'unknown material must quarantine by default');
  assertIsoDateTime(candidate.generatedAt, 'generatedAt');
  assertIsoDate(candidate.evidenceCutoff, 'evidenceCutoff');

  const planes = candidate.dataPlanes.map((plane) => plane.code);
  assertUnique(planes, 'data plane codes');
  sameSet(planes, expectedPlanes, 'data planes');
  for (const plane of candidate.dataPlanes) {
    assert(plane.enabled === false, `${plane.code} must remain disabled`);
    assert(plane.crossTenantCacheAllowed === false, `${plane.code} cross-tenant cache must remain forbidden`);
    assert(plane.modelWeightsAllowed === false, `${plane.code} model-weight use must remain forbidden`);
    assert(plane.credentialMaterialAllowed === false, `${plane.code} credential material must remain forbidden`);
    assert(plane.auditRequired === true, `${plane.code} audit must be required`);
    if (plane.code === 'PUBLIC_OFFICIAL') {
      assert(plane.sharedPersistenceAllowed === false, 'PUBLIC_OFFICIAL cannot be shared-persisted before source-specific admission');
      assert(plane.identityBoundRequired === false, 'PUBLIC_OFFICIAL must not require tenant identity');
      assert(plane.expiryRequired === false, 'PUBLIC_OFFICIAL does not use tenant result TTL');
    } else {
      assert(plane.sharedPersistenceAllowed === false, `${plane.code} shared persistence must be forbidden`);
      assert(plane.identityBoundRequired === true, `${plane.code} must be identity-bound`);
      assert(plane.expiryRequired === true, `${plane.code} must expire`);
    }
  }

  const sourceCodes = candidate.sourceClasses.map((entry) => entry.code);
  assertUnique(sourceCodes, 'source class codes');
  sameSet(sourceCodes, expectedSourceClasses, 'source classes');
  for (const sourceClass of candidate.sourceClasses) {
    assert(sourceClass.sharedIndexEligible === false, `${sourceClass.code} cannot be shared-index eligible in AP-14F0`);
    assert(sourceClass.modelWeightsEligible === false, `${sourceClass.code} cannot be model-weight eligible`);
    assert(sourceClass.credentialMaterialAllowed === false, `${sourceClass.code} cannot store credentials`);
    assert(sourceClass.cabinetMaterialAllowed === false, `${sourceClass.code} cannot admit cabinet material`);
    assertUnique(sourceClass.requiredEvidence, `${sourceClass.code} required evidence`);
    if (sourceClass.dataPlane === 'PUBLIC_OFFICIAL') {
      assert(['REVIEW_REQUIRED', 'METADATA_ONLY'].includes(sourceClass.defaultDecision), `${sourceClass.code} has an unsafe public default`);
      for (const field of ['OFFICIAL_LOCATOR', 'HOST_PIN', 'PUBLICATION_OR_EFFECTIVE_DATE', 'OBSERVED_AT', 'CONTENT_SHA256', 'SOURCE_ROW_PAGE_SECTION', 'RIGHTS_DECISION']) {
        assert(sourceClass.requiredEvidence.includes(field), `${sourceClass.code} is missing ${field}`);
      }
    } else if (sourceClass.dataPlane === 'TENANT_LIVE') {
      assert(sourceClass.defaultDecision === 'TENANT_EPHEMERAL_ONLY', `${sourceClass.code} must be tenant-ephemeral only`);
      for (const field of ['TENANT_BINDING', 'AUDIT_REFERENCE', 'EXPIRY']) assert(sourceClass.requiredEvidence.includes(field), `${sourceClass.code} is missing ${field}`);
    } else {
      assert(sourceClass.dataPlane === 'CONTRACTED', `${sourceClass.code} has an unknown plane`);
      assert(sourceClass.defaultDecision === 'CONTRACT_REQUIRED', `${sourceClass.code} must remain contract-required`);
      for (const field of ['AGREEMENT_REFERENCE', 'CREDENTIAL_REFERENCE_ONLY', 'TENANT_BINDING', 'AUDIT_REFERENCE', 'EXPIRY']) {
        assert(sourceClass.requiredEvidence.includes(field), `${sourceClass.code} is missing ${field}`);
      }
    }
  }

  const decisionIds = candidate.reuseDecisions.map((entry) => entry.decisionId);
  const decisionSources = candidate.reuseDecisions.map((entry) => entry.sourceClassCode);
  assertUnique(decisionIds, 'reuse decision IDs');
  assertUnique(decisionSources, 'reuse decision source classes');
  sameSet(decisionSources, expectedSourceClasses, 'reuse-decision coverage');
  const sourceByCode = new Map(candidate.sourceClasses.map((entry) => [entry.code, entry]));
  for (const decision of candidate.reuseDecisions) {
    const sourceClass = sourceByCode.get(decision.sourceClassCode);
    assert(sourceClass, `decision ${decision.decisionId} references an unknown source class`);
    assert(decision.status === sourceClass.defaultDecision, `decision ${decision.decisionId} conflicts with source-class default`);
    assert(decision.sharedIndexAllowed === false, `decision ${decision.decisionId} cannot admit shared indexing in AP-14F0`);
    assert(decision.modelWeightsAllowed === false, `decision ${decision.decisionId} cannot allow model-weight use`);
    assert(decision.separateAdmissionRequired === true, `decision ${decision.decisionId} must require separate admission`);
    assertIsoDate(decision.reviewedAt, `${decision.decisionId}.reviewedAt`);
    assertIsoDate(decision.reviewDueAt, `${decision.decisionId}.reviewDueAt`);
    assert(Date.parse(`${decision.reviewDueAt}T00:00:00Z`) > Date.parse(`${decision.reviewedAt}T00:00:00Z`), `${decision.decisionId} review due date must be later`);
  }

  assert(Object.values(candidate.globalControls).every((value) => value === true), 'all global fail-closed controls must be true');
  sameSet(candidate.forbiddenContentClasses, expectedForbiddenContent, 'forbidden content classes');
  sameSet(candidate.forbiddenClaims, expectedForbiddenClaims, 'forbidden claims');
  assert(candidate.provenanceSchema === './AP-14F0-PROVENANCE.schema.v1.json', 'provenance schema reference changed');
  assert(candidate.quarantineSchema === './AP-14F0-QUARANTINE.schema.v1.json', 'quarantine schema reference changed');

  return {
    planes: planes.length,
    sourceClasses: sourceCodes.length,
    reuseDecisions: decisionIds.length,
  };
}

assert(authoritySchema.type === 'object' && authoritySchema.additionalProperties === false, 'authority schema root must be closed');
for (const [name, definition] of Object.entries(authoritySchema.$defs ?? {})) {
  assert(definition.type === 'object' && definition.additionalProperties === false, `authority schema definition ${name} must be a closed object`);
}
const authorityCounts = validateAuthority(authority);
pass('AUTHORITY_SCHEMA_AND_REGISTRY', `${authorityCounts.planes} planes, ${authorityCounts.sourceClasses} source classes and ${authorityCounts.reuseDecisions} explicit decisions validate.`);

for (const [label, mutate] of [
  ['unknown root property', (value) => { value.permissiveFallback = true; }],
  ['tenant shared persistence', (value) => { value.dataPlanes.find((entry) => entry.code === 'TENANT_LIVE').sharedPersistenceAllowed = true; }],
  ['contracted activation', (value) => { value.dataPlanes.find((entry) => entry.code === 'CONTRACTED').enabled = true; }],
  ['model training permission', (value) => { value.reuseDecisions[0].modelWeightsAllowed = true; }],
  ['missing source-class decision', (value) => { value.reuseDecisions.pop(); }],
  ['shared public corpus admission', (value) => { value.reuseDecisions.find((entry) => entry.sourceClassCode === 'OPEN_DATASET').sharedIndexAllowed = true; }],
]) {
  const probe = structuredClone(authority);
  mutate(probe);
  let rejected = false;
  try {
    validateAuthority(probe);
  } catch {
    rejected = true;
  }
  assert(rejected, `negative mutation probe was accepted: ${label}`);
}
pass('NEGATIVE_MUTATION_PROBES', 'Six unsafe mutations fail closed.');

for (const [label, schema] of [['provenance', provenanceSchema], ['quarantine', quarantineSchema]]) {
  assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `${label} schema must use draft 2020-12`);
  assert(schema.type === 'object' && schema.additionalProperties === false, `${label} schema root must be closed`);
  for (const [name, definition] of Object.entries(schema.$defs ?? {})) {
    assert(definition.type === 'object' && definition.additionalProperties === false, `${label} definition ${name} must be a closed object`);
  }
}

sameSet(provenanceSchema.properties.sourceClass.enum, expectedSourceClasses, 'provenance source classes');
for (const field of ['sourceId', 'officialLocator', 'publicationDate', 'effectiveDate', 'observedAt', 'sourceLocator', 'contentSha256', 'unit', 'period', 'rights', 'freshness', 'admission']) {
  assert(provenanceSchema.required.includes(field), `provenance schema is missing ${field}`);
}
assert(provenanceSchema.properties.contentSha256.pattern === '^[a-f0-9]{64}$', 'provenance digest must be lowercase SHA-256');
assert(provenanceSchema.$defs.admission.properties.modelWeightsAllowed.const === false, 'provenance admission must forbid model-weight use');
assert(provenanceSchema.$defs.contractedBinding.properties.credentialReference.pattern.startsWith('^secret-ref:'), 'contracted provenance must store only a credential reference');
pass('PROVENANCE_CONTRACT', 'Source locator, dates, digest, unit, period, rights, tenant and freshness boundaries are mandatory.');

sameSet(quarantineSchema.properties.reasonCodes.items.enum, expectedQuarantineReasons, 'quarantine reason codes');
assert(quarantineSchema.properties.state.const === 'QUARANTINED', 'quarantine state must fail closed');
assert(quarantineSchema.$defs.releaseDecision.additionalProperties === false, 'release decision must be closed');
assert(quarantineSchema.$defs.releaseDecision.properties.mfaVerified.const === true, 'quarantine release must require MFA');
assert(quarantineSchema.$defs.releaseDecision.required.includes('auditEventId'), 'quarantine release must require audit evidence');
pass('QUARANTINE_CONTRACT', `${expectedQuarantineReasons.length} mandatory reason codes and MFA/audit-bound human release are enforced.`);

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
assert(scope.branch === 'agent/tai-ap-14f0-knowledge-authority-3339', 'scope branch mismatch');
assert(scope.status === 'active', 'scope must remain active');
assert(scope.issue === 3339, 'scope issue mismatch');
assert(scope.baseCommit === '8dff44ace01a1448f8f96b0fbf19f2532ee319e2', 'scope base commit changed');
assert(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope hosting boundary changed');
assert(scope.operationalStatus === 'NOT_ATTESTED', 'scope maturity boundary changed');
sameSet(scope.allowedPaths, expectedPaths, 'scope allowed paths');
assert(Object.values(scope.boundaries).every((value) => value === true), 'all scope boundaries must remain enabled');
assert(scope.acceptance.dataPlaneCount === 3, 'scope data-plane count mismatch');
assert(scope.acceptance.sourceClassCount === 8, 'scope source-class count mismatch');
assert(scope.acceptance.mandatoryQuarantineReasonCount === 12, 'scope quarantine count mismatch');
pass('SOURCE_CONTROLLED_SCOPE', 'The branch is bounded to seven authority-only paths.');

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
  assert(changed.includes('docs/platform-v7/autopilot/scopes/tai-ap-14f0-3339.json'), 'source-controlled scope manifest must be in the diff');
  pass('EXACT_ANCESTRY_AND_DIFF', `${baseRef} and governed base are ancestors; ${changed.length} changed paths are in scope.`);
}

const report = {
  status: 'PASS',
  slice: 'TAI-AP-14F0',
  issue: 3339,
  operationalStatus: authority.operationalStatus,
  productionHosting: authority.productionHosting,
  counts: {
    dataPlanes: authorityCounts.planes,
    sourceClasses: authorityCounts.sourceClasses,
    reuseDecisions: authorityCounts.reuseDecisions,
    quarantineReasons: expectedQuarantineReasons.length,
    negativeMutationProbes: 6,
  },
  boundaries: {
    sourceFetch: false,
    corpusIngestion: false,
    embeddingsOrVectorIndex: false,
    cabinetAccess: false,
    credentials: false,
    fineTuning: false,
    runtimeReadOrWrite: false,
    productionDeployment: false,
  },
  checks,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
