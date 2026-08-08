#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BOOTSTRAP_BLOCKERS = Object.freeze([
  'API_WEB_NOT_EXACT_MAIN',
  'TAI_SERVICE_NOT_MATERIALIZED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED',
]);

export const POST_FULL_STACK_BOOTSTRAP_BLOCKERS = Object.freeze([
  'TAI_SERVICE_NOT_MATERIALIZED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED',
]);

export const CRITICAL_PASS_CODES = Object.freeze([
  'COMPOSE_AUTHORITY_READY',
  'PROTECTED_COMPOSE_READABLE',
  'CORE_TOPOLOGY_READY',
  'API_WEB_RUNTIME_PRESENT',
  'API_WEB_BASELINE_HEALTHY',
  'ROLLBACK_BASELINE_IDENTIFIED',
  'DOCKER_DISK_CAPACITY_READY',
  'HOST_MEMORY_CAPACITY_READY',
  'EXISTING_LOCAL_MODEL_ENV_READY',
  'API_TO_PRIVATE_MODEL_HEALTHY',
  'TAI_RELATIONS_READY',
  'ACTIVE_KNOWLEDGE_READY',
  'ACTIVE_MODEL_PROFILE_READY',
  'ACTIVE_MODEL_IDENTITY_MATCHED',
  'NO_PRODUCTION_MUTATION_DETECTED',
]);

export const STRICT_ONLY_PASS_CODES = Object.freeze([
  'API_WEB_EXACT_MAIN',
]);

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DIGEST_PATTERN = /^ghcr[.]io\/pachaninm-lab\/grainflow-tai@sha256:[0-9a-f]{64}$/u;
const REFERENCE_PATTERN = /^ghcr[.]io\/pachaninm-lab\/grainflow-tai:sha-[0-9a-f]{7}$/u;
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;
const ALLOWED_STATUSES = new Set(['PASS', 'BLOCKED', 'DEFERRED']);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !CODE_PATTERN.test(item))) {
    throw new Error(`${label} must be an array of authority codes`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicates`);
  return value;
}

function sameSet(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function requirePass(checks, code) {
  const check = checks.find((candidate) => candidate.code === code);
  if (!check || check.status !== 'PASS') throw new Error(`critical preflight authority ${code} did not pass`);
}

export function classifyTaiPreflightReport(raw, expectedSha, { allowBootstrap = false } = {}) {
  if (!SHA_PATTERN.test(expectedSha)) throw new Error('expected SHA is invalid');
  const report = object(raw, 'preflight report');
  if (report.schemaVersion !== 'tai.reg-ru.preflight.v1') throw new Error('preflight schema mismatch');
  if (report.targetSha !== expectedSha) throw new Error('preflight target SHA mismatch');
  if (report.mode !== 'READ_ONLY_PREFLIGHT') throw new Error('preflight mode mismatch');
  if (report.productionMutationAllowed !== false) throw new Error('preflight mutation boundary mismatch');

  const image = object(report.image, 'preflight image');
  if (!REFERENCE_PATTERN.test(String(image.reference || ''))) throw new Error('preflight image reference is invalid');
  if (!DIGEST_PATTERN.test(String(image.digest || ''))) throw new Error('preflight image digest is invalid');
  if (image.reference !== `ghcr.io/pachaninm-lab/grainflow-tai:sha-${expectedSha.slice(0, 7)}`) {
    throw new Error('preflight image reference is not bound to the target SHA');
  }

  if (!Array.isArray(report.checks) || report.checks.length === 0) throw new Error('preflight checks are missing');
  const checks = report.checks.map((value, index) => {
    const row = object(value, `preflight check ${index}`);
    if (typeof row.name !== 'string' || !row.name) throw new Error(`preflight check ${index} name is invalid`);
    if (typeof row.code !== 'string' || !CODE_PATTERN.test(row.code)) throw new Error(`preflight check ${index} code is invalid`);
    if (typeof row.status !== 'string' || !ALLOWED_STATUSES.has(row.status)) {
      throw new Error(`preflight check ${index} status is invalid`);
    }
    return row;
  });
  const checkCodes = new Set(checks.map(({ code }) => code));
  if (checkCodes.size !== checks.length) throw new Error('preflight check codes must be unique');

  const blockers = stringArray(report.blockers, 'preflight blockers');
  const blockedChecks = checks.filter(({ status }) => status === 'BLOCKED').map(({ code }) => code).sort();
  const sortedBlockers = [...blockers].sort();
  if (!sameSet(blockedChecks, sortedBlockers)) {
    throw new Error('preflight blocked checks and blocker authority differ');
  }

  for (const code of CRITICAL_PASS_CODES) requirePass(checks, code);

  const mutationChecks = checks.filter(({ name, code }) => /mutation/iu.test(name) || /MUTATION/u.test(code));
  if (!mutationChecks.some(({ code, status }) => code === 'NO_PRODUCTION_MUTATION_DETECTED' && status === 'PASS')) {
    throw new Error('no-mutation authority is missing');
  }
  if (mutationChecks.some(({ status }) => status === 'BLOCKED')) throw new Error('mutation guard is blocked');

  if (blockers.length === 0) {
    if (checkCodes.has('API_WEB_NOT_EXACT_MAIN')) {
      throw new Error('strict evidence contains non-exact API/web authority');
    }
    for (const code of STRICT_ONLY_PASS_CODES) requirePass(checks, code);
    if (report.passed !== true) throw new Error('zero-blocker preflight did not declare PASS');
    return Object.freeze({
      classification: 'STRICT_PASS',
      description: 'TAI REG.RU preflight PASS',
      blockers: Object.freeze([]),
    });
  }

  if (!allowBootstrap) throw new Error(`preflight is blocked: ${sortedBlockers.join(',')}`);

  const expectedFullStackBootstrap = [...BOOTSTRAP_BLOCKERS].sort();
  const expectedPostFullStackBootstrap = [...POST_FULL_STACK_BOOTSTRAP_BLOCKERS].sort();
  const fullStackBootstrap = sameSet(sortedBlockers, expectedFullStackBootstrap);
  const postFullStackBootstrap = sameSet(sortedBlockers, expectedPostFullStackBootstrap);

  if (!fullStackBootstrap && !postFullStackBootstrap) {
    throw new Error(`unexpected bootstrap blockers: ${sortedBlockers.join(',')}`);
  }
  if (report.passed !== false) throw new Error('bootstrap-eligible preflight must retain raw passed=false evidence');

  if (fullStackBootstrap) {
    if (checkCodes.has('API_WEB_EXACT_MAIN')) {
      throw new Error('full-stack bootstrap evidence may not simultaneously assert API_WEB_EXACT_MAIN');
    }
    const apiMismatch = checks.find(({ code }) => code === 'API_WEB_NOT_EXACT_MAIN');
    if (!apiMismatch || apiMismatch.status !== 'BLOCKED') {
      throw new Error('full-stack bootstrap API/web exact-main mismatch authority is missing');
    }
    return Object.freeze({
      classification: 'BOOTSTRAP_ELIGIBLE',
      description: 'TAI REG.RU full-stack bootstrap preflight PASS',
      blockers: Object.freeze([...sortedBlockers]),
    });
  }

  if (checkCodes.has('API_WEB_NOT_EXACT_MAIN')) {
    throw new Error('post-full-stack bootstrap evidence contains non-exact API/web authority');
  }
  requirePass(checks, 'API_WEB_EXACT_MAIN');
  return Object.freeze({
    classification: 'POST_FULL_STACK_BOOTSTRAP_ELIGIBLE',
    description: 'TAI REG.RU post-full-stack bootstrap preflight PASS',
    blockers: Object.freeze([...sortedBlockers]),
  });
}

export function readAndClassifyTaiPreflightReport(path, expectedSha, options) {
  return classifyTaiPreflightReport(JSON.parse(readFileSync(path, 'utf8')), expectedSha, options);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , reportPath, expectedSha, ...flags] = process.argv;
  if (!reportPath || !expectedSha || flags.some((flag) => flag !== '--allow-bootstrap')) {
    console.error('usage: verify-tai-preflight-report.mjs REPORT_PATH EXPECTED_SHA [--allow-bootstrap]');
    process.exit(2);
  }
  try {
    const result = readAndClassifyTaiPreflightReport(reportPath, expectedSha, {
      allowBootstrap: flags.includes('--allow-bootstrap'),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    console.error(`TAI preflight authority blocked: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
