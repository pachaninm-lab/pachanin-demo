#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const INPUT_DIR = resolve(process.env.RUNTIME_SECURITY_INPUT_DIR ?? 'artifacts/runtime-evidence-input');
const OUTPUT_PATH = resolve(process.env.RUNTIME_SECURITY_MANIFEST ?? 'artifacts/runtime-security/runtime-security-manifest.json');
const EXACT_HEAD = String(process.env.RUNTIME_SECURITY_EXACT_HEAD ?? '').trim();
const WORKFLOW_RUN_ID = String(process.env.RUNTIME_SECURITY_WORKFLOW_RUN_ID ?? '').trim();
const WORKFLOW_RUN_ATTEMPT = String(process.env.RUNTIME_SECURITY_WORKFLOW_RUN_ATTEMPT ?? '').trim();

const REQUIRED_FILES = [
  'runtime-context-validation.json',
  'helm-lint.txt',
  'helm-rendered.yaml',
  'api-image-digest.txt',
  'web-image-digest.txt',
  'api-image-user.txt',
  'web-image-user.txt',
  'trivy-api-container.json',
  'trivy-api-container-evaluation.json',
  'trivy-api-container.sarif',
  'trivy-web-container.json',
  'trivy-web-container-evaluation.json',
  'trivy-web-container.sarif',
  'trivy-runtime-iac.sarif',
];

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is missing or invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function requireExactHead(report, label) {
  const commit = String(report?.commitSha ?? report?.validatedCommit ?? '');
  if (commit !== EXACT_HEAD) throw new Error(`${label} commit identity ${commit || '<missing>'} does not match ${EXACT_HEAD}.`);
}

function requirePassed(report, label) {
  const passed = report?.passed ?? report?.valid;
  if (passed !== true) throw new Error(`${label} is not marked passed or valid.`);
}

function requireAcceptedTrivyEvaluation(report, label, expectedScanner) {
  requireExactHead(report, label);
  requirePassed(report, label);
  if (String(report?.scanner ?? '') !== expectedScanner) {
    throw new Error(`${label} scanner identity ${String(report?.scanner ?? '<missing>')} does not match ${expectedScanner}.`);
  }
  if (report?.scannerResult !== 'success') throw new Error(`${label} scanner result is not success.`);
  if (report?.recognizedReportShape !== true) throw new Error(`${label} scanner report shape is not recognized.`);

  const blocked = Array.isArray(report?.blocked) ? report.blocked : null;
  const excepted = Array.isArray(report?.excepted) ? report.excepted : null;
  const findings = Array.isArray(report?.findings) ? report.findings : null;
  if (!blocked || !excepted || !findings) throw new Error(`${label} finding arrays are missing.`);

  const highOrCritical = Number(report?.summary?.highOrCritical);
  const summaryBlocked = Number(report?.summary?.blocked);
  const summaryExcepted = Number(report?.summary?.excepted);
  for (const [name, value] of [['highOrCritical', highOrCritical], ['blocked', summaryBlocked], ['excepted', summaryExcepted]]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} summary ${name} is invalid.`);
  }
  if (summaryBlocked !== blocked.length) throw new Error(`${label} blocked summary does not match evidence.`);
  if (summaryExcepted !== excepted.length) throw new Error(`${label} excepted summary does not match evidence.`);
  if (highOrCritical !== findings.length) throw new Error(`${label} HIGH/CRITICAL summary does not match findings evidence.`);
  if (highOrCritical !== blocked.length + excepted.length) {
    throw new Error(`${label} HIGH/CRITICAL findings are not fully classified as blocked or formally excepted.`);
  }
  if (blocked.length !== 0) throw new Error(`${label} contains blocked HIGH or CRITICAL findings.`);

  return {
    highOrCritical,
    excepted: excepted.length,
    blocked: blocked.length,
  };
}

function classifyHelmRender(helmRendered) {
  const deploymentCount = (helmRendered.match(/^kind:\s*Deployment\s*$/gm) ?? []).length;
  const executableKinds = [...helmRendered.matchAll(/^kind:\s*(Deployment|StatefulSet|DaemonSet|Job|CronJob)\s*$/gm)]
    .map((match) => match[1]);
  const imageReferences = (helmRendered.match(/^\s*image:\s*\S+/gm) ?? []).length;

  if (deploymentCount > 0) {
    if (!helmRendered.includes('readOnlyRootFilesystem: true')
      || !helmRendered.includes('allowPrivilegeEscalation: false')
      || !helmRendered.includes('runAsNonRoot: true')) {
      throw new Error('Rendered Helm Deployments are not hardened.');
    }
    return {
      mode: 'explicit-workload-render',
      deploymentCount,
      executableWorkloadCount: executableKinds.length,
      imageReferenceCount: imageReferences,
    };
  }

  if (executableKinds.length !== 0 || imageReferences !== 0) {
    throw new Error(`Fail-closed default Helm render contains executable authority: kinds=${executableKinds.join(',') || '<none>'}, imageReferences=${imageReferences}.`);
  }

  return {
    mode: 'fail-closed-default-no-workloads',
    deploymentCount: 0,
    executableWorkloadCount: 0,
    imageReferenceCount: 0,
  };
}

function main() {
  if (!/^[a-f0-9]{40}$/i.test(EXACT_HEAD)) throw new Error('RUNTIME_SECURITY_EXACT_HEAD must be a full commit SHA.');
  if (!/^\d+$/.test(WORKFLOW_RUN_ID) || !/^\d+$/.test(WORKFLOW_RUN_ATTEMPT)) {
    throw new Error('Runtime security workflow run identity is missing.');
  }

  const files = filesUnder(INPUT_DIR);
  const byBasename = new Map();
  for (const path of files) {
    const items = byBasename.get(basename(path)) ?? [];
    items.push(path);
    byBasename.set(basename(path), items);
  }
  for (const name of REQUIRED_FILES) {
    const matches = byBasename.get(name) ?? [];
    if (matches.length !== 1) throw new Error(`Required runtime evidence ${name} must exist exactly once, found ${matches.length}.`);
  }
  const pathFor = (name) => byBasename.get(name)[0];

  const policy = parseJson(pathFor('runtime-context-validation.json'), 'Runtime context policy');
  const api = parseJson(pathFor('trivy-api-container-evaluation.json'), 'API image evaluation');
  const web = parseJson(pathFor('trivy-web-container-evaluation.json'), 'Web image evaluation');
  requireExactHead(policy, 'runtime policy');
  requirePassed(policy, 'runtime policy');
  const apiSecurity = requireAcceptedTrivyEvaluation(api, 'API image evaluation', 'trivy-container');
  const webSecurity = requireAcceptedTrivyEvaluation(web, 'Web image evaluation', 'trivy-web-container');
  if ((policy.violations ?? []).length !== 0) throw new Error('Runtime policy contains violations.');

  const apiDigest = readFileSync(pathFor('api-image-digest.txt'), 'utf8').trim();
  const webDigest = readFileSync(pathFor('web-image-digest.txt'), 'utf8').trim();
  if (!/^sha256:[a-f0-9]{64}$/i.test(apiDigest)) throw new Error('API image digest is invalid.');
  if (!/^sha256:[a-f0-9]{64}$/i.test(webDigest)) throw new Error('Web image digest is invalid.');
  if (readFileSync(pathFor('api-image-user.txt'), 'utf8').trim() !== 'nonroot') throw new Error('API image user is not nonroot.');
  if (readFileSync(pathFor('web-image-user.txt'), 'utf8').trim() !== 'nonroot') throw new Error('Web image user is not nonroot.');

  const helmLint = readFileSync(pathFor('helm-lint.txt'), 'utf8');
  const helmRendered = readFileSync(pathFor('helm-rendered.yaml'), 'utf8');
  if (!/1 chart\(s\) linted, 0 chart\(s\) failed/.test(helmLint)) throw new Error('Helm lint evidence is not successful.');
  const helmClassification = classifyHelmRender(helmRendered);

  const artifacts = files
    .filter((path) => statSync(path).isFile())
    .map((path) => ({
      path: relative(INPUT_DIR, path).replaceAll('\\', '/'),
      sizeBytes: statSync(path).size,
      sha256: sha256(path),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  const manifest = {
    schemaVersion: 1,
    repository: 'pachaninm-lab/pachanin-demo',
    commitSha: EXACT_HEAD,
    workflowRunId: WORKFLOW_RUN_ID,
    workflowRunAttempt: WORKFLOW_RUN_ATTEMPT,
    generatedAt: new Date().toISOString(),
    canonicalImages: {
      api: { digest: apiDigest, user: 'nonroot', ...apiSecurity },
      web: { digest: webDigest, user: 'nonroot', ...webSecurity },
    },
    iacRoots: ['infra/docker', 'infra/helm', 'infra/k8s'],
    helm: {
      lintPassed: true,
      renderedSha256: sha256(pathFor('helm-rendered.yaml')),
      ...helmClassification,
    },
    runtimePolicy: {
      checkedFiles: Array.isArray(policy.checkedFiles) ? policy.checkedFiles.length : 0,
      violations: 0,
      retiredImages: policy.retiredImages ?? [],
    },
    artifacts,
    maturityBoundary: 'Default chart is fail-closed with zero executable workloads; active immutable workload rendering is accepted separately by the release-authority gate.',
    passed: true,
  };
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Runtime security manifest accepted ${artifacts.length} exact-head evidence files in ${helmClassification.mode} mode.`);
}

try {
  main();
} catch (error) {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  const failure = {
    schemaVersion: 1,
    repository: 'pachaninm-lab/pachanin-demo',
    commitSha: EXACT_HEAD,
    workflowRunId: WORKFLOW_RUN_ID,
    workflowRunAttempt: WORKFLOW_RUN_ATTEMPT,
    generatedAt: new Date().toISOString(),
    passed: false,
    error: error instanceof Error ? error.message : String(error),
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(failure, null, 2)}\n`);
  console.error(failure.error);
  process.exit(1);
}
