#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve('.');
const EXCEPTIONS_PATH = resolve('docs/platform-v7/autopilot/security-exceptions.json');
const SCHEMA_PATH = resolve('docs/platform-v7/autopilot/security-exceptions.schema.json');
const SCOPE_PATH = resolve('docs/platform-v7/autopilot/security-release-scope.json');
const SEMGREP_PATH = resolve('docs/platform-v7/autopilot/semgrep-security.yml');
const TRIVY_EVALUATOR_PATH = resolve('docs/platform-v7/autopilot/evaluate-trivy-report.mjs');
const WORKFLOW_PATH = resolve('.github/workflows/security-quality-gate.yml');
const REPORT_PATH = resolve(process.env.SECURITY_POLICY_REPORT ?? 'artifacts/security/security-policy-validation.json');
const IGNORE_DIR = resolve(process.env.TRIVY_IGNORE_DIR ?? 'artifacts/security');
const EXACT_HEAD = process.env.SECURITY_EXACT_HEAD ?? '';
const MAX_EXCEPTION_DAYS = 90;
const ALLOWED_SCANNERS = new Set(['trivy-container', 'trivy-filesystem', 'trivy-iac', 'pnpm-audit']);
const TRIVY_TYPES = new Set(['vulnerability', 'misconfiguration', 'secret']);
const TRIVY_TYPE_KEYS = new Map([
  ['vulnerability', 'vulnerabilities'],
  ['misconfiguration', 'misconfigurations'],
  ['secret', 'secrets'],
]);
const REQUIRED_SOURCE_ROOTS = ['apps/api/src', 'apps/web/app', 'apps/web/lib', 'workers', 'packages'];
const REQUIRED_DEFERRED = new Map([
  ['apps/ml', '#2605'],
  ['infra/airflow', '#2605'],
  ['infra/helm', '#2606'],
  ['infra/k8s', '#2606'],
]);

function parseJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function headSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function check(errors, condition, message) {
  if (!condition) errors.push(message);
}

function normalizePath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function overlaps(left, right) {
  const a = normalizePath(left);
  const b = normalizePath(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function yamlDocument(entries) {
  const document = { vulnerabilities: [], misconfigurations: [], secrets: [] };
  for (const exception of entries) {
    const key = TRIVY_TYPE_KEYS.get(exception.findingType);
    if (!key) throw new Error(`Unsupported Trivy finding type: ${exception.findingType}`);
    const item = {
      id: exception.findingId,
      expired_at: String(exception.expiresAt).slice(0, 10),
      statement: `${exception.id} ${exception.ticket}: ${exception.rationale}`,
    };
    if (Array.isArray(exception.paths) && exception.paths.length > 0) item.paths = exception.paths;
    if (Array.isArray(exception.purls) && exception.purls.length > 0) item.purls = exception.purls;
    document[key].push(item);
  }
  return `${JSON.stringify(document, null, 2)}\n`;
}

const errors = [];
const warnings = [];
const validatedCommit = headSha();
const registry = parseJson(EXCEPTIONS_PATH);
const schema = parseJson(SCHEMA_PATH);
const scope = parseJson(SCOPE_PATH);
const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
const now = new Date();

check(errors, /^[0-9a-f]{40}$/.test(EXACT_HEAD), 'SECURITY_EXACT_HEAD must be a full commit SHA.');
check(errors, validatedCommit === EXACT_HEAD, `Checked out commit ${validatedCommit} does not match exact head ${EXACT_HEAD}.`);
check(errors, schema?.properties?.schemaVersion?.const === 1, 'Security exception schema version must remain 1.');
check(errors, registry.schemaVersion === 1, 'Security exception registry schemaVersion must equal 1.');
check(errors, registry.policy?.criticalExceptionsAllowed === false, 'Critical vulnerability exceptions are forbidden.');
check(errors, registry.policy?.maximumExceptionDays === MAX_EXCEPTION_DAYS, `maximumExceptionDays must equal ${MAX_EXCEPTION_DAYS}.`);
check(errors, Array.isArray(registry.exceptions), 'exceptions must be an array.');

check(errors, scope.schemaVersion === 1, 'Security release scope schemaVersion must equal 1.');
const sourceRoots = (scope.releaseAuthority?.sourceRoots ?? []).map(normalizePath);
check(errors, JSON.stringify(sourceRoots) === JSON.stringify(REQUIRED_SOURCE_ROOTS), 'Release source roots must match the governed canonical list.');
check(errors, normalizePath(scope.releaseAuthority?.containerDockerfile) === 'infra/docker/Dockerfile.api', 'Canonical container Dockerfile must be infra/docker/Dockerfile.api.');
check(errors, JSON.stringify(scope.releaseAuthority?.iacRoots ?? []) === JSON.stringify(['infra/docker']), 'Blocking IaC scope must remain explicit until #2606 closes.');
check(errors, scope.releaseAuthority?.dependencyPolicy === 'all-workspace-production-dependencies', 'Dependency policy must cover all production dependencies in the workspace.');
check(errors, scope.releaseAuthority?.secretScanRoot === '.', 'Secret scan must cover the complete repository.');

for (const path of [...sourceRoots, scope.releaseAuthority?.containerDockerfile, ...(scope.releaseAuthority?.iacRoots ?? [])]) {
  check(errors, existsSync(resolve(ROOT, normalizePath(path))), `Release security scope path does not exist: ${path}`);
}

const deferred = Array.isArray(scope.deferredContours) ? scope.deferredContours : [];
const deferredPaths = new Set();
for (const contour of deferred) {
  const path = normalizePath(contour?.path);
  const expiresAt = new Date(contour?.expiresAt ?? 'invalid');
  check(errors, REQUIRED_DEFERRED.has(path), `Unexpected deferred contour: ${path || '<missing>'}`);
  check(errors, !deferredPaths.has(path), `Duplicate deferred contour: ${path}`);
  deferredPaths.add(path);
  check(errors, existsSync(resolve(ROOT, path)), `Deferred contour path does not exist: ${path}`);
  check(errors, ['OUT_OF_RELEASE_SCOPE', 'NOT_DEPLOYABLE'].includes(contour?.status), `${path}: invalid deferred status.`);
  check(errors, contour?.ticket === REQUIRED_DEFERRED.get(path), `${path}: must be governed by ${REQUIRED_DEFERRED.get(path)}.`);
  check(errors, typeof contour?.reason === 'string' && contour.reason.length >= 30, `${path}: reason is too short.`);
  check(errors, !Number.isNaN(expiresAt.getTime()) && expiresAt > now, `${path}: deferred contour expiry is missing or expired.`);
  for (const activePath of [...sourceRoots, ...(scope.releaseAuthority?.iacRoots ?? [])]) {
    check(errors, !overlaps(path, activePath), `${path}: deferred contour overlaps active release scope ${activePath}.`);
  }
}
for (const [path] of REQUIRED_DEFERRED) check(errors, deferredPaths.has(path), `Required deferred contour is missing: ${path}`);

const exceptions = Array.isArray(registry.exceptions) ? registry.exceptions : [];
const ids = new Set();
const findingKeys = new Set();
const trivyExceptions = {
  'trivy-container': [],
  'trivy-filesystem': [],
  'trivy-iac': [],
};

for (const exception of exceptions) {
  const id = String(exception?.id ?? '');
  const scanner = String(exception?.scanner ?? '');
  const findingId = String(exception?.findingId ?? '');
  const createdAt = new Date(exception?.createdAt ?? 'invalid');
  const expiresAt = new Date(exception?.expiresAt ?? 'invalid');
  const durationDays = (expiresAt.getTime() - createdAt.getTime()) / 86_400_000;
  const scopeKey = JSON.stringify({ paths: exception?.paths ?? [], purls: exception?.purls ?? [] });
  const findingKey = `${scanner}:${findingId}:${scopeKey}`;

  check(errors, /^SEC-[0-9]{4}-[0-9]{3,}$/.test(id), `${id || '<missing>'}: invalid exception id.`);
  check(errors, !ids.has(id), `${id}: duplicate exception id.`);
  ids.add(id);
  check(errors, ALLOWED_SCANNERS.has(scanner), `${id}: unsupported scanner ${scanner}.`);
  check(errors, findingId.length >= 3, `${id}: findingId is required.`);
  check(errors, !findingKeys.has(findingKey), `${id}: duplicate scoped finding ${findingKey}.`);
  findingKeys.add(findingKey);
  check(errors, exception?.severity === 'HIGH', `${id}: only HIGH findings may be excepted.`);
  check(errors, typeof exception?.owner === 'string' && exception.owner.trim().length >= 2, `${id}: owner is required.`);
  check(errors, typeof exception?.approvedBy === 'string' && exception.approvedBy.trim().length >= 2, `${id}: approvedBy is required.`);
  check(errors, /^#[0-9]+$/.test(String(exception?.ticket ?? '')), `${id}: ticket must reference a GitHub issue.`);
  check(errors, typeof exception?.rationale === 'string' && exception.rationale.trim().length >= 20, `${id}: rationale is too short.`);
  check(errors, !Number.isNaN(createdAt.getTime()), `${id}: createdAt must be ISO date-time.`);
  check(errors, !Number.isNaN(expiresAt.getTime()), `${id}: expiresAt must be ISO date-time.`);
  check(errors, durationDays > 0 && durationDays <= MAX_EXCEPTION_DAYS, `${id}: exception duration must be 1-${MAX_EXCEPTION_DAYS} days.`);
  check(errors, expiresAt.getTime() > now.getTime(), `${id}: exception expired at ${exception?.expiresAt}.`);

  if (scanner.startsWith('trivy-')) {
    check(errors, TRIVY_TYPES.has(exception?.findingType), `${id}: Trivy exception requires findingType.`);
    for (const path of exception?.paths ?? []) check(errors, typeof path === 'string' && path.length > 0, `${id}: invalid path scope.`);
    for (const purl of exception?.purls ?? []) check(errors, /^pkg:/.test(purl), `${id}: invalid PURL scope.`);
    trivyExceptions[scanner].push(exception);
  } else {
    check(errors, exception?.findingType === undefined, `${id}: pnpm-audit exceptions must not set findingType.`);
    check(errors, exception?.paths === undefined && exception?.purls === undefined, `${id}: pnpm-audit exceptions are keyed by advisory ID, not paths.`);
  }
}

const forbiddenWorkflowPatterns = [
  [/\|\|\s*true/g, 'blocking workflow must not suppress failures with || true'],
  [/continue-on-error:\s*true/g, 'blocking workflow must not use continue-on-error: true'],
  [/@master\b/g, 'GitHub Actions must not use mutable @master refs'],
  [/apps\/api\/Dockerfile/g, 'workflow must build the canonical infra/docker/Dockerfile.api'],
  [/--ignore-registry-errors\b/g, 'dependency audit must fail closed on registry or scanner errors'],
];
for (const [pattern, message] of forbiddenWorkflowPatterns) if (pattern.test(workflow)) errors.push(message);

const zeroExitCodes = workflow.match(/exit-code:\s*['"]?0['"]?/g) ?? [];
check(errors, zeroExitCodes.length === 1, 'Exactly one Trivy exit-code 0 collector is allowed; all other scanner gates must remain blocking.');

const requiredWorkflowFragments = [
  'ref: ${{ env.EXACT_HEAD }}',
  'infra/docker/Dockerfile.api',
  'aquasecurity/trivy-action@v0.36.0',
  "exit-code: '0'",
  "exit-code: '1'",
  'id: collect-container',
  'format: json',
  'trivy-container.json',
  'trivy-container-evaluation.json',
  'TRIVY_SCAN_RESULT: ${{ steps.collect-container.outcome }}',
  'evaluate-trivy-report.mjs',
  'trivy convert',
  '--format sarif',
  'scan-type: config',
  'scan-ref: infra/docker',
  'scanners: secret',
  "AUDIT_PNPM_VERSION: '11.0.0-rc.2'",
  'pnpm dlx pnpm@${AUDIT_PNPM_VERSION} audit --prod --json',
  'docs/platform-v7/autopilot/semgrep-security.yml',
  'check-security-release-gate.mjs',
  'evaluate-pnpm-audit.mjs',
  'Security Gate · all blocking checks',
  'security-events: write',
];
for (const fragment of requiredWorkflowFragments) check(errors, workflow.includes(fragment), `Security workflow is missing required fragment: ${fragment}`);

check(errors, existsSync(SEMGREP_PATH), 'Deterministic local Semgrep policy is missing.');
check(errors, existsSync(TRIVY_EVALUATOR_PATH), 'Fail-closed Trivy report evaluator is missing.');
check(errors, existsSync(resolve('infra/docker/Dockerfile.api')), 'Canonical API Dockerfile is missing.');
check(errors, existsSync(resolve('docker-compose.yml')), 'Local production-like topology definition is missing.');

mkdirSync(dirname(REPORT_PATH), { recursive: true });
mkdirSync(IGNORE_DIR, { recursive: true });
const generatedIgnorePaths = {};
for (const [scanner, entries] of Object.entries(trivyExceptions)) {
  const path = resolve(IGNORE_DIR, `.trivyignore-${scanner}.yaml`);
  writeFileSync(path, yamlDocument(entries));
  generatedIgnorePaths[scanner] = path.replace(`${ROOT}/`, '');
}

if (exceptions.length === 0) warnings.push('No active HIGH security exceptions.');

const report = {
  schemaVersion: 1,
  repository: 'pachaninm-lab/pachanin-demo',
  validatedCommit,
  validatedAt: new Date().toISOString(),
  valid: errors.length === 0,
  policy: {
    criticalExceptionsAllowed: false,
    maximumExceptionDays: MAX_EXCEPTION_DAYS,
  },
  releaseAuthority: scope.releaseAuthority,
  deferredContours: deferred,
  activeExceptions: exceptions.map(({ id, scanner, findingType, findingId, paths, purls, severity, owner, approvedBy, ticket, expiresAt }) => ({
    id,
    scanner,
    findingType,
    findingId,
    paths,
    purls,
    severity,
    owner,
    approvedBy,
    ticket,
    expiresAt,
  })),
  generatedIgnorePaths,
  errors,
  warnings,
};
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (errors.length > 0) {
  console.error(`Security release policy is invalid (${errors.length} error(s)).`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Security release policy is valid at ${validatedCommit}.`);
console.log(`Active HIGH exceptions: ${exceptions.length}. Critical exceptions: forbidden.`);
console.log(`Deferred non-release contours: ${deferred.length}.`);
console.log(`Policy report: ${REPORT_PATH}`);
