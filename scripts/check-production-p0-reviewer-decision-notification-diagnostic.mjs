#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-decision-notification-diagnostic.yml';
const scopePath = 'docs/platform-v7/autopilot/scopes/p0-reviewer-decision-notification-diagnostic-4858.json';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const required = [
  "FAILED_RUN_ID: '33425716125'",
  "FAILED_RUN_ATTEMPT: '2'",
  "FAILED_TARGET_SHA: '1bffaec1a7aad09840df136e886c07d2b32e2008'",
  "DIAGNOSTIC_SINCE: '2026-08-31T19:18:00Z'",
  "DIAGNOSTIC_UNTIL: '2026-08-31T19:20:30Z'",
  "DIAGNOSTIC_ISSUE: '4858'",
  '/production p0-reviewer-decision-notification-diagnostic attempt-33425716125-2',
  'github.event.issue.number == 4858',
  "github.event.comment.author_association == 'OWNER'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  "'pc-crop-registration-lifecycle'",
  'queue: max',
  'StrictHostKeyChecking=yes',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'git merge-base --is-ancestor "$FAILED_TARGET_SHA" "$current_main"',
  'docker logs --since "$since" --until "$until" --timestamps "$web_id"',
  'p0_human_reviewer_ceremony',
  'registration_decision_notification_result',
  'COMMIT_SUCCEEDED_NOTIFICATION_FAILED',
  'PRIOR_COMMIT_REPLAY_WITHOUT_FIRST_DELIVERY',
  'COMMIT_SUCCEEDED_REPLAY_MISSING',
  'PRODUCTION_MUTATION: "NONE"',
  'RAW_LOGS_PUBLISHED: 0',
  'raw logs, application identifiers, PII and credentials published: `0`',
  'gh issue comment "$DIAGNOSTIC_ISSUE"',
];
const missing = required.filter((value) => !workflow.includes(value));
if (missing.length) throw new Error(`P0_REVIEWER_DECISION_NOTIFICATION_DIAGNOSTIC_MISSING:${missing.join('|')}`);

const forbidden = [
  'docker restart', 'docker stop', 'docker kill', 'docker rm', 'docker compose',
  'INSERT INTO', 'UPDATE auth.', 'DELETE FROM', 'TRUNCATE TABLE', 'ALTER ROLE',
  '--request POST', '-X POST', '--data-binary', '/api/auth/forgot-password',
  'sendTransactionalMail(', 'notificationDelivered !== true) process.exit(0)',
  'github.event.issue.number == 3072', 'gh issue comment 3072',
  'secretsOrPiiInEvidence: true',
];
const presentForbidden = forbidden.filter((value) => workflow.includes(value));
if (presentForbidden.length) throw new Error(`P0_REVIEWER_DECISION_NOTIFICATION_DIAGNOSTIC_FORBIDDEN:${presentForbidden.join('|')}`);

const exactCounts = new Map([
  ['github.event.issue.number == 4858', 2],
  ["github.event.comment.body == '/production p0-reviewer-decision-notification-diagnostic attempt-33425716125-2'", 2],
  ['gh issue comment "$DIAGNOSTIC_ISSUE"', 1],
  ['docker logs --since "$since" --until "$until" --timestamps "$web_id"', 1],
]);
for (const [needle, expected] of exactCounts) {
  const actual = workflow.split(needle).length - 1;
  if (actual !== expected) throw new Error(`P0_REVIEWER_DECISION_NOTIFICATION_DIAGNOSTIC_COUNT:${needle}:${actual}:${expected}`);
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
  || scope.branch !== 'fix/p0-reviewer-decision-notification-diagnostic-4858'
  || scope.status !== 'active'
  || scope.approvedBy !== 'owner-issue-4858'
  || scope.authorityBaseExactMain !== '1bffaec1a7aad09840df136e886c07d2b32e2008'
  || scope.productionHosting !== 'REG_RU_VPS_ONLY'
  || scope.newRecurringCostRub !== 0) {
  throw new Error('P0_REVIEWER_DECISION_NOTIFICATION_DIAGNOSTIC_SCOPE_IDENTITY');
}

const expectedPaths = [
  '.github/workflows/production-p0-reviewer-decision-notification-diagnostic.yml',
  'scripts/check-production-p0-reviewer-decision-notification-diagnostic.mjs',
  'docs/platform-v7/autopilot/scopes/p0-reviewer-decision-notification-diagnostic-4858.json',
].sort();
const actualPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
  throw new Error('P0_REVIEWER_DECISION_NOTIFICATION_DIAGNOSTIC_SCOPE_PATHS');
}

process.stdout.write('Production P0 reviewer decision notification diagnostic contract PASS\n');
