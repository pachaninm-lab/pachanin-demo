#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-owner-canonical-images-command.yml';
const scopePath = 'docs/platform-v7/autopilot/scopes/tai-owner-canonical-images-command-20260806.json';
const workflow = readFileSync(workflowPath, 'utf8');
const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
const violations = [];

const requireFragment = (fragment) => {
  if (!workflow.includes(fragment)) violations.push(`${workflowPath}: missing ${JSON.stringify(fragment)}`);
};

for (const fragment of [
  'name: TAI Owner Canonical Images Command',
  'issue_comment:',
  'schedule:',
  "cron: '3,8,13,18,23,28,33,38,43,48,53,58 * * * *'",
  "github.event_name == 'schedule'",
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai images current-main'",
  'COMMENTER: ${{ github.event.comment.user.login }}',
  'ACTOR: ${{ github.actor }}',
  'TRIGGERING_ACTOR: ${{ github.triggering_actor }}',
  'OWNER: ${{ github.repository_owner }}',
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  '[[ "$EVENT_NAME" == schedule ]]',
  'repos/${GITHUB_REPOSITORY}/commits/main',
  'git rev-parse origin/main',
  'TAI REG.RU Deployment',
  'TAI Canonical Images',
  'now_epoch - created_epoch < 5400',
  'actions/workflows/docker-publish.yml/dispatches',
  "-f ref='main'",
  "-f 'inputs[services]=all'",
  "context='TAI Canonical Images'",
  "state='pending'",
  'gh issue comment 3365',
  'production mutation: `NONE`',
]) requireFragment(fragment);

if (/^\s+(?:docker|ssh|scp|rsync)\s/mu.test(workflow)) {
  violations.push(`${workflowPath}: owner dispatch bridge must not execute Docker or remote-shell commands`);
}
if (/^\s+sudo\s/mu.test(workflow)) {
  violations.push(`${workflowPath}: owner dispatch bridge must not have sudo authority`);
}
if (/pull_request_target:/u.test(workflow)) {
  violations.push(`${workflowPath}: pull_request_target is forbidden`);
}
if (/continue-on-error:\s*true/u.test(workflow)) {
  violations.push(`${workflowPath}: continue-on-error is forbidden`);
}
if (!Array.isArray(scope.allowedPaths) || !scope.allowedPaths.includes(workflowPath) || !scope.allowedPaths.includes('scripts/check-tai-owner-canonical-images-command.mjs')) {
  violations.push(`${scopePath}: governed allowedPaths are incomplete`);
}
if (scope.branch !== 'fix/tai-owner-canonical-images-command-20260806' || scope.status !== 'active') {
  violations.push(`${scopePath}: scope identity or status is invalid`);
}
if (!Array.isArray(scope.boundaries) || !scope.boundaries.some((entry) => String(entry).includes('temporary scheduled fallback'))) {
  violations.push(`${scopePath}: temporary schedule removal boundary is missing`);
}

if (violations.length) {
  console.error('TAI owner canonical images command contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI owner canonical images command contract PASS: exact owner or temporary scheduled authority dispatches only the existing all-service canonical build for unchanged current main, skips recent duplicates and terminal deployment, and introduces no production or remote-shell authority.');
