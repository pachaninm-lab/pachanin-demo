#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-owner-reg-ru-deployment-command.yml';
const dockerPublishPath = '.github/workflows/docker-publish.yml';
const workflow = readFileSync(workflowPath, 'utf8');
const dockerPublish = readFileSync(dockerPublishPath, 'utf8');
const deployStart = workflow.indexOf('\n  deploy:\n');
const publishStart = workflow.indexOf('\n  publish:\n', deployStart);
const deployJob = deployStart >= 0 && publishStart > deployStart
  ? workflow.slice(deployStart, publishStart)
  : '';
const violations = [];
const requireFragment = (fragment) => {
  if (!workflow.includes(fragment)) violations.push(`missing ${JSON.stringify(fragment)}`);
};
const forbid = (pattern, message) => {
  if (pattern.test(workflow)) violations.push(message);
};

for (const fragment of [
  'name: TAI Owner REG.RU Deployment Command',
  'workflow_dispatch:',
  'target:',
  'default: current-main',
  'type: choice',
  '- current-main',
  'issue_comment:',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai deploy current-main'",
  "github.event_name == 'workflow_dispatch'",
  "github.event_name == 'issue_comment' || github.event_name == 'workflow_dispatch'",
  "github.event.issue.number || github.event.pull_request.number || '3365'",
  'COMMENTER: ${{ github.event.comment.user.login }}',
  'REQUESTED_TARGET: ${{ inputs.target }}',
  'REF: ${{ github.ref }}',
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  '[[ "$REQUESTED_TARGET" == \'current-main\' ]]',
  '[[ "$REF" == \'refs/heads/main\' ]]',
  'statuses: read',
  'commits/${target_sha}/status',
  'node scripts/select-tai-restricted-qwen-activation-status.mjs',
  "'TAI Restricted Qwen REG.RU Activation'",
  "run.event !== 'workflow_dispatch'",
  "new Set([owner, 'github-actions[bot]'])",
  "'Require exact-run REG.RU preflight completion'",
  "'Least-privilege activation contract'",
  "'Exact-main API, web and migration image authority'",
  "'Activate through protected REG.RU controller'",
  "'Hosted live public AI acceptance'",
  "'Finalize or roll back activation'",
  "'Publish restricted Qwen activation result'",
  "'Confirm restricted Qwen activation chain result'",
  'name: Exact-main rootless TAI image authority',
  "user\" == '65532:65532'",
  'name: Deploy through protected REG.RU controller',
  'sudo -n /usr/local/sbin/pc-tai-release-controller deploy',
  'name: Validate and checksum exact-main deployment evidence',
  'predeploy.json',
  'deployment.json',
  'postdeploy.json',
  "target mismatch",
  'successful evidence set incomplete',
  'successful postflight invalid',
  'tai-owner-deployment-evidence.sha256',
  'sha256sum',
  'name: Publish exact-main owner deployment result',
  "context='TAI REG.RU Deployment'",
  "context='TAI REG.RU Preflight'",
  'name: Confirm owner standalone TAI deployment result',
  'issues: write',
  'statuses: write',
]) requireFragment(fragment);

if (!deployJob) violations.push('production deploy job boundary is missing');
if (/^\s{6}- uses:/mu.test(deployJob)) {
  violations.push('production self-hosted owner deployment job must be actionless');
}
if (/actions\/(?:upload|download)-artifact@v4/u.test(deployJob)) {
  violations.push('artifact Actions are forbidden in the production owner deployment job');
}

const dispatchGuardCount = (workflow.match(/github\.event_name == 'workflow_dispatch'/gu) || []).length;
if (dispatchGuardCount < 4) {
  violations.push('workflow_dispatch must be governed at authority, image, publish and terminal result boundaries');
}

const targetBlock = workflow.match(
  /workflow_dispatch:\s*\n\s+inputs:\s*\n\s+target:\s*\n[\s\S]*?\n\s+options:\s*\n((?:\s+-\s+[^\n]+\n?)+)/u,
);
if (!targetBlock) {
  violations.push('workflow_dispatch target choice block is missing');
} else {
  const targetOptions = targetBlock[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^-\s+/u, ''));
  if (targetOptions.length !== 1 || targetOptions[0] !== 'current-main') {
    violations.push('workflow_dispatch target choices must remain current-main only');
  }
}

if (!dockerPublish.includes('- ".github/workflows/tai-owner-reg-ru-deployment-command.yml"')) {
  violations.push(`${dockerPublishPath}: owner deployment authority changes must publish exact canonical images`);
}

forbid(/pull_request_target:/u, 'pull_request_target is forbidden');
forbid(/continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
forbid(/\/tai\s+deploy\s+(?!current-main)/u, 'alternate deployment command is forbidden');
forbid(/github\.event\.comment\.body\s*!=/u, 'command matching must use exact positive equality');
forbid(/docker\s+(run|compose|exec)/u, 'workflow must not gain direct Docker mutation authority');

for (const [index, line] of workflow.split('\n').entries()) {
  const trimmed = line.trim();
  if (!trimmed.includes('sudo ')) continue;
  const allowedReadOnlyInspection = trimmed.includes('sudo -n -l');
  const allowedProtectedController = trimmed.includes('sudo -n /usr/local/sbin/pc-tai-release-controller');
  if (!allowedReadOnlyInspection && !allowedProtectedController) {
    violations.push(`line ${index + 1}: sudo is restricted to read-only -l or the protected TAI release controller`);
  }
}

if (violations.length) {
  console.error('TAI owner deployment command contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI owner deployment command contract PASS: the REG.RU deployment runner is actionless, exact activation proof and rootless image authority remain mandatory, and deployment evidence is target-bound and checksummed locally.');
