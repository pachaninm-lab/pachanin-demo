#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-owner-reg-ru-deployment-command.yml';
const workflow = readFileSync(workflowPath, 'utf8');
const violations = [];
const requireFragment = (fragment) => {
  if (!workflow.includes(fragment)) violations.push(`missing ${JSON.stringify(fragment)}`);
};
const forbid = (pattern, message) => {
  if (pattern.test(workflow)) violations.push(message);
};

for (const fragment of [
  'name: TAI Owner REG.RU Deployment Command',
  'issue_comment:',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai deploy current-main'",
  'COMMENTER: ${{ github.event.comment.user.login }}',
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
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
  'name: Upload exact-main deployment evidence',
  'predeploy.json',
  'deployment.json',
  'postdeploy.json',
  'name: Publish exact-main owner deployment result',
  "context='TAI REG.RU Deployment'",
  "context='TAI REG.RU Preflight'",
  'name: Confirm owner standalone TAI deployment result',
  'issues: write',
  'statuses: write',
]) requireFragment(fragment);

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
console.log('TAI owner deployment command contract PASS: exact activation proof, rootless image, protected controller, rollback evidence and terminal status are fail-closed.');
