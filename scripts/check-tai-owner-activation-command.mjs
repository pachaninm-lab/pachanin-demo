#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const commandPath = '.github/workflows/tai-owner-qwen-activation-command.yml';
const activationPath = '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml';
const command = readFileSync(commandPath, 'utf8');
const activation = readFileSync(activationPath, 'utf8');
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
  'actions/workflows/tai-reg-ru-preflight-owner-command.yml/runs?branch=main&status=success&per_page=100',
  'node scripts/select-tai-owner-preflight-run.mjs',
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
  "run.event !== 'issue_comment'",
  "run.actor?.login !== owner",
  "run.triggering_actor?.login !== owner",
  "'TAI Owner REG.RU Preflight'",
  "'Confirm REG.RU preflight chain result'",
  'needs: [upstream_preflight_gate, contract]',
  'needs.upstream_preflight_gate.outputs.target_sha !=',
]) requireFragment(activation, activationPath, fragment);

forbid(command, commandPath, /pull_request_target:/u, 'pull_request_target is forbidden');
forbid(command, commandPath, /continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
forbid(command, commandPath, /\/tai\s+activate\s+(?!current-main)/u, 'alternate activation command is forbidden');
forbid(activation, activationPath, /^\s{2}issue_comment:/mu, 'production activation must not listen to issue comments');
forbid(activation, activationPath, /^\s{2}workflow_run:/mu, 'production activation must not listen to workflow_run');
forbid(activation, activationPath, /continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
forbid(activation, activationPath, /pull_request_target:/u, 'pull_request_target is forbidden');

if (violations.length) {
  console.error('TAI owner activation dispatch contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI owner activation dispatch contract PASS: exact owner command, exact preflight proof, dispatch-only activation and unchanged production gates.');
