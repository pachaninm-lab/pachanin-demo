#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const commandPath = '.github/workflows/tai-owner-qwen-activation-command.yml';
const activationPath = '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml';
const scopePath = 'docs/platform-v7/autopilot/scopes/tai-owner-activation-command-20260803.json';
const command = readFileSync(commandPath, 'utf8');
const activation = readFileSync(activationPath, 'utf8');
const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
const violations = [];
const requireFragment = (source, path, fragment) => {
  if (!source.includes(fragment)) violations.push(`${path}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, path, pattern, message) => {
  if (pattern.test(source)) violations.push(`${path}: ${message}`);
};

for (const fragment of [
  'name: TAI Owner Qwen Activation Command',
  'issue_comment:',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai activate current-main'",
  'COMMENTER: ${{ github.event.comment.user.login }}',
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'statuses: read',
  'commits/${target_sha}/status',
  'node scripts/select-tai-owner-preflight-status.mjs',
  "'TAI Owner REG.RU Preflight'",
  "run.event !== 'issue_comment'",
  "run.actor?.login !== owner",
  "run.triggering_actor?.login !== owner",
  "'Require successful canonical image build'",
  "'Least-privilege preflight contract'",
  "'Exact-main canonical TAI image authority'",
  "'Exact-main REG.RU controller inventory'",
  "'Publish REG.RU preflight status'",
  "'Confirm REG.RU preflight chain result'",
  'permissions:\n      actions: write',
  'actions/workflows/tai-restricted-qwen-reg-ru-activation.yml/dispatches',
  "'confirmation':'ACTIVATE-RESTRICTED-QWEN-REG-RU'",
  'event=workflow_dispatch&branch=main&per_page=30',
  "run?.name === 'TAI Restricted Qwen REG.RU Activation'",
  'activation_run_id=$activation_run_id',
  'issues: write',
  'name: Publish redacted terminal command evidence',
  'result: \\`$state\\`',
  'name: Confirm owner activation dispatch',
]) requireFragment(command, commandPath, fragment);

for (const fragment of [
  'workflow_dispatch:',
  'name: Require exact-run REG.RU preflight completion',
  'TARGET_SHA: ${{ inputs.target_sha }}',
  'UPSTREAM_RUN_ID: ${{ inputs.upstream_run_id }}',
  'UPSTREAM_RUN_ATTEMPT: ${{ inputs.upstream_run_attempt }}',
  '[[ "$EVENT_NAME" == workflow_dispatch ]]',
  '[[ "$CURRENT_REF" == refs/heads/main ]]',
  '[[ "$CONFIRMATION" == ACTIVATE-RESTRICTED-QWEN-REG-RU ]]',
  "[[ \"$ACTOR\" == 'github-actions[bot]' ]]",
  "[[ \"$TRIGGERING_ACTOR\" == 'github-actions[bot]' ]]",
  'for attempt in $(seq 1 60)',
  "if [[ \"$status\" == completed ]]",
  'REG.RU preflight did not reach a terminal state.',
  "run.name === 'TAI Automatic REG.RU Preflight'",
  "run.event !== 'workflow_run'",
  "run.head_branch !== 'main'",
  "new Set([owner, 'github-actions[bot]'])",
  '!allowedActors.has(actor)',
  '!allowedActors.has(triggeringActor)',
  "run.name === 'TAI Owner REG.RU Preflight'",
  "run.event !== 'issue_comment'",
  "run.actor?.login !== owner",
  "run.triggering_actor?.login !== owner",
  "upstream_name='TAI Automatic REG.RU Preflight'",
  "upstream_name='TAI Owner REG.RU Preflight'",
  '"$TARGET_SHA" "$UPSTREAM_RUN_ATTEMPT" "$upstream_name" "$GITHUB_REPOSITORY"',
  "'Confirm REG.RU preflight chain result'",
  'needs: [upstream_preflight_gate, contract]',
  'needs.upstream_preflight_gate.outputs.target_sha !=',
  'node scripts/check-tai-automatic-release-chain.mjs',
]) requireFragment(activation, activationPath, fragment);

forbid(command, commandPath, /pull_request_target:/u, 'pull_request_target is forbidden');
forbid(command, commandPath, /continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
forbid(command, commandPath, /\/tai\s+activate\s+(?!current-main)/u, 'alternate activation command is forbidden');
forbid(command, commandPath, /actions\/workflows\/tai-reg-ru-preflight-owner-command[.]yml\/runs\?/u, 'workflow-list discovery is forbidden; exact commit status is authoritative');
forbid(activation, activationPath, /^\s{2}issue_comment:/mu, 'production activation must not listen to issue comments');
forbid(activation, activationPath, /^\s{2}workflow_run:/mu, 'production activation must not directly listen to workflow_run');
forbid(activation, activationPath, /continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
forbid(activation, activationPath, /pull_request_target:/u, 'pull_request_target is forbidden');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${scopePath}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-owner-preflight-activation-authority-20260807') violations.push(`${scopePath}: branch mismatch`);
if (scope.baselineExactMain !== '682491bd71117b1d7bc1783ceccaf171194569a1') violations.push(`${scopePath}: baseline mismatch`);
const expectedAllowedPaths = [activationPath, 'scripts/check-tai-owner-activation-command.mjs', scopePath].sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedAllowedPaths) !== JSON.stringify(allowedPaths)) violations.push(`${scopePath}: allowedPaths mismatch`);
if (!Array.isArray(scope.boundaries) || !scope.boundaries.some((entry) => String(entry).includes('two upstream authorities'))) {
  violations.push(`${scopePath}: dual upstream boundary missing`);
}

if (violations.length) {
  console.error('TAI owner activation dispatch contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI owner activation dispatch contract PASS: automatic and owner preflight authorities are exact-run, source-specific, fail-closed, and protected activation retains all live acceptance and rollback gates.');
