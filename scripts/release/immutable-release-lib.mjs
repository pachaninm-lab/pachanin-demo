import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const RELEASE_KIND = 'ProzrachnayaCenaImmutableRelease';
export const ROLLBACK_KIND = 'ProzrachnayaCenaImmutableRollback';
export const RELEASE_SCHEMA_VERSION = 1;
export const COMPONENT_NAMES = ['api', 'web', 'outboxWorker', 'migration'];
export const DATABASE_ROLLBACK_MODE = 'NO_DOWN_MIGRATION_SAME_SCHEMA_ONLY';

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY_PATTERN = /^[^\s@]+$/;

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function identityOf(payload) {
  return sha256(canonicalize(payload));
}

export function withoutIdentity(document) {
  const clone = structuredClone(document);
  delete clone.manifestId;
  delete clone.rollbackId;
  return clone;
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function hasForbiddenTagField(value, location = '$', errors = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => hasForbiddenTagField(item, `${location}[${index}]`, errors));
    return errors;
  }
  if (!value || typeof value !== 'object') return errors;
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === 'tag') errors.push(`${location}.${key}: mutable tag fields are forbidden`);
    hasForbiddenTagField(child, `${location}.${key}`, errors);
  }
  return errors;
}

function validateTimestamp(value, field, errors) {
  const parsed = Date.parse(value);
  assert(typeof value === 'string' && Number.isFinite(parsed), `${field} must be an ISO-8601 timestamp`, errors);
}

function validRepository(repository) {
  if (typeof repository !== 'string' || !REPOSITORY_PATTERN.test(repository)) return false;
  const finalSegment = repository.split('/').at(-1) ?? '';
  return repository.includes('/') && finalSegment.length > 0 && !finalSegment.includes(':');
}

function validateComponent(component, name, sourceCommit, errors) {
  assert(component && typeof component === 'object' && !Array.isArray(component), `components.${name} is required`, errors);
  if (!component || typeof component !== 'object') return;
  assert(validRepository(component.repository), `components.${name}.repository must be an OCI repository without tag or digest`, errors);
  assert(SHA256_PATTERN.test(component.digest ?? ''), `components.${name}.digest must be a lowercase sha256 OCI digest`, errors);
  assert(component.sourceCommit === sourceCommit, `components.${name}.sourceCommit must equal release sourceCommit`, errors);
  assert(component.runtimeUser === 'nonroot', `components.${name}.runtimeUser must equal nonroot`, errors);
}

export function validateRelease(document) {
  const errors = [];
  assert(document?.kind === RELEASE_KIND, `kind must equal ${RELEASE_KIND}`, errors);
  assert(document?.schemaVersion === RELEASE_SCHEMA_VERSION, `schemaVersion must equal ${RELEASE_SCHEMA_VERSION}`, errors);
  assert(document?.repository === 'pachaninm-lab/pachanin-demo', 'repository identity is invalid', errors);
  assert(COMMIT_PATTERN.test(document?.sourceCommit ?? ''), 'sourceCommit must be a lowercase 40-character Git SHA', errors);
  validateTimestamp(document?.createdAt, 'createdAt', errors);
  assert(SHA256_PATTERN.test(document?.migrationSetDigest ?? ''), 'migrationSetDigest must be a lowercase sha256 digest', errors);
  assert(typeof document?.maturityBoundary === 'string' && document.maturityBoundary.includes('not deployed'), 'maturityBoundary must state that the release is not deployed', errors);

  const names = Object.keys(document?.components ?? {}).sort();
  assert(JSON.stringify(names) === JSON.stringify([...COMPONENT_NAMES].sort()), `components must contain exactly ${COMPONENT_NAMES.join(', ')}`, errors);
  for (const name of COMPONENT_NAMES) validateComponent(document?.components?.[name], name, document?.sourceCommit, errors);

  const commands = document?.build?.commands;
  assert(Array.isArray(commands) && commands.length === COMPONENT_NAMES.length, `build.commands must contain ${COMPONENT_NAMES.length} component build commands`, errors);
  assert(document?.build?.buildOnce === true, 'build.buildOnce must equal true', errors);
  assert(document?.build?.deployMany === true, 'build.deployMany must equal true', errors);

  hasForbiddenTagField(document, '$', errors);
  const expectedIdentity = identityOf(withoutIdentity(document));
  assert(SHA256_PATTERN.test(document?.manifestId ?? ''), 'manifestId must be a lowercase sha256 digest', errors);
  assert(document?.manifestId === expectedIdentity, `manifestId mismatch: expected ${expectedIdentity}`, errors);
  return { valid: errors.length === 0, errors, expectedIdentity };
}

export function validateRollback(document) {
  const errors = [];
  assert(document?.kind === ROLLBACK_KIND, `kind must equal ${ROLLBACK_KIND}`, errors);
  assert(document?.schemaVersion === RELEASE_SCHEMA_VERSION, `schemaVersion must equal ${RELEASE_SCHEMA_VERSION}`, errors);
  assert(document?.repository === 'pachaninm-lab/pachanin-demo', 'repository identity is invalid', errors);
  validateTimestamp(document?.createdAt, 'createdAt', errors);
  assert(SHA256_PATTERN.test(document?.currentManifestId ?? ''), 'currentManifestId must be a sha256 digest', errors);
  assert(SHA256_PATTERN.test(document?.targetManifestId ?? ''), 'targetManifestId must be a sha256 digest', errors);
  assert(document?.currentManifestId !== document?.targetManifestId, 'rollback target must differ from current manifest', errors);
  assert(COMMIT_PATTERN.test(document?.targetSourceCommit ?? ''), 'targetSourceCommit must be a lowercase 40-character Git SHA', errors);
  assert(SHA256_PATTERN.test(document?.currentMigrationSetDigest ?? ''), 'currentMigrationSetDigest must be a sha256 digest', errors);
  assert(SHA256_PATTERN.test(document?.targetMigrationSetDigest ?? ''), 'targetMigrationSetDigest must be a sha256 digest', errors);
  assert(document?.currentMigrationSetDigest === document?.targetMigrationSetDigest, 'rollback across migration-set changes is forbidden without separate N-1 schema compatibility evidence', errors);
  assert(document?.databaseRollbackMode === DATABASE_ROLLBACK_MODE, `databaseRollbackMode must equal ${DATABASE_ROLLBACK_MODE}`, errors);
  assert(typeof document?.maturityBoundary === 'string' && document.maturityBoundary.includes('not executed'), 'maturityBoundary must state that rollback was not executed', errors);

  const names = Object.keys(document?.targetComponents ?? {}).sort();
  assert(JSON.stringify(names) === JSON.stringify([...COMPONENT_NAMES].sort()), `targetComponents must contain exactly ${COMPONENT_NAMES.join(', ')}`, errors);
  for (const name of COMPONENT_NAMES) validateComponent(document?.targetComponents?.[name], name, document?.targetSourceCommit, errors);

  hasForbiddenTagField(document, '$', errors);
  const expectedIdentity = identityOf(withoutIdentity(document));
  assert(SHA256_PATTERN.test(document?.rollbackId ?? ''), 'rollbackId must be a lowercase sha256 digest', errors);
  assert(document?.rollbackId === expectedIdentity, `rollbackId mismatch: expected ${expectedIdentity}`, errors);
  return { valid: errors.length === 0, errors, expectedIdentity };
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function releaseTarget(document) {
  if (document.kind === RELEASE_KIND) {
    const result = validateRelease(document);
    if (!result.valid) throw new Error(result.errors.join('; '));
    return {
      sourceCommit: document.sourceCommit,
      manifestId: document.manifestId,
      migrationSetDigest: document.migrationSetDigest,
      components: document.components,
    };
  }
  if (document.kind === ROLLBACK_KIND) {
    const result = validateRollback(document);
    if (!result.valid) throw new Error(result.errors.join('; '));
    return {
      sourceCommit: document.targetSourceCommit,
      manifestId: document.targetManifestId,
      migrationSetDigest: document.targetMigrationSetDigest,
      components: document.targetComponents,
    };
  }
  throw new Error(`Unsupported document kind: ${document.kind}`);
}
