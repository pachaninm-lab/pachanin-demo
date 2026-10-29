#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-decision-notification-diagnostic-v2.yml';
const scopePath = 'docs/platform-v7/autopilot/scopes/p0-reviewer-decision-notification-diagnostic-v2-4858.json';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const required = [
  "FAILED_RUN_ID: '33425716125'",
  "FAILED_RUN_ATTEMPT: '2'",
  "FAILED_TARGET_SHA: '1bffaec1a7aad09840df136e886c07d2b32e2008'",
  "DIAGNOSTIC_SINCE: '2026-08-31T19:18:00Z'",
  "DIAGNOSTIC_UNTIL: '2026-08-31T19:20:30Z'",
  '/production p0-reviewer-decision-notification-diagnostic-v2 attempt-33425716125-2',
  "github.event.issue.number == 4858",
  "github.event.comment.author_association == 'OWNER'",
  "github.event.comment.performed_via_github_app.id == 1144995",
  "'pc-crop-registration-lifecycle'",
  'StrictHostKeyChecking=yes',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'docker logs --since "$since" --until "$until" --timestamps "$web_id"',
  'p0_human_reviewer_ceremony',
  'registration_decision_notification_result',
  'COMMIT_SUCCEEDED_NOTIFICATION_FAILED',
  'PRIOR_COMMIT_REPLAY_WITHOUT_FIRST_DELIVERY',
  'COMMIT_SUCCEEDED_REPLAY_MISSING',
  'PRODUCTION_MUTATION=NONE',
  'RAW_LOGS_PUBLISHED=0',
  'gh issue comment "$DIAGNOSTIC_ISSUE"',
];
for (const needle of required) {
  if (!workflow.includes(needle)) throw new Error(`P0_REVIEWER_NOTIFICATION_DIAGNOSTIC_V2_MISSING:${needle}`);
}

const forbidden = [
  'docker restart', 'docker stop', 'docker kill', 'docker rm', 'docker compose',
  'INSERT INTO', 'UPDATE auth.', 'DELETE FROM', 'TRUNCATE TABLE', 'ALTER ROLE',
  '--request POST', '-X POST', '--data-binary', '/api/auth/forgot-password',
  'sendTransactionalMail(', 'cat "$logs"', 'tail "$logs"',
];
for (const needle of forbidden) {
  if (workflow.includes(needle)) throw new Error(`P0_REVIEWER_NOTIFICATION_DIAGNOSTIC_V2_FORBIDDEN:${needle}`);
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
  || scope.branch !== 'fix/p0-reviewer-notification-diagnostic-validator-4858'
  || scope.status !== 'active'
  || scope.approvedBy !== 'owner-issue-4858'
  || scope.authorityBaseExactMain !== 'fd1311ecd5156d39de3ee1df9ae7d0f4d06dcb65'
  || scope.productionHosting !== 'REG_RU_VPS_ONLY'
  || scope.newRecurringCostRub !== 0) {
  throw new Error('P0_REVIEWER_NOTIFICATION_DIAGNOSTIC_V2_SCOPE_IDENTITY');
}

const expectedPaths = [workflowPath, new URL(import.meta.url).pathname.split('/').slice(-2).join('/'), scopePath].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
  throw new Error(`P0_REVIEWER_NOTIFICATION_DIAGNOSTIC_V2_SCOPE_PATHS:${JSON.stringify(actualPaths)}`);
}

process.stdout.write('Production P0 reviewer decision notification diagnostic v2 contract PASS\n');
