#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml';
const workflow = readFileSync(workflowPath, 'utf8');
const violations = [];
const requireFragment = (fragment) => {
  if (!workflow.includes(fragment)) violations.push(`missing ${JSON.stringify(fragment)}`);
};
const forbid = (pattern, message) => {
  if (pattern.test(workflow)) violations.push(message);
};

for (const fragment of [
  'issue_comment:',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai activate current-main'",
  'COMMENTER: ${{ github.event.comment.user.login }}',
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'actions/workflows/tai-reg-ru-preflight-owner-command.yml/runs?branch=main&status=success&per_page=100',
  "run.event !== 'issue_comment'",
  "run.actor?.login !== owner",
  "run.triggering_actor?.login !== owner",
  "'TAI Owner REG.RU Preflight'",
  "'Require successful canonical image build'",
  "'Least-privilege preflight contract'",
  "'Exact-main canonical TAI image authority'",
  "'Exact-main REG.RU controller inventory'",
  "'Publish REG.RU preflight status'",
  "'Confirm REG.RU preflight chain result'",
  'target_sha: ${{ steps.authority.outputs.target_sha }}',
  'needs: [upstream_preflight_gate, contract]',
  'TARGET_SHA: ${{ needs.upstream_preflight_gate.outputs.target_sha }}',
  "needs.upstream_preflight_gate.outputs.target_sha != ''",
]) requireFragment(fragment);

forbid(/pull_request_target:/u, 'pull_request_target is forbidden');
forbid(/continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
forbid(/github\.event\.comment\.body\s*!=/u, 'command matching must use exact positive equality');
forbid(/\/tai\s+activate\s+(?!current-main)/u, 'alternate activation command is forbidden');
forbid(/workflow_run[\s\S]{0,600}UPSTREAM_CONCLUSION[^\n]*\n(?![\s\S]*\[\[ \"\$UPSTREAM_CONCLUSION\" == success \]\])/u, 'workflow_run must remain success-only');

if (violations.length) {
  console.error('TAI owner activation command contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI owner activation command contract PASS: exact owner command, exact preflight run and neutral skipped-run boundary.');
