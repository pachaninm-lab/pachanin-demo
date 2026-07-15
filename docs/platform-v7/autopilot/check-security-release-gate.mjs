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
const BULK_AUDIT_COLLECTOR_PATH = resolve('docs/platform-v7/autopilot/collect-npm-bulk-audit.mjs');
const RUNTIME_VALIDATOR_PATH = resolve('scripts/security/validate-runtime-contexts.mjs');
const OPTIONAL_RUNTIME_INVENTORY_PATH = resolve('docs/platform-v7/autopilot/optional-runtime-inventory.json');
const OPTIONAL_RUNTIME_VALIDATOR_PATH = resolve('scripts/security/validate-optional-runtime-retirement.mjs');
const WORKFLOW_PATH = resolve('.github/workflows/security-quality-gate.yml');
const RUNTIME_WORKFLOW_PATH = resolve('.github/workflows/runtime-context-security-gate.yml');
const OPTIONAL_RUNTIME_WORKFLOW_PATH = resolve('.github/workflows/optional-runtime-retirement-gate.yml');
const REPORT_PATH = resolve(process.env.SECURITY_POLICY_REPORT ?? 'artifacts/security/security-policy-validation.json');
const IGNORE_DIR = resolve(process.env.TRIVY_IGNORE_DIR ?? 'artifacts/security');
const EXACT_HEAD = String(process.env.SECURITY_EXACT_HEAD ?? '').trim();
const MAX_EXCEPTION_DAYS = 90;

const ALLOWED_SCANNERS = new Set([
  'trivy-container',
  'trivy-web-container',
  'trivy-filesystem',
  'trivy-iac',
  'pnpm-audit',
]);
const TRIVY_TYPES = new Set(['vulnerability', 'misconfiguration', 'secret']);
const TRIVY_TYPE_KEYS = new Map([
  ['vulnerability', 'vulnerabilities'],
  ['misconfiguration', 'misconfigurations'],
  ['secret', 'secrets'],
]);
const REQUIRED_SOURCE_ROOTS = ['apps/api/src', 'apps/web/app', 'apps/web/lib', 'workers', 'packages'];
const REQUIRED_CONTAINER_DOCKERFILES = ['infra/docker/Dockerfile.api', 'infra/docker/Dockerfile.web'];
const REQUIRED_IAC_ROOTS = ['infra/docker', 'infra/helm', 'infra/k8s'];
const REQUIRED_RETIRED = new Map([
  ['apps/ml', 'ml-service'],
  ['infra/airflow', 'airflow-orchestration'],
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

function requireFragments(errors, source, fragments, label) {
  for (const fragment of fragments) {
    check(errors, source.includes(fragment), `${label} is missing required fragment: ${fragment}`);
  }
}

const errors = [];
const warnings = [];
const validatedCommit = headSha();
const registry = parseJson(EXCEPTIONS_PATH);
const schema = parseJson(SCHEMA_PATH);
const scope = parseJson(SCOPE_PATH);
const optionalRuntimeInventory = parseJson(OPTIONAL_RUNTIME_INVENTORY_PATH);
const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
const runtimeWorkflow = readFileSync(RUNTIME_WORKFLOW_PATH, 'utf8');
const optionalRuntimeWorkflow = readFileSync(OPTIONAL_RUNTIME_WORKFLOW_PATH, 'utf8');
const runtimeValidator = readFileSync(RUNTIME_VALIDATOR_PATH, 'utf8');
const optionalRuntimeValidator = readFileSync(OPTIONAL_RUNTIME_VALIDATOR_PATH, 'utf8');
const bulkAuditCollector = readFileSync(BULK_AUDIT_COLLECTOR_PATH, 'utf8');
const combinedWorkflows = `${workflow}\n${runtimeWorkflow}\n${optionalRuntimeWorkflow}`;
const now = new Date();

check(errors, /^[0-9a-f]{40}$/i.test(EXACT_HEAD), 'SECURITY_EXACT_HEAD must be a full commit SHA.');
check(errors, validatedCommit === EXACT_HEAD, `Checked out commit ${validatedCommit} does not match exact head ${EXACT_HEAD}.`);
check(errors, schema?.properties?.schemaVersion?.const === 1, 'Security exception schema version must remain 1.');
check(errors, schema?.properties?.exceptions?.items?.properties?.scanner?.enum?.includes('trivy-web-container'), 'Security exception schema must govern the web container scanner.');
check(errors, registry.schemaVersion === 1, 'Security exception registry schemaVersion must equal 1.');
check(errors, registry.policy?.criticalExceptionsAllowed === false, 'Critical vulnerability exceptions are forbidden.');
check(errors, registry.policy?.maximumExceptionDays === MAX_EXCEPTION_DAYS, `maximumExceptionDays must equal ${MAX_EXCEPTION_DAYS}.`);
check(errors, Array.isArray(registry.exceptions), 'exceptions must be an array.');

check(errors, scope.schemaVersion === 1, 'Security release scope schemaVersion must equal 1.');
const sourceRoots = (scope.releaseAuthority?.sourceRoots ?? []).map(normalizePath);
const containerDockerfiles = (scope.releaseAuthority?.containerDockerfiles ?? []).map(normalizePath);
const iacRoots = (scope.releaseAuthority?.iacRoots ?? []).map(normalizePath);
check(errors, JSON.stringify(sourceRoots) === JSON.stringify(REQUIRED_SOURCE_ROOTS), 'Release source roots must match the governed canonical list.');
check(errors, normalizePath(scope.releaseAuthority?.containerDockerfile) === 'infra/docker/Dockerfile.api', 'Primary canonical container Dockerfile must remain infra/docker/Dockerfile.api.');
check(errors, JSON.stringify(containerDockerfiles) === JSON.stringify(REQUIRED_CONTAINER_DOCKERFILES), 'Canonical container Dockerfiles must be API and web only.');
check(errors, normalizePath(scope.releaseAuthority?.runtimeInventory) === 'infra/docker/runtime-inventory.json', 'Runtime inventory must be infra/docker/runtime-inventory.json.');
check(errors, normalizePath(scope.releaseAuthority?.optionalRuntimeInventory) === 'docs/platform-v7/autopilot/optional-runtime-inventory.json', 'Optional runtime inventory must be governed explicitly.');
check(errors, JSON.stringify(iacRoots) === JSON.stringify(REQUIRED_IAC_ROOTS), 'Blocking IaC scope must cover Docker, Helm and Kubernetes roots.');
check(errors, scope.releaseAuthority?.dependencyPolicy === 'all-workspace-production-dependencies', 'Dependency policy must cover all production dependencies in the workspace.');
check(errors, scope.releaseAuthority?.secretScanRoot === '.', 'Secret scan must cover the complete repository.');

for (const path of [
  ...sourceRoots,
  ...containerDockerfiles,
  scope.releaseAuthority?.runtimeInventory,
  scope.releaseAuthority?.optionalRuntimeInventory,
  ...iacRoots,
]) {
  check(errors, existsSync(resolve(ROOT, normalizePath(path))), `Release security scope path does not exist: ${path}`);
}
for (const retiredDockerfile of ['infra/docker/Dockerfile.worker', 'infra/docker/Dockerfile.ml']) {
  check(errors, !existsSync(resolve(ROOT, retiredDockerfile)), `${retiredDockerfile} must not remain deployable.`);
}

const deferred = Array.isArray(scope.deferredContours) ? scope.deferredContours : [];
check(errors, deferred.length === 0, 'Optional runtime contours must not remain temporary deferred exceptions.');
const retired = Array.isArray(scope.retiredContours) ? scope.retiredContours : [];
const retiredPaths = new Set();
const inventoryContours = Array.isArray(optionalRuntimeInventory.contours) ? optionalRuntimeInventory.contours : [];
const inventoryById = new Map(inventoryContours.map((contour) => [contour?.id, contour]));
check(errors, optionalRuntimeInventory.schemaVersion === 1, 'Optional runtime inventory schemaVersion must equal 1.');
check(errors, optionalRuntimeInventory.repository === 'pachaninm-lab/pachanin-demo', 'Optional runtime inventory repository identity is invalid.');
check(errors, optionalRuntimeInventory.decisionIssue === '#2605', 'Optional runtime inventory must remain governed by #2605.');
check(errors, optionalRuntimeInventory.decisionStatus === 'RETIRED_UNTIL_REQUALIFIED', 'Optional runtime retirement decision status is invalid.');
check(errors, inventoryContours.length === REQUIRED_RETIRED.size, 'Optional runtime inventory must contain exactly two retired contours.');

for (const contour of retired) {
  const path = normalizePath(contour?.path);
  const expectedId = REQUIRED_RETIRED.get(path);
  check(errors, Boolean(expectedId), `Unexpected retired contour: ${path || '<missing>'}`);
  check(errors, !retiredPaths.has(path), `Duplicate retired contour: ${path}`);
  retiredPaths.add(path);
  check(errors, contour?.status === 'NOT_DEPLOYABLE', `${path}: retired contour must be NOT_DEPLOYABLE.`);
  check(errors, contour?.ticket === '#2605', `${path}: retired contour must be governed by #2605.`);
  check(errors, contour?.inventoryId === expectedId, `${path}: inventoryId must be ${expectedId}.`);
  check(errors, typeof contour?.reason === 'string' && contour.reason.length >= 60, `${path}: retirement reason is too short.`);
  for (const activePath of [...sourceRoots, ...iacRoots]) {
    check(errors, !overlaps(path, activePath), `${path}: retired contour overlaps active release scope ${activePath}.`);
  }

  const inventory = inventoryById.get(expectedId);
  check(errors, inventory?.path === path, `${path}: optional runtime inventory path mismatch.`);
  check(errors, inventory?.status === 'NOT_DEPLOYABLE', `${path}: inventory status must be NOT_DEPLOYABLE.`);
  check(errors, inventory?.releaseAuthority === false, `${path}: optional runtime must not be release authority.`);
  check(errors, inventory?.runtimeEntrypoint === null, `${path}: runtimeEntrypoint must be null.`);
  check(errors, inventory?.dependencyManifest === null, `${path}: dependencyManifest must be null.`);
  check(errors, inventory?.containerDockerfile === null, `${path}: containerDockerfile must be null.`);
  check(errors, inventory?.deploymentManifest === null, `${path}: deploymentManifest must be null.`);
  check(errors, Array.isArray(inventory?.reactivationGate) && inventory.reactivationGate.length >= 6, `${path}: reactivation gate is incomplete.`);
}
for (const [path] of REQUIRED_RETIRED) {
  check(errors, retiredPaths.has(path), `Required retired contour is missing: ${path}`);
}

const exceptions = Array.isArray(registry.exceptions) ? registry.exceptions : [];
const ids = new Set();
const findingKeys = new Set();
const trivyExceptions = {
  'trivy-container': [],
  'trivy-web-container': [],
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
    if (trivyExceptions[scanner]) trivyExceptions[scanner].push(exception);
  } else {
    check(errors, exception?.findingType === undefined, `${id}: pnpm-audit exceptions must not set findingType.`);
    check(errors, exception?.paths === undefined && exception?.purls === undefined, `${id}: pnpm-audit exceptions are keyed by advisory ID, not paths.`);
  }
}

const forbiddenWorkflowPatterns = [
  [/\|\|\s*true/g, 'blocking workflows must not suppress failures with || true'],
  [/continue-on-error:\s*true/g, 'blocking workflows must not use continue-on-error: true'],
  [/@master\b/g, 'GitHub Actions must not use mutable @master refs'],
  [/apps\/api\/Dockerfile/g, 'workflows must build canonical infra/docker Dockerfiles'],
];
for (const [pattern, message] of forbiddenWorkflowPatterns) {
  if (pattern.test(combinedWorkflows)) errors.push(message);
}
const zeroExitCodes = combinedWorkflows.match(/exit-code:\s*['"]?0['"]?/g) ?? [];
check(errors, zeroExitCodes.length === 3, 'Exactly three Trivy exit-code 0 collectors are allowed: base API, runtime API and runtime web; all are evaluated fail closed.');

requireFragments(errors, workflow, [
  'ref: ${{ env.EXACT_HEAD }}',
  'infra/docker/Dockerfile.api',
  'aquasecurity/trivy-action@v0.36.0',
  "exit-code: '0'",
  "exit-code: '1'",
  'id: collect-container',
  'trivy-container-evaluation.json',
  'evaluate-trivy-report.mjs',
  'scan-ref: infra/docker',
  'scanners: secret',
  'pnpm -r list --prod --json --depth Infinity',
  'collect-npm-bulk-audit.mjs',
  'evaluate-pnpm-audit.mjs',
  'Security Gate · all blocking checks',
  'security-events: write',
], 'Security workflow');

requireFragments(errors, runtimeWorkflow, [
  'Runtime Context Security Gate',
  'scripts/security/validate-runtime-contexts.mjs',
  'runtime-context-validation.json',
  'infra/docker/Dockerfile.api',
  'infra/docker/Dockerfile.web',
  'id: collect-api',
  'id: collect-web',
  'TRIVY_SCANNER: trivy-container',
  'TRIVY_SCANNER: trivy-web-container',
  'trivy-api-container-evaluation.json',
  'trivy-web-container-evaluation.json',
  'cp -R infra/docker',
  'cp -R infra/helm',
  'cp -R infra/k8s',
  'Runtime Context Gate · all blocking checks',
], 'Runtime context workflow');

requireFragments(errors, optionalRuntimeWorkflow, [
  'Optional Runtime Retirement Gate',
  'scripts/security/validate-optional-runtime-retirement.mjs',
  'optional-runtime-retirement.json',
  'ML_RUNTIME_NOT_DEPLOYABLE:#2605',
  'helm template grainflow',
  'trivy-retired-source.sarif',
  'Optional Runtime Gate · all blocking checks',
], 'Optional runtime workflow');

requireFragments(errors, runtimeValidator, [
  'RUNTIME_CONTEXT_EXACT_HEAD',
  'runtime-inventory.json',
  'Dockerfile.worker',
  'Dockerfile.ml',
  'privileged container',
  'platform.prozrachnaya-cena/status: NOT_DEPLOYABLE',
  'readOnlyRootFilesystem: true',
  'seccompProfile:',
], 'Runtime context validator');

requireFragments(errors, optionalRuntimeValidator, [
  'OPTIONAL_RUNTIME_EXACT_HEAD',
  'optional-runtime-inventory.json',
  'apps/ml/requirements.txt',
  'infra/airflow/requirements.txt',
  'infra/docker/Dockerfile.ml',
  'ML_RUNTIME_NOT_DEPLOYABLE:#2605',
  'Dockerfile.ml reference',
  'NOT_DEPLOYABLE',
], 'Optional runtime validator');

requireFragments(errors, bulkAuditCollector, [
  '/-/npm/v1/security/advisories/bulk',
  "method: 'POST'",
  'AbortSignal.timeout(30_000)',
  'NPM_BULK_AUDIT_FAILURE',
  'auditReportVersion: 3',
  'vulnerable_versions',
  'severity',
], 'npm Bulk Advisory collector');

for (const [path, label] of [
  [SEMGREP_PATH, 'Deterministic local Semgrep policy'],
  [TRIVY_EVALUATOR_PATH, 'Fail-closed Trivy report evaluator'],
  [BULK_AUDIT_COLLECTOR_PATH, 'Fail-closed npm Bulk Advisory collector'],
  [RUNTIME_VALIDATOR_PATH, 'Fail-closed runtime context validator'],
  [OPTIONAL_RUNTIME_INVENTORY_PATH, 'Optional runtime inventory'],
  [OPTIONAL_RUNTIME_VALIDATOR_PATH, 'Fail-closed optional runtime validator'],
  [RUNTIME_WORKFLOW_PATH, 'Blocking runtime context workflow'],
  [OPTIONAL_RUNTIME_WORKFLOW_PATH, 'Blocking optional runtime retirement workflow'],
]) {
  check(errors, existsSync(path), `${label} is missing.`);
}
for (const dockerfile of REQUIRED_CONTAINER_DOCKERFILES) {
  check(errors, existsSync(resolve(dockerfile)), `Canonical Dockerfile is missing: ${dockerfile}`);
}
check(errors, existsSync(resolve('infra/docker/runtime-inventory.json')), 'Runtime inventory is missing.');
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
  retiredContours: retired,
  optionalRuntimeInventory,
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
console.log(`Canonical runtime images: ${containerDockerfiles.length}. Active IaC roots: ${iacRoots.length}.`);
console.log(`Active HIGH exceptions: ${exceptions.length}. Critical exceptions: forbidden.`);
console.log(`Deferred non-release contours: ${deferred.length}. Retired optional contours: ${retired.length}.`);
console.log(`Policy report: ${REPORT_PATH}`);
