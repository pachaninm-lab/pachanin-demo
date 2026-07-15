#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve('.');
const EXACT_HEAD = String(process.env.OPTIONAL_RUNTIME_EXACT_HEAD ?? '').trim();
const REPORT_PATH = resolve(
  process.env.OPTIONAL_RUNTIME_REPORT
    ?? 'artifacts/optional-runtime/optional-runtime-retirement.json',
);
const INVENTORY_PATH = 'docs/platform-v7/autopilot/optional-runtime-inventory.json';
const SCOPE_PATH = 'docs/platform-v7/autopilot/security-release-scope.json';
const violations = [];
const checkedFiles = new Set();

function absolute(path) {
  return resolve(ROOT, path);
}

function read(path) {
  const target = absolute(path);
  if (!existsSync(target) || !statSync(target).isFile()) {
    violations.push(`${path}: required file is missing.`);
    return '';
  }
  checkedFiles.add(path);
  return readFileSync(target, 'utf8');
}

function parse(path, label) {
  const source = read(path);
  try {
    return JSON.parse(source);
  } catch (error) {
    violations.push(`${path}: invalid ${label} JSON: ${error instanceof Error ? error.message : String(error)}.`);
    return {};
  }
}

function walk(path) {
  const target = absolute(path);
  if (!existsSync(target)) return [];
  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = join(target, entry.name);
    return entry.isDirectory()
      ? walk(relative(ROOT, child))
      : [relative(ROOT, child).replaceAll('\\', '/')];
  });
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(absolute(path))).digest('hex');
}

function requireFragments(path, fragments) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) violations.push(`${path}: missing required fragment ${JSON.stringify(fragment)}.`);
  }
}

function forbidPatterns(path, entries) {
  const source = read(path);
  for (const [pattern, label] of entries) {
    if (pattern.test(source)) violations.push(`${path}: forbidden ${label}.`);
  }
}

function requireAbsent(path) {
  if (existsSync(absolute(path))) violations.push(`${path}: retired runtime authority must remain absent.`);
}

function validateInventory() {
  const inventory = parse(INVENTORY_PATH, 'optional runtime inventory');
  if (inventory.schemaVersion !== 1 || inventory.repository !== 'pachaninm-lab/pachanin-demo') {
    violations.push(`${INVENTORY_PATH}: invalid schema or repository identity.`);
  }
  if (inventory.decisionIssue !== '#2605') violations.push(`${INVENTORY_PATH}: decisionIssue must remain #2605.`);
  const contours = Array.isArray(inventory.contours) ? inventory.contours : [];
  const expected = new Map([
    ['ml-service', 'apps/ml'],
    ['airflow-orchestration', 'infra/airflow'],
  ]);
  if (contours.length !== expected.size) violations.push(`${INVENTORY_PATH}: exactly two retired contours are required.`);
  for (const contour of contours) {
    if (expected.get(contour.id) !== contour.path
      || contour.status !== 'NOT_DEPLOYABLE'
      || contour.releaseAuthority !== false
      || contour.runtimeEntrypoint !== null
      || contour.dependencyManifest !== null
      || contour.containerDockerfile !== null
      || contour.deploymentManifest !== null
      || !Array.isArray(contour.reactivationGate)
      || contour.reactivationGate.length < 6) {
      violations.push(`${INVENTORY_PATH}: invalid retired contour ${contour.id ?? '<missing>'}.`);
    }
  }
}

function validateScope() {
  const scope = parse(SCOPE_PATH, 'security release scope');
  if (scope.releaseAuthority?.optionalRuntimeInventory !== INVENTORY_PATH) {
    violations.push(`${SCOPE_PATH}: optionalRuntimeInventory must point to ${INVENTORY_PATH}.`);
  }
  if (!Array.isArray(scope.deferredContours) || scope.deferredContours.length !== 0) {
    violations.push(`${SCOPE_PATH}: #2605 contours must not remain temporary deferred exceptions.`);
  }
  const retired = Array.isArray(scope.retiredContours) ? scope.retiredContours : [];
  const expected = new Map([
    ['apps/ml', 'ml-service'],
    ['infra/airflow', 'airflow-orchestration'],
  ]);
  if (retired.length !== expected.size) violations.push(`${SCOPE_PATH}: exactly two retired contours are required.`);
  for (const contour of retired) {
    if (expected.get(contour.path) !== contour.inventoryId
      || contour.status !== 'NOT_DEPLOYABLE'
      || contour.ticket !== '#2605'
      || typeof contour.reason !== 'string'
      || contour.reason.length < 60) {
      violations.push(`${SCOPE_PATH}: invalid retired contour ${contour.path ?? '<missing>'}.`);
    }
  }
}

function validateRemovedAuthorities() {
  for (const path of [
    'apps/ml/requirements.txt',
    'infra/docker/Dockerfile.ml',
    '.github/workflows/ml-ci.yml',
    'infra/airflow/requirements.txt',
  ]) requireAbsent(path);

  const airflowPython = walk('infra/airflow/dags').filter((path) => path.endsWith('.py'));
  if (airflowPython.length > 0) {
    violations.push(`infra/airflow/dags: executable Python DAGs remain: ${airflowPython.join(', ')}.`);
  }
}

function validateMlReference() {
  requireFragments('apps/ml/main.py', [
    'RUNTIME_STATUS',
    '"status": "NOT_DEPLOYABLE"',
    '"ticket": "#2605"',
    '"releaseAuthority": False',
    'raise RuntimeError("ML_RUNTIME_NOT_DEPLOYABLE:#2605")',
  ]);
  forbidPatterns('apps/ml/main.py', [
    [/\bfrom\s+fastapi\b|\bimport\s+fastapi\b/, 'FastAPI runtime import'],
    [/\bapp\s*=\s*FastAPI\s*\(/, 'FastAPI application entrypoint'],
    [/uvicorn/, 'Uvicorn runtime entrypoint'],
  ]);
}

function validateStatusManifest(path, component) {
  requireFragments(path, [
    'kind: ConfigMap',
    'platform.prozrachnaya-cena/deployable: "false"',
    'platform.prozrachnaya-cena/status: NOT_DEPLOYABLE',
    'platform.prozrachnaya-cena/ticket: "#2605"',
    'status: NOT_DEPLOYABLE',
  ]);
  forbidPatterns(path, [
    [/kind:\s*Deployment/, `${component} Deployment`],
    [/kind:\s*StatefulSet/, `${component} StatefulSet`],
    [/kind:\s*Service\b/, `${component} Service`],
    [/kind:\s*Job\b/, `${component} Job`],
    [/kind:\s*CronJob\b/, `${component} CronJob`],
    [/image:\s*[^\n]+/, `${component} container image`],
  ]);
}

function validateDeliveryWorkflows() {
  requireFragments('.github/workflows/docker-publish.yml', [
    'Build & Publish Canonical Docker Images',
    'infra/docker/Dockerfile.api',
    'infra/docker/Dockerfile.web',
    'Canonical services to build: api, web or all',
  ]);
  forbidPatterns('.github/workflows/docker-publish.yml', [
    [/Dockerfile\.ml/, 'ML Dockerfile publisher'],
    [/build-ml/, 'ML image job'],
    [/grainflow\/ml|grainflow-ml/, 'ML image tag'],
    [/apps\/ml/, 'ML trigger'],
    [/\|\|\s*true|continue-on-error:\s*true/, 'suppressed failure'],
  ]);

  requireFragments('.github/workflows/sbom-scan.yml', [
    'Canonical SBOM Generation',
    'service: [api, web]',
    'pnpm install --frozen-lockfile',
    'if-no-files-found: error',
  ]);
  forbidPatterns('.github/workflows/sbom-scan.yml', [
    [/apps\/ml|sbom-ml|Dockerfile\.ml/, 'ML SBOM or image authority'],
    [/@master\b/, 'mutable action reference'],
    [/\|\|\s*(?:true|echo)|continue-on-error:\s*true/, 'suppressed failure'],
  ]);

  for (const path of walk('.github/workflows')) {
    const source = read(path);
    for (const [pattern, label] of [
      [/infra\/docker\/Dockerfile\.ml/, 'ML Dockerfile reference'],
      [/apps\/ml\/requirements\.txt/, 'ML requirements reference'],
      [/infra\/airflow\/requirements\.txt/, 'Airflow requirements reference'],
    ]) {
      if (pattern.test(source)) violations.push(`${path}: forbidden retired ${label}.`);
    }
  }
}

function validateCompose() {
  const compose = read('docker-compose.yml');
  for (const [pattern, label] of [
    [/Dockerfile\.ml/, 'ML Dockerfile'],
    [/infra\/airflow/, 'Airflow runtime path'],
    [/apache\/airflow|apache-airflow/, 'Airflow image or package'],
    [/uvicorn\s+main:app/, 'ML runtime command'],
  ]) {
    if (pattern.test(compose)) violations.push(`docker-compose.yml: retired ${label} remains executable.`);
  }
}

function validateResidualHelmReferences() {
  for (const path of [
    'infra/helm/grainflow/templates/networkpolicy.yaml',
    'infra/helm/grainflow/templates/servicemonitor.yaml',
  ]) {
    forbidPatterns(path, [
      [/grainflow-ml/, 'reference to retired ML workload'],
      [/app\.kubernetes\.io\/name:\s*grainflow-ml/, 'selector for retired ML workload'],
    ]);
  }
}

function main() {
  const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/i.test(EXACT_HEAD)) violations.push('OPTIONAL_RUNTIME_EXACT_HEAD must be a full commit SHA.');
  if (EXACT_HEAD !== actualHead) violations.push(`Checked out commit ${actualHead} does not match exact head ${EXACT_HEAD}.`);

  validateInventory();
  validateScope();
  validateRemovedAuthorities();
  validateMlReference();
  validateStatusManifest('infra/k8s/base/ml-deployment.yml', 'Kubernetes ML');
  validateStatusManifest('infra/helm/grainflow/templates/ml-deployment.yaml', 'Helm ML');
  validateDeliveryWorkflows();
  validateCompose();
  validateResidualHelmReferences();

  const report = {
    schemaVersion: 1,
    repository: 'pachaninm-lab/pachanin-demo',
    commitSha: actualHead,
    generatedAt: new Date().toISOString(),
    retiredContours: ['ml-service', 'airflow-orchestration'],
    executableEntrypoints: 0,
    dependencyManifests: 0,
    containerDockerfiles: 0,
    deploymentWorkloads: 0,
    residualHelmReferences: 0,
    checkedFiles: [...checkedFiles].sort().map((path) => ({ path, sha256: sha256(path) })),
    violations,
    passed: violations.length === 0,
  };
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  if (!report.passed) {
    console.error('Optional runtime retirement validation failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }
  console.log(`Optional runtime retirement accepted ${report.checkedFiles.length} evidence files at ${actualHead}.`);
}

main();
