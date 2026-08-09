import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const paths = {
  workflow: '.github/workflows/production-like-kubernetes-acceptance.yml',
  scope: 'docs/platform-v7/autopilot/scopes/production-like-kubernetes-timeout-3750.json',
};
const selfTest = process.argv.includes('--self-test');
const failures = [];

const read = (path) => {
  if (!fs.existsSync(path)) {
    failures.push(`${path}: missing`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
};
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const occurrences = (value, needle) => value.split(needle).length - 1;

const workflow = read(paths.workflow);
const scopeSource = read(paths.scope);
let scope = {};
try {
  scope = JSON.parse(scopeSource || '{}');
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

const expectedAllowedPaths = [paths.workflow];
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push(`${paths.scope}: schemaVersion mismatch`);
if (scope.branch !== 'fix/production-like-kubernetes-timeout-3750') failures.push(`${paths.scope}: branch mismatch`);
if (JSON.stringify(scope.allowedPaths) !== JSON.stringify(expectedAllowedPaths)) {
  failures.push(`${paths.scope}: allowedPaths must contain only ${paths.workflow}`);
}
if (scope.acceptedChange?.path !== 'jobs.production-like-kubernetes.timeout-minutes') failures.push(`${paths.scope}: acceptedChange.path mismatch`);
if (scope.acceptedChange?.from !== 210 || scope.acceptedChange?.to !== 300) failures.push(`${paths.scope}: accepted timeout must be exactly 210 -> 300`);

const requiredAnchors = [
  'Execute production-like Kubernetes acceptance',
  'Execute deep outbox worker runtime acceptance',
  'Enforce machine-readable Kubernetes evidence',
  'Enforce exact-head outbox runtime evidence',
  'Production-like Kubernetes Gate · blocking',
  'test "${{ needs.production-like-kubernetes.result }}" = success',
];
for (const anchor of requiredAnchors) {
  if (!workflow.includes(anchor)) failures.push(`${paths.workflow}: missing protected gate ${JSON.stringify(anchor)}`);
}

const baselineLine = 'timeout-minutes: 210';
const acceptedLine = 'timeout-minutes: 300';
if (selfTest) {
  if (sha256(workflow) !== scope.baselineWorkflowSha256) failures.push(`${paths.workflow}: baseline SHA-256 mismatch`);
  if (occurrences(workflow, baselineLine) !== 1 || occurrences(workflow, acceptedLine) !== 0) {
    failures.push(`${paths.workflow}: baseline must contain exactly one 210-minute timeout and no 300-minute timeout`);
  }
  const accepted = workflow.replace(baselineLine, acceptedLine);
  if (sha256(accepted) !== scope.acceptedWorkflowSha256) failures.push(`${paths.scope}: accepted SHA-256 does not represent only 210 -> 300`);
  const forbiddenMutation = accepted.replace(requiredAnchors[0], `${requiredAnchors[0]} changed`);
  if (sha256(forbiddenMutation) === scope.acceptedWorkflowSha256) failures.push(`${paths.scope}: unrelated mutation was not rejected`);
} else {
  const headRef = String(process.env.GITHUB_HEAD_REF || '').trim();
  if (headRef && headRef !== scope.branch) failures.push(`GITHUB_HEAD_REF mismatch: expected ${scope.branch}, received ${headRef}`);
  if (sha256(workflow) !== scope.acceptedWorkflowSha256) failures.push(`${paths.workflow}: accepted SHA-256 mismatch`);
  if (occurrences(workflow, acceptedLine) !== 1 || occurrences(workflow, baselineLine) !== 0) {
    failures.push(`${paths.workflow}: accepted file must contain exactly one 300-minute timeout and no 210-minute timeout`);
  }
  const reverted = workflow.replace(acceptedLine, baselineLine);
  if (sha256(reverted) !== scope.baselineWorkflowSha256) failures.push(`${paths.workflow}: change is not exactly 210 -> 300`);

  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  if (diff.status !== 0) {
    failures.push(`git diff failed: ${diff.stderr.trim()}`);
  } else {
    const changed = diff.stdout.trim().split(/\r?\n/).filter(Boolean);
    if (JSON.stringify(changed) !== JSON.stringify(expectedAllowedPaths)) {
      failures.push(`changed paths must be exactly ${JSON.stringify(expectedAllowedPaths)}; received ${JSON.stringify(changed)}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Production-like Kubernetes timeout contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(selfTest
  ? 'PASS: baseline and accepted SHA-256 values prove the only permitted mutation is timeout-minutes 210 -> 300.'
  : 'PASS: branch changes exactly one workflow line, timeout-minutes 210 -> 300, with all blocking evidence gates intact.');
