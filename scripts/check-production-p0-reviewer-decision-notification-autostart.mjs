#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-decision-notification-autostart.yml';
const scriptPath = 'scripts/production-p0-reviewer-decision-notification-diagnostic.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/p0-reviewer-decision-notification-autostart-4858.json';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}

const workflowRequired = [
  'name: Production P0 Reviewer Decision Notification Autostart',
  'push:',
  'branches: [main]',
  "github.event_name == 'push' && 'pc-crop-registration-lifecycle'",
  'cancel-in-progress: false',
  'queue: max',
  "DIAGNOSTIC_ISSUE: '4858'",
  "FAILED_RUN_ID: '33425716125'",
  "FAILED_RUN_ATTEMPT: '2'",
  "FAILED_TARGET_SHA: '1bffaec1a7aad09840df136e886c07d2b32e2008'",
  "DIAGNOSTIC_SINCE: '2026-08-31T19:18:00Z'",
  "DIAGNOSTIC_UNTIL: '2026-08-31T19:20:30Z'",
  'github.event_name == \'push\' && needs.contract.result == \'success\'',
  '[[ "$GITHUB_ACTOR" == "$owner" ]]',
  "[[ \"${{ github.ref }}\" == 'refs/heads/main' ]]",
  'git merge-base --is-ancestor "$FAILED_TARGET_SHA" HEAD',
  'bash scripts/production-p0-reviewer-decision-notification-diagnostic.sh',
  'gh issue comment "$DIAGNOSTIC_ISSUE"',
  'production mutation: `NONE`',
  'raw logs, application identifiers, PII and credentials published: `0`',
];
const workflowMissing = workflowRequired.filter((value) => !workflow.includes(value));
if (workflowMissing.length) fail('P0_REVIEWER_NOTIFICATION_AUTOSTART_WORKFLOW_MISSING', workflowMissing.join('|'));

const scriptRequired = [
  "FAILED_RUN_ID='33425716125'",
  "FAILED_RUN_ATTEMPT='2'",
  "FAILED_TARGET_SHA='1bffaec1a7aad09840df136e886c07d2b32e2008'",
  "DIAGNOSTIC_SINCE='2026-08-31T19:18:00Z'",
  "DIAGNOSTIC_UNTIL='2026-08-31T19:20:30Z'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "DEFAULT_HOST='195.19.12.120'",
  'StrictHostKeyChecking=yes',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'git merge-base --is-ancestor "$FAILED_TARGET_SHA" "$current_main"',
  'docker inspect --format',
  'docker logs --since "$since" --until "$until" --timestamps "$web_id"',
  'p0_human_reviewer_ceremony',
  'registration_decision_notification_result',
  'COMMIT_SUCCEEDED_NOTIFICATION_FAILED',
  'PRIOR_COMMIT_REPLAY_WITHOUT_FIRST_DELIVERY',
  'COMMIT_SUCCEEDED_REPLAY_MISSING',
  'CEREMONY_EVIDENCE_COMPLETE',
  'NO_CEREMONY_EVENTS_IN_BOUND_WINDOW',
  'PARTIAL_OR_LOG_WINDOW_MISMATCH',
  'PRODUCTION_MUTATION: "NONE"',
  'RAW_LOGS_PUBLISHED: 0',
];
const scriptMissing = scriptRequired.filter((value) => !script.includes(value));
if (scriptMissing.length) fail('P0_REVIEWER_NOTIFICATION_AUTOSTART_SCRIPT_MISSING', scriptMissing.join('|'));

const workflowForbidden = [
  'issue_comment:',
  'workflow_dispatch:',
  'docker restart',
  'docker stop',
  'docker kill',
  'docker rm',
  'docker compose',
  'INSERT INTO',
  'UPDATE auth.',
  'DELETE FROM',
  'TRUNCATE TABLE',
  'ALTER ROLE',
  '--request POST',
  '-X POST',
  '--data-binary',
  '/api/auth/forgot-password',
  'github.event.issue.number == 3072',
  'gh issue comment 3072',
];
const workflowBad = workflowForbidden.filter((value) => workflow.includes(value));
if (workflowBad.length) fail('P0_REVIEWER_NOTIFICATION_AUTOSTART_WORKFLOW_FORBIDDEN', workflowBad.join('|'));

const scriptForbidden = [
  'docker restart',
  'docker stop',
  'docker kill',
  'docker rm',
  'docker compose',
  'INSERT INTO',
  'UPDATE auth.',
  'DELETE FROM',
  'TRUNCATE TABLE',
  'ALTER ROLE',
  '--request POST',
  '-X POST',
  '--data-binary',
  '/api/auth/forgot-password',
  'sendTransactionalMail(',
  'psql ',
];
const scriptBad = scriptForbidden.filter((value) => script.includes(value));
if (scriptBad.length) fail('P0_REVIEWER_NOTIFICATION_AUTOSTART_SCRIPT_FORBIDDEN', scriptBad.join('|'));

const exactWorkflowCounts = new Map([
  ["github.event_name == 'push' && 'pc-crop-registration-lifecycle'", 1],
  ['gh issue comment "$DIAGNOSTIC_ISSUE"', 1],
  ['bash scripts/production-p0-reviewer-decision-notification-diagnostic.sh', 1],
  ['production mutation: `NONE`', 1],
  ['raw logs, application identifiers, PII and credentials published: `0`', 1],
]);
for (const [needle, expected] of exactWorkflowCounts) {
  const actual = workflow.split(needle).length - 1;
  if (actual !== expected) fail('P0_REVIEWER_NOTIFICATION_AUTOSTART_WORKFLOW_COUNT', `${needle}:${actual}:${expected}`);
}

const exactScriptCounts = new Map([
  ['docker logs --since "$since" --until "$until" --timestamps "$web_id"', 1],
  ['P0_CLASSIFICATION: classification', 1],
  ['PRODUCTION_MUTATION: "NONE"', 1],
  ['RAW_LOGS_PUBLISHED: 0', 1],
  ['cat "$result"', 1],
]);
for (const [needle, expected] of exactScriptCounts) {
  const actual = script.split(needle).length - 1;
  if (actual !== expected) fail('P0_REVIEWER_NOTIFICATION_AUTOSTART_SCRIPT_COUNT', `${needle}:${actual}:${expected}`);
}

if (
  scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
  || scope.branch !== 'fix/p0-reviewer-decision-notification-autostart-4858'
  || scope.status !== 'active'
  || scope.approvedBy !== 'owner-issue-4858'
  || scope.authorityBaseExactMain !== '1bffaec1a7aad09840df136e886c07d2b32e2008'
  || scope.productionHosting !== 'REG_RU_VPS_ONLY'
  || scope.newRecurringCostRub !== 0
) fail('P0_REVIEWER_NOTIFICATION_AUTOSTART_SCOPE_IDENTITY');

const requiredPaths = [
  '.github/workflows/production-p0-reviewer-decision-notification-diagnostic.yml',
  'scripts/check-production-p0-reviewer-decision-notification-diagnostic.mjs',
  'docs/platform-v7/autopilot/scopes/p0-reviewer-decision-notification-diagnostic-4858.json',
  workflowPath,
  scriptPath,
  'scripts/check-production-p0-reviewer-decision-notification-autostart.mjs',
  scopePath,
].sort();
const actualPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(actualPaths) !== JSON.stringify(requiredPaths)) {
  fail('P0_REVIEWER_NOTIFICATION_AUTOSTART_SCOPE_PATHS');
}

if (!Array.isArray(scope.requiredBehavior) || scope.requiredBehavior.length < 6
  || !Array.isArray(scope.forbiddenCapabilities) || scope.forbiddenCapabilities.length < 6
  || !Array.isArray(scope.acceptanceEvidence) || scope.acceptanceEvidence.length < 6) {
  fail('P0_REVIEWER_NOTIFICATION_AUTOSTART_SCOPE_INCOMPLETE');
}

process.stdout.write('Production P0 reviewer decision notification autostart contract PASS\n');
