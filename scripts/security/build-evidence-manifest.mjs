#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const INPUT_DIR = resolve(
  process.env.SECURITY_EVIDENCE_INPUT_DIR
    ?? 'artifacts/security-evidence-input',
);
const OUTPUT_PATH = resolve(
  process.env.SECURITY_EVIDENCE_MANIFEST
    ?? 'artifacts/security/security-evidence-manifest.json',
);
const EXACT_HEAD = String(process.env.SECURITY_EXACT_HEAD ?? '').trim();
const WORKFLOW_RUN_ID = String(process.env.SECURITY_WORKFLOW_RUN_ID ?? '').trim();
const WORKFLOW_RUN_ATTEMPT = String(process.env.SECURITY_WORKFLOW_RUN_ATTEMPT ?? '').trim();

const REQUIRED_JOB_RESULTS = {
  'security-policy': process.env.POLICY_RESULT,
  'semgrep-sast': process.env.SEMGREP_RESULT,
  'trivy-container': process.env.CONTAINER_RESULT,
  'trivy-filesystem': process.env.FILESYSTEM_RESULT,
  'trivy-iac': process.env.IAC_RESULT,
  gitleaks: process.env.GITLEAKS_RESULT,
  'dependency-audit': process.env.DEPENDENCY_RESULT,
  'typescript-check': process.env.TYPESCRIPT_RESULT,
  'security-abuse': process.env.ABUSE_RESULT,
};

const REQUIRED_FILES = [
  'security-policy-validation.json',
  'semgrep.sarif',
  'semgrep.log',
  'trivy-container.json',
  'trivy-container.sarif',
  'trivy-container-evaluation.json',
  'container-image-digest.txt',
  'trivy-filesystem.sarif',
  'trivy-iac.sarif',
  'gitleaks-evidence.json',
  'pnpm-production-dependencies.json',
  'pnpm-audit.json',
  'pnpm-audit-evaluation.json',
  'typescript-evidence.json',
  'security-evaluator-contract.json',
  'security-abuse-evidence.json',
  'security-abuse-junit.xml',
];

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is missing or invalid JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function indexEvidenceFiles() {
  const files = filesUnder(INPUT_DIR);
  const byBasename = new Map();
  for (const path of files) {
    const name = basename(path);
    const existing = byBasename.get(name) ?? [];
    existing.push(path);
    byBasename.set(name, existing);
  }
  for (const required of REQUIRED_FILES) {
    const matches = byBasename.get(required) ?? [];
    if (matches.length !== 1) {
      throw new Error(`Required evidence ${required} must exist exactly once, found ${matches.length}.`);
    }
  }
  return { files, byBasename };
}

function requireExactHead(report, label) {
  const reportedCommit = String(report?.commitSha ?? report?.validatedCommit ?? '');
  if (reportedCommit !== EXACT_HEAD) {
    throw new Error(`${label} commit identity does not match exact head ${EXACT_HEAD}.`);
  }
}

function requirePassed(report, label) {
  const passed = report?.passed ?? report?.valid;
  if (passed !== true) throw new Error(`${label} is not marked passed or valid.`);
}

function validateJsonEvidence(byBasename) {
  const pathFor = (name) => byBasename.get(name)[0];
  const policy = parseJson(pathFor('security-policy-validation.json'), 'Security policy report');
  const container = parseJson(pathFor('trivy-container-evaluation.json'), 'Container evaluation report');
  const dependencies = parseJson(pathFor('pnpm-audit-evaluation.json'), 'Dependency evaluation report');
  const gitleaks = parseJson(pathFor('gitleaks-evidence.json'), 'Gitleaks evidence');
  const typescript = parseJson(pathFor('typescript-evidence.json'), 'TypeScript evidence');
  const evaluatorContract = parseJson(pathFor('security-evaluator-contract.json'), 'Evaluator fail-closed contract');
  const abuse = parseJson(pathFor('security-abuse-evidence.json'), 'Security abuse evidence');

  for (const [label, report] of [
    ['security policy', policy],
    ['container evaluation', container],
    ['dependency evaluation', dependencies],
    ['gitleaks evidence', gitleaks],
    ['TypeScript evidence', typescript],
    ['evaluator fail-closed contract', evaluatorContract],
    ['security abuse evidence', abuse],
  ]) {
    requireExactHead(report, label);
    requirePassed(report, label);
  }

  if ((dependencies.blocked ?? []).length !== 0) {
    throw new Error('Dependency evaluation contains blocked findings.');
  }
  if ((dependencies.highOrCriticalFindings ?? []).length !== 0) {
    throw new Error('Dependency evaluation contains HIGH or CRITICAL findings.');
  }
  if ((container.blocked ?? []).length !== 0) {
    throw new Error('Container evaluation contains blocked findings.');
  }
  if ((evaluatorContract.fixtures ?? []).length !== 3
    || evaluatorContract.fixtures.some((fixture) => fixture.passed !== true)) {
    throw new Error('Evaluator contract does not contain three passing fail-closed fixtures.');
  }
  if ((abuse.scenarios ?? []).length !== 10 || abuse.scenarios.some((scenario) => scenario.passed !== true)) {
    throw new Error('Security abuse evidence does not contain ten passing mandatory scenarios.');
  }

  const imageDigest = readFileSync(pathFor('container-image-digest.txt'), 'utf8').trim();
  if (!/^sha256:[a-f0-9]{64}$/i.test(imageDigest)) {
    throw new Error('Canonical container image digest is missing or invalid.');
  }

  return { policy, container, dependencies, gitleaks, typescript, evaluatorContract, abuse, imageDigest };
}

function main() {
  if (!/^[a-f0-9]{40}$/i.test(EXACT_HEAD)) {
    throw new Error('SECURITY_EXACT_HEAD must be a 40-character commit SHA.');
  }
  if (!/^\d+$/.test(WORKFLOW_RUN_ID) || !/^\d+$/.test(WORKFLOW_RUN_ATTEMPT)) {
    throw new Error('Workflow run identity is missing or invalid.');
  }

  const failedJobs = Object.entries(REQUIRED_JOB_RESULTS)
    .filter(([, result]) => result !== 'success');
  if (failedJobs.length > 0) {
    throw new Error(`Required security jobs failed or were skipped: ${failedJobs.map(([name, result]) => `${name}=${result}`).join(', ')}`);
  }

  const { files, byBasename } = indexEvidenceFiles();
  const validated = validateJsonEvidence(byBasename);
  const artifacts = files
    .filter((path) => statSync(path).isFile())
    .map((path) => ({
      path: relative(INPUT_DIR, path),
      sizeBytes: statSync(path).size,
      sha256: sha256File(path),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  const manifest = {
    schemaVersion: 1,
    repository: 'pachaninm-lab/pachanin-demo',
    commitSha: EXACT_HEAD,
    workflowRunId: WORKFLOW_RUN_ID,
    workflowRunAttempt: WORKFLOW_RUN_ATTEMPT,
    generatedAt: new Date().toISOString(),
    jobResults: REQUIRED_JOB_RESULTS,
    scanners: {
      semgrep: { contract: 'semgrep/semgrep:1.169.0' },
      trivy: { contract: 'aquasecurity/trivy-action@v0.36.0' },
      gitleaks: { contract: validated.gitleaks.scannerContract },
      dependencyAudit: {
        version: validated.dependencies.scannerVersion,
        endpointContract: validated.dependencies.endpointContract,
      },
      typescript: { version: validated.typescript.typescriptVersion },
      evaluatorContract: {
        fixtures: validated.evaluatorContract.fixtures.map((fixture) => fixture.id),
      },
      abuseGate: { schemaVersion: validated.abuse.schemaVersion },
    },
    canonicalImageDigest: validated.imageDigest,
    summary: {
      dependencyHighOrCritical: validated.dependencies.highOrCriticalFindings.length,
      dependencyBlocked: validated.dependencies.blocked.length,
      containerBlocked: validated.container.blocked.length,
      evaluatorFixtures: validated.evaluatorContract.fixtures.length,
      evaluatorFixturesPassed: validated.evaluatorContract.fixtures.filter((fixture) => fixture.passed).length,
      abuseScenarios: validated.abuse.scenarios.length,
      abusePassed: validated.abuse.scenarios.filter((scenario) => scenario.passed).length,
    },
    artifacts,
    passed: true,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Security evidence manifest accepted ${artifacts.length} files for ${EXACT_HEAD}.`);
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
