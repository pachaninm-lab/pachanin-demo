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
  'name: Require exact-run REG.RU preflight completion',
  'if: always()',
  'ISSUE_NUMBER: ${{ github.event.issue.number }}',
  'COMMAND_BODY: ${{ github.event.comment.body }}',
  'if [[ "$ISSUE_NUMBER" != 3365 || "$COMMAND_BODY" != \'/tai activate current-main\' ]]; then',
  "echo 'Neutral issue comment: activation authority not requested.'",
  'if [[ "$UPSTREAM_CONCLUSION" != success || "$UPSTREAM_BRANCH" != main ]]; then',
  "echo 'Neutral workflow_run: upstream preflight was not a successful main run.'",
  'COMMENTER: ${{ github.event.comment.user.login }}',
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'actions/workflows/tai-reg-ru-preflight-owner-command.yml/runs?branch=main&status=success&per_page=100',
  'node scripts/select-tai-owner-preflight-run.mjs',
  'node scripts/check-tai-owner-preflight-run-selection.mjs',
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
  "github.event_name == 'pull_request' ||",
  'needs: [upstream_preflight_gate, contract]',
  'TARGET_SHA: ${{ needs.upstream_preflight_gate.outputs.target_sha }}',
  "needs.upstream_preflight_gate.outputs.target_sha != ''",
]) requireFragment(fragment);

forbid(/pull_request_target:/u, 'pull_request_target is forbidden');
forbid(/continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
forbid(/\/tai\s+activate\s+(?!current-main)/u, 'alternate activation command is forbidden');
forbid(/upstream_preflight_gate:[\s\S]{0,500}github[.]event[.]comment[.]body\s*==/u, 'issue command must not be filtered out before the authority job is materialized');
forbid(/upstream_preflight_gate:[\s\S]{0,500}github[.]event[.]workflow_run[.]conclusion\s*==/u, 'workflow_run conclusion must be classified inside the materialized authority job');
forbid(/preflight-candidates[.]json[\s\S]{0,1800}head_repository/gu, 'initial candidate discovery must not depend on optional list metadata');

if (violations.length) {
  console.error('TAI owner activation command contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI owner activation command contract PASS: materialized neutral gate, deterministic exact-SHA discovery and strict selected-run authority.');
